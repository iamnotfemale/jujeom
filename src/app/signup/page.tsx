'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.replace('/dashboard');
      router.refresh();
    } else {
      setInfo('가입 완료! 이메일로 보낸 확인 링크를 클릭해 주세요.');
    }
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

        <h1 style={s.title}>회원가입</h1>
        <p style={s.sub}>축제 주점을 이 계정으로 관리하게 됩니다.</p>

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

        <label style={s.label}>비밀번호 (8자 이상)</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={s.input}
          placeholder="••••••••"
        />

        {error && <div style={s.error}>{error}</div>}
        {info && <div style={s.info}>{info}</div>}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-accent btn-lg btn-block"
          style={{ marginTop: 12 }}
        >
          {loading ? '가입 중…' : '가입하기'}
        </button>

        <div style={s.footer}>
          이미 계정이 있으신가요?{' '}
          <Link href="/login" style={s.link}>
            로그인
          </Link>
        </div>
      </form>
    </div>
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
  brandRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
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
  },
  info: {
    marginTop: 8,
    padding: '10px 12px',
    background: 'color-mix(in oklab, var(--mint) 14%, white)',
    border: '1px solid color-mix(in oklab, var(--mint) 35%, white)',
    borderRadius: 'var(--r-sm)',
    fontSize: 13,
    color: '#0e6b46',
  },
  footer: { marginTop: 16, fontSize: 13, color: 'var(--text-3)', textAlign: 'center' },
  link: { color: 'var(--ink-900)', textDecoration: 'none', fontWeight: 700 },
};
