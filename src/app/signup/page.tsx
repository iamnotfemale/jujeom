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
    // 이메일 확인이 켜져 있으면 session이 null, 꺼져 있으면 즉시 로그인.
    if (data.session) {
      router.replace('/dashboard');
      router.refresh();
    } else {
      setInfo('가입 완료! 이메일로 보낸 확인 링크를 클릭해 주세요.');
    }
  };

  return (
    <div style={styles.wrap}>
      <form onSubmit={onSubmit} style={styles.card}>
        <h1 style={styles.title}>회원가입</h1>
        <label style={styles.label}>이메일</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />
        <label style={styles.label}>비밀번호 (8자 이상)</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />
        {error && <div style={styles.error}>{error}</div>}
        {info && <div style={styles.info}>{info}</div>}
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? '가입 중…' : '가입하기'}
        </button>
        <div style={styles.footer}>
          이미 계정이 있으신가요? <Link href="/login" style={styles.link}>로그인</Link>
        </div>
      </form>
    </div>
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
  info: {
    marginTop: 4,
    padding: '10px 12px',
    background: 'rgba(70,200,120,0.15)',
    border: '1px solid rgba(70,200,120,0.4)',
    borderRadius: 8,
    fontSize: 13,
    color: '#a7f3c7',
  },
  footer: { marginTop: 12, fontSize: 13, color: 'var(--text-3, #9aa0b3)', textAlign: 'center' },
  link: { color: 'var(--accent, #3B82F6)', textDecoration: 'none' },
};
