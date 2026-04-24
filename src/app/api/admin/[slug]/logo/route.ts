import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { requireStoreRole } from '@/lib/require-store-role';
import { writeAuditLog, clientIp } from '@/lib/audit-log';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'manager');
  if (check.error) return check.error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'no_file' }, { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 });
  }

  const ext = file.type.split('/')[1];
  const path = `${check.store.id}/logo.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from('store-logos')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from('store-logos').getPublicUrl(path);

  const { error: dbError } = await supabaseAdmin
    .from('stores')
    .update({ logo_url: publicUrl })
    .eq('id', check.store.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  await writeAuditLog('logo.upload', { store_id: check.store.id }, clientIp(req));
  return NextResponse.json({ logo_url: publicUrl });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const check = await requireStoreRole(slug, 'manager');
  if (check.error) return check.error;

  const { data: files } = await supabaseAdmin.storage
    .from('store-logos')
    .list(check.store.id);

  if (files && files.length > 0) {
    await supabaseAdmin.storage
      .from('store-logos')
      .remove(files.map((f) => `${check.store.id}/${f.name}`));
  }

  await supabaseAdmin
    .from('stores')
    .update({ logo_url: null })
    .eq('id', check.store.id);

  await writeAuditLog('logo.delete', { store_id: check.store.id }, clientIp(req));
  return NextResponse.json({ ok: true });
}
