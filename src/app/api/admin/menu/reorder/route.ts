import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/require-admin';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req);
  if (unauth) return unauth;

  let body: { ids?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const ids = body.ids;
  if (!Array.isArray(ids) || ids.some((v) => typeof v !== 'number')) {
    return NextResponse.json({ error: 'invalid_ids' }, { status: 400 });
  }

  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabaseAdmin
      .from('menus')
      .update({ sort_order: i })
      .eq('id', ids[i]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  await writeAuditLog('menu.reorder', { count: ids.length }, clientIp(req));
  return NextResponse.json({ ok: true });
}
