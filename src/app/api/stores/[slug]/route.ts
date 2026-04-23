import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireStoreRole } from '@/lib/require-store-role';

/**
 * GET /api/stores/[slug] — 가게 상세 (멤버 전용)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'kitchen');
  if (check.error) return check.error;
  return NextResponse.json({ store: check.store, role: check.role });
}

/**
 * PATCH /api/stores/[slug] — 가게 정보 수정 (manager+)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'manager');
  if (check.error) return check.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // 허용 필드만
  const allowed = ['name', 'is_open', 'is_paused', 'serving_mode',
                   'bank_name', 'account_number', 'toss_qr_url'] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('stores')
    .update(patch)
    .eq('id', check.store.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ store: data });
}

/**
 * DELETE /api/stores/[slug] — 가게 삭제 (owner만)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'owner');
  if (check.error) return check.error;

  const { error } = await supabaseAdmin
    .from('stores')
    .delete()
    .eq('id', check.store.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
