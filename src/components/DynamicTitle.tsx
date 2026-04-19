'use client';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function DynamicTitle() {
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('store_settings').select('store_name').single();
      if (data?.store_name) {
        document.title = data.store_name;
      }
    })();
  }, []);
  return null;
}
