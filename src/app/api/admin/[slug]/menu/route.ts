import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireStoreRole } from '@/lib/require-store-role';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'manager');
  if (check.error) return check.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // store_id 강제 주입 (클라이언트가 보낸 값 무시)
  body.store_id = check.store.id;

  const { data, error } = await supabaseAdmin
    .from('menus')
    .insert(body)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog('menu.create', { id: data?.id, store_id: check.store.id }, clientIp(req));
  return NextResponse.json({ ok: true, data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'manager');
  if (check.error) return check.error;

  let body: { id?: number } & Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  delete rest.store_id;

  const { data, error } = await supabaseAdmin
    .from('menus')
    .update(rest)
    .eq('id', id)
    .eq('store_id', check.store.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await writeAuditLog('menu.update', { id, fields: Object.keys(rest) }, clientIp(req));
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'manager');
  if (check.error) return check.error;

  let body: { id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('menus')
    .delete()
    .eq('id', body.id)
    .eq('store_id', check.store.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog('menu.delete', { id: body.id }, clientIp(req));
  return NextResponse.json({ ok: true });
}
