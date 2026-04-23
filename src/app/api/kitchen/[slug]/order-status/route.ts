import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireStoreRole } from '@/lib/require-store-role';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

type OrderStatus = 'pending' | 'accepted' | 'cooking' | 'ready' | 'served' | 'cancelled';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'kitchen');
  if (check.error) return check.error;

  let body: { orderId?: number; newStatus?: OrderStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (!body.orderId || !body.newStatus) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // RPC가 store_id 검증, 권한 확인, 재고 원복까지 처리
  const { error } = await supabaseAdmin.rpc('admin_set_order_status', {
    p_store_id: check.store.id,
    p_order_id: body.orderId,
    p_new_status: body.newStatus,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(
    'kitchen.order_status',
    { orderId: body.orderId, newStatus: body.newStatus },
    clientIp(req),
  );
  return NextResponse.json({ ok: true });
}
