import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/require-admin';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

export async function PATCH(req: NextRequest) {
  const unauth = await requireAdmin(req);
  if (unauth) return unauth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // PIN은 별도 route에서만 처리
  if ('pin' in body) delete body.pin;
  if ('pin_hash' in body) delete body.pin_hash;
  if ('id' in body) delete body.id;

  // 현재 설정 row id 조회 (스키마상 1개만 존재)
  const { data: current } = await supabaseAdmin
    .from('store_settings')
    .select('id')
    .limit(1)
    .single();

  if (!current?.id) {
    return NextResponse.json({ error: 'settings_not_found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('store_settings')
    .update(body)
    .eq('id', current.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog('settings.update', { fields: Object.keys(body) }, clientIp(req));
  return NextResponse.json({ ok: true, data });
}
