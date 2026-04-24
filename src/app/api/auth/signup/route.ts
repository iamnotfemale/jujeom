import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (data.session) return NextResponse.json({ ok: true, redirect: '/dashboard' });
  return NextResponse.json({
    ok: true,
    info: '가입 완료! 이메일로 보낸 확인 링크를 클릭해 주세요.',
  });
}
