import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase.from('store_settings').select('store_name, store_description').single();
    return {
      title: data?.store_name || '주점',
      description: data?.store_description || '축제 주점 주문 시스템',
      openGraph: {
        title: data?.store_name || '주점',
        description: data?.store_description || '축제 주점 주문 시스템',
        type: 'website',
      },
    };
  } catch {
    return { title: '주점' };
  }
}

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
