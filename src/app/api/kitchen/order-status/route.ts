import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/require-admin';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

type OrderStatus = 'pending' | 'accepted' | 'cooking' | 'ready' | 'served' | 'cancelled';

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req);
  if (unauth) return unauth;

  let body: { orderId?: number; newStatus?: OrderStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { orderId, newStatus } = body;
  if (!orderId || !newStatus) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // 1) orders.status 업데이트
  const { error: ordErr } = await supabaseAdmin
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 400 });

  // 2) served → payments.completed
  if (newStatus === 'served') {
    const { error: payErr } = await supabaseAdmin
      .from('payments')
      .update({ status: 'completed', confirmed_at: new Date().toISOString() })
      .eq('order_id', orderId);
    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 400 });
  }

  // 3) cancelled → payments.cancelled + 재고 원복
  if (newStatus === 'cancelled') {
    const { error: payErr } = await supabaseAdmin
      .from('payments')
      .update({ status: 'cancelled' })
      .eq('order_id', orderId);
    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 400 });

    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('menu_id, quantity')
      .eq('order_id', orderId);

    if (items) {
      for (const it of items as Array<{ menu_id: number; quantity: number }>) {
        const { data: menu } = await supabaseAdmin
          .from('menus')
          .select('stock')
          .eq('id', it.menu_id)
          .single();
        if (menu) {
          await supabaseAdmin
            .from('menus')
            .update({ stock: (menu.stock ?? 0) + it.quantity })
            .eq('id', it.menu_id);
        }
      }
    }
  }

  await writeAuditLog(
    'kitchen.order_status',
    { orderId, newStatus },
    clientIp(req),
  );
  return NextResponse.json({ ok: true });
}
