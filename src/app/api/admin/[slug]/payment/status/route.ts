import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireStoreRole } from '@/lib/require-store-role';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

type PaymentStatus = 'waiting' | 'confirmed' | 'completed' | 'cancelled';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'manager');
  if (check.error) return check.error;

  let body: { orderId?: number; newStatus?: PaymentStatus; tableId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { orderId, newStatus, tableId } = body;
  if (!orderId || !newStatus) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // RPC는 store_id/권한 체크와 재고 원복까지 처리
  const { error } = await supabaseAdmin.rpc('admin_set_payment_status', {
    p_store_id: check.store.id,
    p_order_id: orderId,
    p_new_status: newStatus,
    p_table_id: tableId ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(
    'payment.status',
    { orderId, newStatus, tableId: tableId ?? null },
    clientIp(req),
  );
  return NextResponse.json({ ok: true });
}
