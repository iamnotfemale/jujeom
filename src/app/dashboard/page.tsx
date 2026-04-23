import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import DashboardClient from './DashboardClient';
import type { StoreCard } from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: stores } = await supabaseAdmin
    .from('store_members')
    .select('role, store:stores(id, slug, name, is_open, serving_mode, created_at)')
    .eq('user_id', user.id);

  return (
    <DashboardClient
      userEmail={user.email ?? ''}
      initialStores={(stores ?? []) as unknown as StoreCard[]}
    />
  );
}
