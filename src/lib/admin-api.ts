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
      // 세션 만료 → 로그인 페이지로
      if (typeof window !== 'undefined') window.location.reload();
      return { data: null, error: 'unauthorized' };
    }
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error ?? 'unknown' };
    return { data: json as T, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}
