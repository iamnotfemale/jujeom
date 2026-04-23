'use client';

/**
 * Phase 2a 임시 버전 — store_settings 테이블이 제거되어 게이트 로직이 없음.
 * Phase 2c에서 /s/[slug] 라우팅 도입 시 해당 store의 is_open을 참조해 다시 활성화.
 */
export default function ClosedGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
