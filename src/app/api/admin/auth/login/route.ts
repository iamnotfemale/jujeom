import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-server';
import { signAdminJWT } from '@/lib/auth';
import { checkPinRateLimit, recordPinFailure, clearPinFailures } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const { locked, remainingMs } = checkPinRateLimit(ip);
  if (locked) {
    return NextResponse.json({ error: 'locked', remainingMs }, { status: 429 });
  }

  let pin = '';
  try {
    const body = (await req.json()) as { pin?: string };
    pin = body.pin ?? '';
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!pin || pin.length < 4) {
    return NextResponse.json({ error: 'invalid_pin' }, { status: 400 });
  }

  const { data: row } = await supabaseAdmin
    .from('admin_auth')
    .select('pin_hash')
    .limit(1)
    .single();

  if (!row?.pin_hash) {
    // admin_auth 미설정 상태 → 서버 설정 오류로 명시
    return NextResponse.json({ error: 'admin_auth_not_configured' }, { status: 500 });
  }

  const ok = await bcrypt.compare(pin, row.pin_hash);

  if (!ok) {
    const { lockedNow } = recordPinFailure(ip);
    return NextResponse.json(
      { error: lockedNow ? 'locked' : 'invalid' },
      { status: 401 },
    );
  }

  clearPinFailures(ip);
  const token = await signAdminJWT();
  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 2 * 3600,
    path: '/',
  });
  return res;
}
