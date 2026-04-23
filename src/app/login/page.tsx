'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <div style={styles.wrap}>
      <form onSubmit={onSubmit} style={styles.card}>
        <h1 style={styles.title}>로그인</h1>
        <label style={styles.label}>이메일</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />
        <label style={styles.label}>비밀번호</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />
        {error && <div style={styles.error}>{error}</div>}
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? '로그인 중…' : '로그인'}
        </button>
        <div style={styles.footer}>
          계정이 없으신가요? <Link href="/signup" style={styles.link}>회원가입</Link>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'var(--bg-1, #0E1220)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    background: 'var(--bg-2, #141A2E)',
    borderRadius: 16,
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    color: 'var(--text-1, #fff)',
  },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 8 },
  label: { fontSize: 13, color: 'var(--text-3, #9aa0b3)', marginTop: 8 },
  input: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid var(--border, #2a3150)',
    background: 'var(--bg-1, #0E1220)',
    color: 'var(--text-1, #fff)',
    fontSize: 15,
  },
  button: {
    marginTop: 16,
    padding: '12px 16px',
    borderRadius: 10,
    background: 'var(--accent, #3B82F6)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  },
  error: {
    marginTop: 4,
    padding: '10px 12px',
    background: 'rgba(255,70,70,0.15)',
    border: '1px solid rgba(255,70,70,0.4)',
    borderRadius: 8,
    fontSize: 13,
    color: '#ff9a9a',
  },
  footer: { marginTop: 12, fontSize: 13, color: 'var(--text-3, #9aa0b3)', textAlign: 'center' },
  link: { color: 'var(--accent, #3B82F6)', textDecoration: 'none' },
};
