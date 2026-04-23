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
    <div style={s.wrap}>
      <form onSubmit={onSubmit} style={s.card}>
        <div style={s.brandRow}>
          <div style={s.brandLogo}>주</div>
          <div>
            <div style={s.brandName}>주점</div>
            <div style={s.brandSub}>관리자 콘솔</div>
          </div>
        </div>

        <h1 style={s.title}>로그인</h1>
        <p style={s.sub}>학생회 계정으로 로그인하고 가게를 관리하세요.</p>

        <label style={s.label}>이메일</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={s.input}
          placeholder="you@school.ac.kr"
        />

        <label style={s.label}>비밀번호</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={s.input}
          placeholder="••••••••"
        />

        {error && <div style={s.error}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-accent btn-lg btn-block"
          style={{ marginTop: 12 }}
        >
          {loading ? '로그인 중…' : '로그인'}
        </button>

        <div style={s.footer}>
          계정이 없으신가요?{' '}
          <Link href="/signup" style={s.link}>
            회원가입
          </Link>
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

const s: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100dvh',
    background: 'var(--paper)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'var(--surface)',
    borderRadius: 'var(--r-xl)',
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    boxShadow: 'var(--shadow-2)',
    border: '1px solid var(--border)',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: 'var(--r-sm)',
    background: 'var(--ink-900)',
    color: 'var(--neon)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 18,
    letterSpacing: '-0.02em',
  },
  brandName: { fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', lineHeight: 1.2 },
  brandSub: { fontSize: 12, color: 'var(--text-3)', marginTop: 2 },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--ink-900)',
    letterSpacing: '-0.02em',
    margin: '8px 0 4px',
  },
  sub: { fontSize: 13, color: 'var(--text-3)', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginTop: 10 },
  input: {
    padding: '12px 14px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--ink-900)',
    fontSize: 15,
    fontFamily: 'var(--f-sans)',
    outline: 'none',
  },
  error: {
    marginTop: 8,
    padding: '10px 12px',
    background: 'color-mix(in oklab, var(--crim) 10%, white)',
    border: '1px solid color-mix(in oklab, var(--crim) 30%, white)',
    borderRadius: 'var(--r-sm)',
    fontSize: 13,
    color: '#8e0f0f',
    fontWeight: 500,
  },
  footer: {
    marginTop: 16,
    fontSize: 13,
    color: 'var(--text-3)',
    textAlign: 'center',
  },
  link: { color: 'var(--ink-900)', textDecoration: 'none', fontWeight: 700 },
};
