import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * 로그인 여부만 확인. 스토어 권한(owner/manager/kitchen) 검증은 Phase 2c에서
 * `requireStoreRole(slug, ['owner'|'manager'|'kitchen'])` 형태로 추가될 예정.
 *
 * 사용 패턴:
 *   const { error: unauth, user } = await requireUser();
 *   if (unauth) return unauth;
 *   // user.id 사용 가능
 */
export async function requireUser(): Promise<
  { error: NextResponse; user: null } | { error: null; user: User }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
      user: null,
    };
  }
  return { error: null, user };
}
