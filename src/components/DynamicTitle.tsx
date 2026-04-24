'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// /s/[slug]/* 경로는 generateMetadata가 처리. 공통 경로만 클라이언트 title 설정.
const PAGE_TITLES: Record<string, string> = {
  '/login': '로그인',
  '/signup': '회원가입',
  '/dashboard': '대시보드',
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
