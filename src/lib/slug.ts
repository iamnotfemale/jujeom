/**
 * 가게 이름에서 slug 생성. 한글은 제거/음차하지 않고 숫자+영문만 남긴 뒤,
 * 빈 결과면 호출자가 랜덤 suffix를 붙여 유일성 확보.
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export function slugify(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.slice(0, 48);
}

export function isValidSlug(s: string): boolean {
  return SLUG_RE.test(s);
}

export function randomSuffix(length = 4): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
