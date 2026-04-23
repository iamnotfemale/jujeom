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
  body.store_id = check.store.id;

  const { data, error } = await supabaseAdmin.from('tables').insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog('tables.create', { id: data?.id }, clientIp(req));
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
    .from('tables')
    .update(rest)
    .eq('id', id)
    .eq('store_id', check.store.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog('tables.update', { id, fields: Object.keys(rest) }, clientIp(req));
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

  // orders는 table FK가 ON DELETE SET NULL이므로 직접 제거 없이 바로 삭제 가능
  const { error } = await supabaseAdmin
    .from('tables')
    .delete()
    .eq('id', body.id)
    .eq('store_id', check.store.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog('tables.delete', { id: body.id }, clientIp(req));
  return NextResponse.json({ ok: true });
}
