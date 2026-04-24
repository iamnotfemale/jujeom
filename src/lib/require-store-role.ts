import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export type StoreRole = 'owner' | 'manager' | 'kitchen';

export interface StoreContext {
  id: string;
  slug: string;
  name: string;
  owner_id: string;
  is_open: boolean;
  is_paused: boolean;
  serving_mode: 'pickup' | 'table';
  bank_name: string;
  account_number: string;
  toss_qr_url: string;
  account_holder: string | null;
  closed_message: string | null;
  welcome_text: string | null;
  welcome_highlight: string | null;
  notice: string | null;
  auto_lock_kds: boolean;
  logo_url: string | null;
}

/**
 * slug로 가게 찾고, 로그인 유저가 해당 가게에서 최소 역할 이상인지 검증.
 * owner > manager > kitchen 계층.
 *
 * 사용 패턴:
 *   const check = await requireStoreRole(slug, 'manager');
 *   if (check.error) return check.error;
 *   const { user, store, role } = check;
 */
export async function requireStoreRole(
  slug: string,
  minRole: StoreRole,
): Promise<
  | { error: NextResponse; user: null; store: null; role: null }
  | { error: null; user: User; store: StoreContext; role: StoreRole }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
      user: null,
      store: null,
      role: null,
    };
  }

  // service_role로 가게 + 멤버십 조회 (RLS 우회해 가게가 없는 경우/권한 없는 경우를 구분)
  const { data: store, error: storeErr } = await supabaseAdmin
    .from('stores')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (storeErr || !store) {
    return {
      error: NextResponse.json({ error: 'store_not_found' }, { status: 404 }),
      user: null,
      store: null,
      role: null,
    };
  }

  const { data: member } = await supabaseAdmin
    .from('store_members')
    .select('role')
    .eq('store_id', (store as { id: string }).id)
    .eq('user_id', user.id)
    .maybeSingle();

  const role = (member as { role?: StoreRole } | null)?.role;
  if (!role || !meetsMinRole(role, minRole)) {
    return {
      error: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
      user: null,
      store: null,
      role: null,
    };
  }

  return { error: null, user, store: store as StoreContext, role };
}

function meetsMinRole(actual: StoreRole, min: StoreRole): boolean {
  if (min === 'kitchen') return ['owner', 'manager', 'kitchen'].includes(actual);
  if (min === 'manager') return ['owner', 'manager'].includes(actual);
  return actual === 'owner';
}

/**
 * slug로 가게 정보만 가져옴 (anon-safe: 민감 정보 제외).
 * 손님용 페이지에서 사용.
 */
export async function getStoreBySlug(slug: string): Promise<StoreContext | null> {
  const { data } = await supabaseAdmin
    .from('stores')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return (data as StoreContext | null) ?? null;
}
