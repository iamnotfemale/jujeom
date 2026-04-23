/**
 * 토스 딥링크(supertoss://send?bank=...)가 인식하는 한글 단축형 은행명과
 * 관리자 UI용 사용자 친화 라벨을 함께 관리한다.
 *
 * - code: DB에 저장되는 값이자 토스 딥링크에 그대로 전달되는 값
 * - label: 관리자 설정 드롭다운에 표시되는 정식 명칭
 */
export interface BankOption {
  code: string;
  label: string;
}

export const BANK_OPTIONS: BankOption[] = [
  { code: '카카오뱅크', label: '카카오뱅크' },
  { code: '토스뱅크', label: '토스뱅크' },
  { code: '케이뱅크', label: '케이뱅크' },
  { code: '국민', label: 'KB국민은행' },
  { code: '신한', label: '신한은행' },
  { code: '우리', label: '우리은행' },
  { code: '하나', label: '하나은행' },
  { code: '기업', label: 'IBK기업은행' },
  { code: '농협', label: 'NH농협은행' },
  { code: 'SC제일', label: 'SC제일은행' },
  { code: '씨티', label: '한국씨티은행' },
  { code: '산업', label: 'KDB산업은행' },
  { code: '수협', label: '수협은행' },
  { code: '부산', label: '부산은행' },
  { code: '대구', label: 'iM뱅크(대구은행)' },
  { code: '광주', label: '광주은행' },
  { code: '전북', label: '전북은행' },
  { code: '경남', label: '경남은행' },
  { code: '제주', label: '제주은행' },
  { code: '새마을', label: '새마을금고' },
  { code: '신협', label: '신협' },
  { code: '우체국', label: '우체국' },
];

/**
 * 사용자 입력이나 DB의 레거시 값을 토스가 인식하는 code로 정규화한다.
 * 매칭 실패 시 trim한 원본을 그대로 반환 (토스가 최종 선택 페이지로 폴백).
 */
const ALIAS_MAP: Record<string, string> = {
  // 레거시 별칭
  '카카오': '카카오뱅크',
  '토스': '토스뱅크',
  'K뱅크': '케이뱅크',
  'KB국민은행': '국민',
  '국민은행': '국민',
  '신한은행': '신한',
  '우리은행': '우리',
  '하나은행': '하나',
  'KEB하나은행': '하나',
  'IBK기업은행': '기업',
  '기업은행': '기업',
  'NH농협은행': '농협',
  '농협은행': '농협',
  'SC제일은행': 'SC제일',
  '제일은행': 'SC제일',
  '한국씨티은행': '씨티',
  '씨티은행': '씨티',
  'iM뱅크': '대구',
  '대구은행': '대구',
  '부산은행': '부산',
  '광주은행': '광주',
  '전북은행': '전북',
  '경남은행': '경남',
  '제주은행': '제주',
  '새마을금고': '새마을',
  '수협은행': '수협',
  'KDB산업은행': '산업',
  '산업은행': '산업',
};

export function normalizeBankName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // code로 일치하는 경우 그대로 반환
  if (BANK_OPTIONS.some((b) => b.code === trimmed)) return trimmed;
  // 별칭 매핑
  return ALIAS_MAP[trimmed] ?? trimmed;
}
