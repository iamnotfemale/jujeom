'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Phase 2a 임시 버전 — store 이름은 정적 기본값 사용.
 * Phase 2c에서 /s/[slug] 라우팅 도입 시 해당 가게 이름으로 교체.
 */
const PAGE_TITLES: Record<string, string> = {
  '/login': '로그인',
  '/signup': '회원가입',
  '/dashboard': '대시보드',
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

const DEFAULT_STORE_NAME = '주점';

export default function DynamicTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const pageLabel = PAGE_TITLES[pathname] || '';
    document.title = pageLabel ? `${pageLabel} | ${DEFAULT_STORE_NAME}` : DEFAULT_STORE_NAME;
  }, [pathname]);

  return null;
}
