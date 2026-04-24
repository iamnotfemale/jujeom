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
    await supabaseAdmin.from('payments').delete().eq('store_id', storeId);
    await supabaseAdmin.from('orders').delete().eq('store_id', storeId);
    await supabaseAdmin.from('tables').update({ status: 'empty' }).eq('store_id', storeId);
  } else if (type === 'tables') {
    await supabaseAdmin.from('payments').delete().eq('store_id', storeId);
    await supabaseAdmin.from('orders').delete().eq('store_id', storeId);
    await supabaseAdmin.from('tables').delete().eq('store_id', storeId);
  } else if (type === 'all') {
    await supabaseAdmin.from('payments').delete().eq('store_id', storeId);
    await supabaseAdmin.from('orders').delete().eq('store_id', storeId);
    await supabaseAdmin.from('tables').delete().eq('store_id', storeId);
    await supabaseAdmin.from('menus').delete().eq('store_id', storeId);
  }

  await writeAuditLog('reset', { type, store_id: storeId }, clientIp(req));
  return NextResponse.json({ ok: true });
}
