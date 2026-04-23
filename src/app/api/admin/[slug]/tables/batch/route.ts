import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireStoreRole } from '@/lib/require-store-role';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

interface BatchItem {
  id: number;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'manager');
  if (check.error) return check.error;

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
    const { error } = await supabaseAdmin
      .from('tables')
      .update(rest)
      .eq('id', id)
      .eq('store_id', check.store.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog('tables.batch_update', { count: items.length }, clientIp(req));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'manager');
  if (check.error) return check.error;

  // orders는 table FK가 SET NULL이므로 table 삭제만 하면 됨 (단, 해당 store만)
  const { error } = await supabaseAdmin
    .from('tables')
    .delete()
    .eq('store_id', check.store.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog('tables.delete_all', {}, clientIp(_req));
  return NextResponse.json({ ok: true });
}
