import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminJWT } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  const ok = await verifyAdminJWT(token);
  if (!ok) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
