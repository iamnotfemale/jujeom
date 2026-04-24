import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import DashboardClient from './DashboardClient';
import type { StoreCard } from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  // getSession(): 로컬 쿠키 기반 확인 (네트워크 없음, getUser()보다 안정적)
  // 만료 여부는 proxy.ts의 updateSession()이 사전에 처리
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect('/login?next=/dashboard');

  const { data: stores } = await supabaseAdmin
    .from('store_members')
    .select('role, store:stores(id, slug, name, is_open, serving_mode, created_at)')
    .eq('user_id', session.user.id);

  return (
    <DashboardClient
      userEmail={session.user.email ?? ''}
      initialStores={(stores ?? []) as unknown as StoreCard[]}
    />
  );
}
