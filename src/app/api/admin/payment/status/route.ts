import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/require-admin';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

type PaymentStatus = 'waiting' | 'confirmed' | 'completed' | 'cancelled';

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req);
  if (unauth) return unauth;

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

  // Try RPC first; fall back to inline updates if it doesn't exist.
  const { error: rpcError } = await supabaseAdmin.rpc('admin_set_payment_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_table_id: tableId ?? null,
  });

  if (rpcError) {
    const code = (rpcError as { code?: string }).code;
    // PGRST202 / 42883: function does not exist → fallback
    if (code === 'PGRST202' || code === '42883' || /does not exist/i.test(rpcError.message)) {
      const updates: { error: { message: string } | null }[] = [];

      const { error: payErr } = await supabaseAdmin
        .from('payments')
        .update({
          status: newStatus,
          confirmed_at:
            newStatus === 'confirmed' || newStatus === 'completed'
              ? new Date().toISOString()
              : null,
        })
        .eq('order_id', orderId);
      updates.push({ error: payErr });

      let orderStatus: string | null = null;
      if (newStatus === 'confirmed') orderStatus = 'accepted';
      else if (newStatus === 'completed') orderStatus = 'served';
      else if (newStatus === 'cancelled') orderStatus = 'cancelled';
      else if (newStatus === 'waiting') orderStatus = 'pending';

      if (orderStatus) {
        const { error: ordErr } = await supabaseAdmin
          .from('orders')
          .update({ status: orderStatus, updated_at: new Date().toISOString() })
          .eq('id', orderId);
        updates.push({ error: ordErr });
      }

      if (newStatus === 'completed' && tableId) {
        const { error: tblErr } = await supabaseAdmin
          .from('tables')
          .update({ status: 'empty' })
          .eq('id', tableId);
        updates.push({ error: tblErr });
      } else if (newStatus === 'confirmed' && tableId) {
        // Only promote empty tables to occupied
        const { data: tbl } = await supabaseAdmin
          .from('tables')
          .select('status')
          .eq('id', tableId)
          .single();
        if ((tbl as { status?: string } | null)?.status === 'empty') {
          const { error: tblErr } = await supabaseAdmin
            .from('tables')
            .update({ status: 'occupied' })
            .eq('id', tableId);
          updates.push({ error: tblErr });
        }
      }

      // 취소 시 재고 원복
      if (newStatus === 'cancelled') {
        const { data: items } = await supabaseAdmin
          .from('order_items')
          .select('menu_id, quantity')
          .eq('order_id', orderId);
        for (const it of (items ?? []) as Array<{ menu_id: number; quantity: number }>) {
          const { data: menu } = await supabaseAdmin
            .from('menus')
            .select('stock')
            .eq('id', it.menu_id)
            .single();
          if (menu) {
            await supabaseAdmin
              .from('menus')
              .update({
                stock: ((menu as { stock?: number }).stock ?? 0) + it.quantity,
                is_sold_out: false,
              })
              .eq('id', it.menu_id);
          }
        }
      }

      const firstErr = updates.find((u) => u.error)?.error;
      if (firstErr) {
        return NextResponse.json({ error: firstErr.message }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }
  }

  await writeAuditLog(
    'payment.status',
    { orderId, newStatus, tableId: tableId ?? null },
    clientIp(req),
  );
  return NextResponse.json({ ok: true });
}
