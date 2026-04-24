import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getStoreBySlug } from '@/lib/require-store-role';
import AdminShell, { type AdminRole } from './AdminShell';

/**
 * /s/[slug]/admin/* 가드.
 * - 비로그인: /login?next=... 으로 리디렉트
 * - 로그인했지만 이 가게 멤버가 아님: /dashboard 로 리디렉트
 * - 멤버: AdminShell 렌더링 + 유저 이메일·역할 전달
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/s/${slug}/admin/dashboard`)}`);
  }

  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  const { data: member } = await supabaseAdmin
    .from('store_members')
    .select('role')
    .eq('store_id', store.id)
    .eq('user_id', user.id)
    .maybeSingle();

  const role = (member as { role?: AdminRole } | null)?.role;
  if (!role) {
    redirect('/dashboard');
  }

  return (
    <AdminShell userEmail={user.email ?? ''} role={role}>
      {children}
    </AdminShell>
  );
}
