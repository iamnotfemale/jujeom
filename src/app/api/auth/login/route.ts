import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  // setAll에서 수집한 쿠키를 마지막에 response에 직접 주입
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

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  cookieBuffer.forEach((args) => res.cookies.set(...args));
  return res;
}
