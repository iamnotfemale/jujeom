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
    <div className="min-h-[100dvh] bg-[var(--paper)] flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[400px] bg-[var(--surface)] rounded-[var(--r-xl)] px-7 py-8 flex flex-col gap-2 shadow-[var(--shadow-2)] border border-[var(--border)]"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-[42px] h-[42px] rounded-[var(--r-sm)] bg-[var(--ink-900)] text-[var(--neon)] flex items-center justify-center font-extrabold text-lg">
            주
          </div>
          <div>
            <div className="text-[15px] font-bold text-[var(--ink-900)] leading-[1.2]">주점</div>
            <div className="text-xs text-[var(--text-3)] mt-[2px]">관리자 콘솔</div>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-[var(--ink-900)] tracking-[-0.02em] mt-2 mb-1">회원가입</h1>
        <p className="text-[13px] text-[var(--text-3)] mb-4">축제 주점을 이 계정으로 관리하게 됩니다.</p>

        <label className="text-xs font-semibold text-[var(--text-2)] mt-[10px]">이메일</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-[14px] py-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-900)] text-[15px] font-[var(--f-sans)] outline-none"
          placeholder="you@school.ac.kr"
        />

        <label className="text-xs font-semibold text-[var(--text-2)] mt-[10px]">비밀번호 (8자 이상)</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-[14px] py-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-900)] text-[15px] font-[var(--f-sans)] outline-none"
          placeholder="••••••••"
        />

        {error && (
          <div className="mt-2 px-3 py-[10px] bg-[color-mix(in_oklab,var(--crim)_10%,white)] border border-[color-mix(in_oklab,var(--crim)_30%,white)] rounded-[var(--r-sm)] text-[13px] text-[#8e0f0f]">
            {error}
          </div>
        )}
        {info && (
          <div className="mt-2 px-3 py-[10px] bg-[color-mix(in_oklab,var(--mint)_14%,white)] border border-[color-mix(in_oklab,var(--mint)_35%,white)] rounded-[var(--r-sm)] text-[13px] text-[#0e6b46]">
            {info}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-accent btn-lg btn-block mt-3"
        >
          {loading ? '가입 중…' : '가입하기'}
        </button>

        <div className="mt-4 text-[13px] text-[var(--text-3)] text-center">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-[var(--ink-900)] no-underline font-bold">
            로그인
          </Link>
        </div>
      </form>
    </div>
  );
}
