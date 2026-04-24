import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/** 로그인 여부만 확인. 스토어 권한 검증은 requireStoreRole 사용. */
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
