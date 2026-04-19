'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const PAGE_TITLES: Record<string, string> = {
  '/order': '주문하기',
  '/order/menu': '메뉴',
  '/order/confirm': '주문 확인',
  '/order/status': '주문 상태',
  '/admin/dashboard': '관리자 · 대시보드',
  '/admin/menu': '관리자 · 메뉴 관리',
  '/admin/tables': '관리자 · 테이블 관리',
  '/admin/payments': '관리자 · 결제 내역',
  '/admin/settings': '관리자 · 설정',
  '/kitchen': '주방 KDS',
};

export default function DynamicTitle() {
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('store_settings').select('store_name').single();
      const storeName = data?.store_name || '주점';
      const pageLabel = PAGE_TITLES[pathname] || '';
      document.title = pageLabel ? `${pageLabel} | ${storeName}` : storeName;
    })();
  }, [pathname]);

  return null;
}
