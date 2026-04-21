import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminJWT } from '@/lib/auth';

/** Returns null if authorized, or a 401 NextResponse if not. */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const token = req.cookies.get('admin_token')?.value;
  if (!(await verifyAdminJWT(token))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
