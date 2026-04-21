import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * Write an audit log row. Best-effort — swallows errors so that a missing
 * audit_log table cannot block a successful admin action.
 */
export async function writeAuditLog(
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any> = {},
  ip: string = 'unknown',
) {
  try {
    await supabaseAdmin.from('audit_log').insert({
      action,
      details,
      ip,
    });
  } catch {
    // ignore
  }
}

export function clientIp(req: { headers: Headers }): string {
  return req.headers.get('x-forwarded-for') ?? 'unknown';
}
