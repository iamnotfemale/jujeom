import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js 16 proxy(구 middleware)용 세션 갱신 헬퍼.
 * - 만료 임박 토큰을 자동 refresh (쿠키 갱신)
 * - getSession()을 사용해 네트워크 검증 없이 로컬 쿠키에서 세션 확인
 *   (라우트 가드는 각 레이아웃의 supabase.auth.getUser()가 최종 검증)
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // request에 갱신된 쿠키 반영 → next/headers에서 조회 가능
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getSession(): 로컬 쿠키 읽기 + 만료 시 refresh token으로 갱신
  // 네트워크 검증 없이 빠르게 세션 유무만 확인 (인증 최종 판단은 각 레이아웃)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return { response, user: session?.user ?? null };
}
