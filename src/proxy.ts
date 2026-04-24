import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

/**
 * Next.js 16: `middleware.ts`의 새 이름은 `proxy.ts` (기능 동일).
 *
 * 역할:
 *   1. updateSession() — 만료 임박 토큰을 refresh하여 쿠키 갱신
 *   2. 보호 경로 가드 — Supabase 세션 쿠키 존재 여부로 낙관적 체크
 *      (실제 세션 유효성은 각 페이지·레이아웃의 getUser()/getSession()이 최종 검증)
 *
 * 보호 경로: /admin/*, /kitchen/*, /dashboard/**
 * 공개 경로: /, /login, /auth/*, /order/*, /s/*, /api/*
 */
export async function proxy(request: NextRequest) {
  // 만료 임박 토큰 갱신 — 갱신된 쿠키가 response에 Set-Cookie로 포함됨
  const { response } = await updateSession(request);

  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith('/admin') ||
    path.startsWith('/kitchen') ||
    path === '/dashboard' ||
    path.startsWith('/dashboard/') ||
    /^\/s\/[^/]+\/admin(\/|$)/.test(path) ||
    /^\/s\/[^/]+\/kitchen(\/|$)/.test(path);

  if (isProtected) {
    // Supabase 세션 쿠키(sb-<ref>-auth-token*)가 있는지 직접 확인
    // getSession()은 서버 클라이언트 초기화 타이밍에 따라 실패할 수 있어 쿠키를 직접 본다
    const ref =
      process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\./)?.[1] ?? '';
    const hasToken =
      ref !== '' &&
      request.cookies.getAll().some((c) => c.name.startsWith(`sb-${ref}-auth-token`));

    if (!hasToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
