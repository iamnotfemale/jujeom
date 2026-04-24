import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireStoreRole } from '@/lib/require-store-role';
import type { StoreRole } from '@/lib/types/store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'manager');
  if (check.error) return check.error;

  const { data: members, error } = await supabaseAdmin
    .from('store_members')
    .select('user_id, role')
    .eq('store_id', check.store.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // 각 멤버의 이메일 조회
  const enriched = await Promise.all(
    (members ?? []).map(async (m: { user_id: string; role: StoreRole }) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
      return {
        userId: m.user_id,
        email: data?.user?.email ?? m.user_id,
        role: m.role,
      };
    }),
  );

  return NextResponse.json({ members: enriched, myRole: check.role });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'owner');
  if (check.error) return check.error;

  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { email, role } = body;
  if (!email || !role) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (role !== 'manager' && role !== 'kitchen') {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }

  // 이메일로 유저 찾기 — 전체 페이지를 순회해 사용자 수 제한 없이 검색
  const needle = email.trim().toLowerCase();
  let targetUser: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.getUserById>>['data']['user'] | undefined;
  const PER_PAGE = 1000;
  for (let page = 1; ; page++) {
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
    const users = listData?.users ?? [];
    targetUser = users.find((u) => u.email?.toLowerCase() === needle);
    if (targetUser || users.length < PER_PAGE) break;
  }
  if (!targetUser) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  // owner 자신은 추가 불가
  if (targetUser.id === check.user.id) {
    return NextResponse.json({ error: 'cannot_add_self' }, { status: 400 });
  }

  // 해당 유저가 이미 owner인지 확인
  const { data: existing } = await supabaseAdmin
    .from('store_members')
    .select('role')
    .eq('store_id', check.store.id)
    .eq('user_id', targetUser.id)
    .maybeSingle();

  if ((existing as { role?: string } | null)?.role === 'owner') {
    return NextResponse.json({ error: 'cannot_change_owner_role' }, { status: 400 });
  }

  // upsert — 이미 멤버면 역할 업데이트
  const { error: upsertError } = await supabaseAdmin
    .from('store_members')
    .upsert(
      { store_id: check.store.id, user_id: targetUser.id, role },
      { onConflict: 'store_id,user_id' },
    );
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 400 });

  return NextResponse.json({ ok: true, userId: targetUser.id });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'owner');
  if (check.error) return check.error;

  let body: { userId?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { userId, role } = body;
  if (!userId || !role) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  if (role !== 'manager' && role !== 'kitchen') {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin
    .from('store_members')
    .select('role')
    .eq('store_id', check.store.id)
    .eq('user_id', userId)
    .maybeSingle();

  if ((target as { role?: string } | null)?.role === 'owner') {
    return NextResponse.json({ error: 'cannot_change_owner_role' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('store_members')
    .update({ role })
    .eq('store_id', check.store.id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'owner');
  if (check.error) return check.error;

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { userId } = body;
  if (!userId) return NextResponse.json({ error: 'missing_userId' }, { status: 400 });

  // owner 자신은 삭제 불가
  if (userId === check.user.id) {
    return NextResponse.json({ error: 'cannot_remove_self' }, { status: 400 });
  }

  // owner 역할인 멤버는 삭제 불가
  const { data: target } = await supabaseAdmin
    .from('store_members')
    .select('role')
    .eq('store_id', check.store.id)
    .eq('user_id', userId)
    .maybeSingle();

  if ((target as { role?: string } | null)?.role === 'owner') {
    return NextResponse.json({ error: 'cannot_remove_owner' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('store_members')
    .delete()
    .eq('store_id', check.store.id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
