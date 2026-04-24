import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireStoreRole } from '@/lib/require-store-role';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

type ResetType = 'payments' | 'tables' | 'all';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'owner');
  if (check.error) return check.error;

  let body: { type?: ResetType };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const type = body.type;
  if (!type) return NextResponse.json({ error: 'missing_type' }, { status: 400 });

  const storeId = check.store.id;

  if (type === 'payments') {
    const { error: e1 } = await supabaseAdmin.from('payments').delete().eq('store_id', storeId);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    const { error: e2 } = await supabaseAdmin.from('orders').delete().eq('store_id', storeId);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    await supabaseAdmin.from('tables').update({ status: 'empty' }).eq('store_id', storeId);
  } else if (type === 'tables') {
    const { error: e1 } = await supabaseAdmin.from('payments').delete().eq('store_id', storeId);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    const { error: e2 } = await supabaseAdmin.from('orders').delete().eq('store_id', storeId);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    const { error: e3 } = await supabaseAdmin.from('tables').delete().eq('store_id', storeId);
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });
  } else if (type === 'all') {
    const { error: e1 } = await supabaseAdmin.from('payments').delete().eq('store_id', storeId);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    const { error: e2 } = await supabaseAdmin.from('orders').delete().eq('store_id', storeId);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    const { error: e3 } = await supabaseAdmin.from('tables').delete().eq('store_id', storeId);
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });
    const { error: e4 } = await supabaseAdmin.from('menus').delete().eq('store_id', storeId);
    if (e4) return NextResponse.json({ error: e4.message }, { status: 500 });
  }

  await writeAuditLog('reset', { type, store_id: storeId }, clientIp(req), check.user.id);
  return NextResponse.json({ ok: true });
}
