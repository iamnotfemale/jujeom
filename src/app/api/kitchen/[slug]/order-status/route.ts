import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

  // 유저 세션 client로 호출 — RPC 내부 auth.uid() 검증 통과용
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_order_status', {
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
