import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

/**
 * Next.js 16: `middleware.ts`의 새 이름은 `proxy.ts` (기능 동일).
 * Supabase Auth 세션을 매 요청마다 갱신하고, 보호 경로를 가드한다.
 *
 * 보호 경로:
 *   /admin/*, /kitchen/*, /dashboard  → 비로그인이면 /login 으로 리다이렉트
 *
 * 공개 경로:
 *   /, /login, /auth/*, /order/*, /s/*, /api/*
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith('/admin') ||
    path.startsWith('/kitchen') ||
    path === '/dashboard' ||
    path.startsWith('/dashboard/') ||
    /^\/s\/[^/]+\/admin(\/|$)/.test(path) ||
    /^\/s\/[^/]+\/kitchen(\/|$)/.test(path);

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 정적 자산, _next 내부 경로, favicon 등은 제외.
     * 세션 갱신이 필요 없는 경로라도 supabase 쿠키는 요청마다 경유해야 함.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
