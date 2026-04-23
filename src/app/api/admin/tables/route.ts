import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireUser } from '@/lib/require-user';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

export async function POST(req: NextRequest) {
  const { error: unauth } = await requireUser();
  if (unauth) return unauth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from('tables').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(
    'tables.create',
    { id: data?.id, kind: (data as { kind?: string })?.kind },
    clientIp(req),
  );
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: NextRequest) {
  const { error: unauth } = await requireUser();
  if (unauth) return unauth;

  let body: { id?: number } & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('tables')
    .update(rest)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog('tables.update', { id, fields: Object.keys(rest) }, clientIp(req));
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: NextRequest) {
  const { error: unauth } = await requireUser();
  if (unauth) return unauth;

  let body: { id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!body.id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  // Delete orders first (order_items cascades via FK)
  const { error: ordErr } = await supabaseAdmin.from('orders').delete().eq('table_id', body.id);
  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 400 });

  const { error } = await supabaseAdmin.from('tables').delete().eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog('tables.delete', { id: body.id }, clientIp(req));
  return NextResponse.json({ ok: true });
}
