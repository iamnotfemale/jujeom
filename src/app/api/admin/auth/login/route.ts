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

  let ok = false;
  if (row?.pin_hash) {
    // bcrypt hash
    ok = await bcrypt.compare(pin, row.pin_hash);
  } else {
    // Fallback: store_settings.pin 평문 비교 (마이그레이션 전 호환)
    const { data: s } = await supabaseAdmin
      .from('store_settings')
      .select('pin')
      .limit(1)
      .single();
    ok = !!s && s.pin === pin;
  }

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
