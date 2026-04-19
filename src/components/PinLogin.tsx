'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface PinLoginProps {
  onSuccess: () => void;
}

export default function PinLogin({ onSuccess }: PinLoginProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [failures, setFailures] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [storeName, setStoreName] = useState('주점');
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Fetch store name on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('store_settings').select('store_name').limit(1).single();
        if (data?.store_name) setStoreName(data.store_name);
      } catch { /* ignore */ }
    })();
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockUntil) {
      const tick = () => {
        const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          setLockUntil(null);
          setLockCountdown(0);
          if (timerRef.current) clearInterval(timerRef.current);
        } else {
          setLockCountdown(remaining);
        }
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [lockUntil]);

  const handleSubmit = useCallback(async () => {
    if (!pin || pin.length < 4 || lockUntil) return;
    setLoading(true);
    setError('');

    try {
      const { data } = await supabase
        .from('store_settings')
        .select('pin')
        .limit(1)
        .single();

      if (data && data.pin === pin) {
        sessionStorage.setItem('admin_auth', 'true');
        onSuccess();
      } else {
        const newFailures = failures + 1;
        setFailures(newFailures);
        setPin('');
        if (newFailures >= 3) {
          setLockUntil(Date.now() + 10000);
          setFailures(0);
          setError('입력 횟수 초과. 10초 후 다시 시도해주세요.');
        } else {
          setError('PIN이 올바르지 않습니다');
        }
      }
    } catch {
      setError('서버 연결 오류');
    } finally {
      setLoading(false);
    }
  }, [pin, failures, lockUntil, onSuccess]);

  const handleKeyPress = (digit: string) => {
    if (lockUntil) return;
    setError('');
    if (digit === 'back') {
      setPin((p) => p.slice(0, -1));
    } else if (pin.length < 6) {
      setPin((p) => p + digit);
    }
  };

  // Submit on Enter key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleSubmit();
      else if (e.key === 'Backspace') handleKeyPress('back');
      else if (/^[0-9]$/.test(e.key)) handleKeyPress(e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const isLocked = !!lockUntil;

  return (
    <div style={s.frame}>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logo}>{storeName.charAt(0)}</div>
        <div style={s.title}>{storeName}</div>
        <div style={s.subtitle}>관리자 인증</div>

        {/* PIN dots */}
        <div style={s.dotsRow}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                ...s.dot,
                background: i < pin.length ? 'var(--neon)' : 'rgba(255,255,255,.12)',
                boxShadow: i < pin.length ? '0 0 8px var(--neon)' : 'none',
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={s.error}>
            {error}
            {isLocked && <span style={{ fontVariantNumeric: 'tabular-nums' }}> ({lockCountdown}s)</span>}
          </div>
        )}

        {/* Number pad */}
        <div style={s.pad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key) => {
            if (key === '') return <div key="empty" />;
            return (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                disabled={isLocked}
                style={{
                  ...s.padBtn,
                  opacity: isLocked ? 0.3 : 1,
                }}
              >
                {key === 'back' ? '\u232B' : key}
              </button>
            );
          })}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={pin.length < 4 || loading || isLocked}
          style={{
            ...s.submit,
            opacity: pin.length < 4 || loading || isLocked ? 0.4 : 1,
          }}
        >
          {loading ? '확인 중...' : '확인'}
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  frame: {
    minHeight: '100vh',
    background: 'var(--ink-900)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 'var(--r-md)',
    background: 'var(--neon)',
    color: 'var(--ink-900)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,.45)',
    fontWeight: 500,
    marginBottom: 32,
  },
  dotsRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    transition: 'all .15s ease',
  },
  error: {
    fontSize: 13,
    color: 'var(--crim, #E53535)',
    fontWeight: 600,
    marginTop: 4,
    marginBottom: 4,
    minHeight: 20,
    textAlign: 'center',
  },
  pad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    width: '100%',
    maxWidth: 260,
    marginTop: 20,
  },
  padBtn: {
    height: 56,
    borderRadius: 'var(--r-md)',
    border: '1px solid rgba(255,255,255,.1)',
    background: 'rgba(255,255,255,.06)',
    color: '#fff',
    fontSize: 22,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    transition: 'background .12s ease',
  },
  submit: {
    width: '100%',
    maxWidth: 260,
    height: 48,
    marginTop: 20,
    borderRadius: 'var(--r-md)',
    border: 0,
    background: 'var(--neon)',
    color: 'var(--ink-900)',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    transition: 'opacity .12s ease',
  },
};
