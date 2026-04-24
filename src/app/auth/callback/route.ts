import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 이메일 확인 링크 / 매직 링크 / OAuth 콜백 수신 엔드포인트.
 * Supabase가 `?code=...`를 붙여 돌려보내면 세션으로 교환한다.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const rawNext = url.searchParams.get('next') || '';
  const next = isSafeRedirect(rawNext) ? rawNext : '/dashboard';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}

function isSafeRedirect(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//') && !url.includes('://');
}
