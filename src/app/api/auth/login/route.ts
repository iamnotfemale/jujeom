import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  // next/headers 기반 createClient: setAll이 cookieStore.set()을 직접 호출하므로
  // Next.js가 자동으로 Set-Cookie 헤더를 응답에 포함시킴
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });

  return NextResponse.json({ ok: true });
}
