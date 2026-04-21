import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/require-admin';

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req);
  if (unauth) return unauth;

  let newPin = '';
  try {
    const body = (await req.json()) as { newPin?: string };
    newPin = body.newPin ?? '';
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!newPin || newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
    return NextResponse.json({ error: 'invalid_pin' }, { status: 400 });
  }

  const hash = await bcrypt.hash(newPin, 10);
  const { error } = await supabaseAdmin
    .from('admin_auth')
    .upsert({ id: 1, pin_hash: hash });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
