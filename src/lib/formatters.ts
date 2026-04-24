// 가격: 12000 → "12,000원"
export function formatPrice(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

// 경과 시간 (ISO 문자열 기준): "방금", "3분 전", "1시간 30분 전" 등. 출처: admin/dashboard/page.tsx
export function formatTimeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (diff < 1) return '방금';
  if (diff < 60) return `${diff}분 전`;
  return `${Math.floor(diff / 60)}시간 전`;
}

// 타이머 (초 단위): 90 → "01:30". 출처: kitchen/page.tsx
export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 경과 분 (숫자 반환): ISO 문자열 기준. 출처: admin/payments/page.tsx
export function elapsedMinutes(isoString: string): number {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
}

// 경과 시간 레이블: 분 단위 숫자 → "방금", "N분", "N시간 N분". 출처: admin/payments/page.tsx
export function formatElapsed(min: number): string {
  if (min < 1) return '방금';
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}
