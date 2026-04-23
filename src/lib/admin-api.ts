export async function adminApi<T = unknown>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {},
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(path, {
      method: options.method ?? 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
    });
    if (res.status === 401) {
      // Supabase 세션 만료 → 로그인으로
      if (typeof window !== 'undefined') {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
      }
      return { data: null, error: 'unauthorized' };
    }
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error ?? 'unknown' };
    return { data: json as T, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}
