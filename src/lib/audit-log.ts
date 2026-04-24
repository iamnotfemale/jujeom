import { supabaseAdmin } from '@/lib/supabase-server';

/** audit_log row를 기록한다. 실패는 무시 — 주 동작을 막지 않게. */
export async function writeAuditLog(
  action: string,
  metadata: Record<string, unknown> = {},
  ip: string = 'unknown',
  actorId: string = 'system',
) {
  try {
    await supabaseAdmin.from('audit_log').insert({
      actor: actorId,
      action,
      metadata: { ...metadata, ip },
    });
  } catch {
    // ignore
  }
}

export function clientIp(req: { headers: Headers }): string {
  return req.headers.get('x-forwarded-for') ?? 'unknown';
}
