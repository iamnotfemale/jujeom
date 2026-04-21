const attempts = new Map<string, { count: number; lockUntil: number }>();

export function checkPinRateLimit(ip: string): { locked: boolean; remainingMs: number } {
  const a = attempts.get(ip);
  if (!a) return { locked: false, remainingMs: 0 };
  if (Date.now() < a.lockUntil) {
    return { locked: true, remainingMs: a.lockUntil - Date.now() };
  }
  if (a.lockUntil > 0 && Date.now() >= a.lockUntil) {
    attempts.delete(ip);
  }
  return { locked: false, remainingMs: 0 };
}

export function recordPinFailure(ip: string): { lockedNow: boolean } {
  const a = attempts.get(ip) ?? { count: 0, lockUntil: 0 };
  a.count++;
  if (a.count >= 5) {
    a.lockUntil = Date.now() + 10 * 60_000; // 10분
    a.count = 0;
    attempts.set(ip, a);
    return { lockedNow: true };
  }
  attempts.set(ip, a);
  return { lockedNow: false };
}

export function clearPinFailures(ip: string) {
  attempts.delete(ip);
}
