import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getStoreBySlug } from '@/lib/require-store-role';

/**
 * /s/[slug]/kitchen 가드.
 * - 비로그인: /login?next=... 으로
 * - 이 가게 멤버 아님: /dashboard 로
 * - kitchen 이상 역할: 통과 (page.tsx 렌더)
 */
export default async function KitchenLayout({
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
    redirect(`/login?next=${encodeURIComponent(`/s/${slug}/kitchen`)}`);
  }

  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  const { data: member } = await supabaseAdmin
    .from('store_members')
    .select('role')
    .eq('store_id', store.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
