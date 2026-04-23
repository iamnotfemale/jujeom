import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireUser } from '@/lib/require-user';
import { isValidSlug, randomSuffix, slugify } from '@/lib/slug';

/**
 * GET /api/stores — 내가 멤버로 속한 가게 목록
 */
export async function GET() {
  const { error: unauth, user } = await requireUser();
  if (unauth) return unauth;

  const { data, error } = await supabaseAdmin
    .from('store_members')
    .select('role, store:stores(id, slug, name, is_open, serving_mode, created_at)')
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ stores: data ?? [] });
}

interface CreateBody {
  name?: string;
  slug?: string;
}

/**
 * POST /api/stores — 새 가게 생성 (최대 5개 트리거가 enforce)
 * body: { name: string, slug?: string }
 * slug 미제공 시 name에서 생성 + 충돌 시 랜덤 suffix
 */
export async function POST(req: NextRequest) {
  const { error: unauth, user } = await requireUser();
  if (unauth) return unauth;

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length < 1 || name.length > 60) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }

  let slug = body.slug ? body.slug.trim().toLowerCase() : slugify(name);
  if (!slug) slug = `store-${randomSuffix(6)}`;
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
  }

  // Unique slug: 충돌 시 최대 5회 suffix 재시도
  for (let i = 0; i < 5; i++) {
    const { data: existing } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${slugify(name) || 'store'}-${randomSuffix(4)}`;
    if (!isValidSlug(slug)) slug = `store-${randomSuffix(6)}`;
  }

  const { data, error } = await supabaseAdmin
    .from('stores')
    .insert({ name, slug, owner_id: user.id })
    .select('id, slug, name, is_open, serving_mode, created_at')
    .single();

  if (error) {
    // 5개 초과(max_stores_per_user_exceeded) 등 트리거 예외
    if (/max_stores_per_user_exceeded/.test(error.message)) {
      return NextResponse.json({ error: 'max_stores_exceeded' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ store: data });
}
