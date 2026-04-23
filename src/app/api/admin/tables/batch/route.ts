import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireUser } from '@/lib/require-user';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

interface BatchItem {
  id: number;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
}

export async function PATCH(req: NextRequest) {
  const { error: unauth } = await requireUser();
  if (unauth) return unauth;

  let body: { items?: BatchItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const items = body.items;
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'invalid_items' }, { status: 400 });
  }

  for (const it of items) {
    if (!it.id) continue;
    const { id, ...rest } = it;
    const { error } = await supabaseAdmin.from('tables').update(rest).eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  await writeAuditLog('tables.batch_update', { count: items.length }, clientIp(req));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { error: unauth } = await requireUser();
  if (unauth) return unauth;

  // Delete all orders first (order_items cascades via FK)
  const { error: ordErr } = await supabaseAdmin
    .from('orders')
    .delete()
    .gte('id', 0);
  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 400 });

  const { error } = await supabaseAdmin.from('tables').delete().gte('id', 0);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog('tables.delete_all', {}, clientIp(req));
  return NextResponse.json({ ok: true });
}
