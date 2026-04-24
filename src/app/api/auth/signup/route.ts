import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const cookieBuffer: Parameters<ReturnType<typeof NextResponse.json>['cookies']['set']>[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            cookieBuffer.push([name, value, options] as Parameters<ReturnType<typeof NextResponse.json>['cookies']['set']>),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const body = data.session
    ? {
        ok: true,
        redirect: '/dashboard',
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      }
    : { ok: true, info: '가입 완료! 이메일로 보낸 확인 링크를 클릭해 주세요.' };

  const res = NextResponse.json(body);
  cookieBuffer.forEach((args) => res.cookies.set(...args));
  return res;
}
