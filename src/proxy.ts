import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminJWT } from '@/lib/auth';

// Next.js 16: the `middleware` file convention has been renamed to `proxy`.
// See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // API route는 각자 검증하므로 제외
  if (path.startsWith('/api/')) return NextResponse.next();

  if (path.startsWith('/admin') || path.startsWith('/kitchen')) {
    const token = req.cookies.get('admin_token')?.value;
    await verifyAdminJWT(token);
    // 서버 레벨에서 차단하지 않고 클라 PinLogin이 뜨도록 허용 (기존 UX 유지).
    // 클라 페이지에서 /api/admin/auth/check 호출로 최종 판정.
    return NextResponse.next();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/kitchen/:path*'],
};
