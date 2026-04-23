import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireUser } from '@/lib/require-user';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

type ResetType = 'payments' | 'tables' | 'all';

export async function POST(req: NextRequest) {
  const { error: unauth } = await requireUser();
  if (unauth) return unauth;

  let body: { type?: ResetType };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const type = body.type;
  if (!type) return NextResponse.json({ error: 'missing_type' }, { status: 400 });

  // Prefer RPC when available
  const { error: rpcError } = await supabaseAdmin.rpc('admin_reset_all', {
    p_type: type,
  });

  if (rpcError) {
    const code = (rpcError as { code?: string }).code;
    const fallback =
      code === 'PGRST202' || code === '42883' || /does not exist/i.test(rpcError.message);
    if (!fallback) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }

    // Inline fallback
    if (type === 'payments') {
      // Clear payments, orders, and reset table status
      const { error: e1 } = await supabaseAdmin.from('payments').delete().gte('id', 0);
      if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
      const { error: e2 } = await supabaseAdmin.from('orders').delete().gte('id', 0);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });
      const { error: e3 } = await supabaseAdmin
        .from('tables')
        .update({ status: 'empty' })
        .gte('id', 0);
      if (e3) return NextResponse.json({ error: e3.message }, { status: 400 });
    } else if (type === 'tables') {
      const { error: e1 } = await supabaseAdmin.from('orders').delete().gte('id', 0);
      if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
      const { error: e2 } = await supabaseAdmin.from('tables').delete().gte('id', 0);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });
    } else if (type === 'all') {
      const { error: e1 } = await supabaseAdmin.from('payments').delete().gte('id', 0);
      if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
      const { error: e2 } = await supabaseAdmin.from('orders').delete().gte('id', 0);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });
      const { error: e3 } = await supabaseAdmin.from('tables').delete().gte('id', 0);
      if (e3) return NextResponse.json({ error: e3.message }, { status: 400 });
      const { error: e4 } = await supabaseAdmin.from('menus').delete().gte('id', 0);
      if (e4) return NextResponse.json({ error: e4.message }, { status: 400 });
    } else {
      return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
    }
  }

  await writeAuditLog('reset', { type }, clientIp(req));
  return NextResponse.json({ ok: true });
}
