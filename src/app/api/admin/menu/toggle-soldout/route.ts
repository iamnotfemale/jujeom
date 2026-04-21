import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/require-admin';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req);
  if (unauth) return unauth;

  let body: { id?: number; is_sold_out?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!body.id || typeof body.is_sold_out !== 'boolean') {
    return NextResponse.json({ error: 'invalid_fields' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('menus')
    .update({ is_sold_out: body.is_sold_out })
    .eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(
    'menu.toggle_soldout',
    { id: body.id, is_sold_out: body.is_sold_out },
    clientIp(req),
  );
  return NextResponse.json({ ok: true });
}
