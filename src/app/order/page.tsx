'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

function LandingContent() {
  const searchParams = useSearchParams();
  const table = searchParams.get('table') || '1';
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [storeName, setStoreName] = useState<string>('주점');
  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('store_settings').select('store_name, is_open').limit(1).single();
      if (data) {
        if (data.store_name) setStoreName(data.store_name);
        setIsOpen(data.is_open ?? null);
      }
    })();
  }, []);

  const handleCallStaff = async () => {
    setShowToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowToast(false), 2500);
    await supabase.channel('staff-calls').send({
      type: 'broadcast',
      event: 'call',
      payload: { table: table, time: new Date().toISOString() },
    });
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--paper)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Background gradients */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 600px 400px at 20% 20%, rgba(255,226,75,0.08), transparent), radial-gradient(ellipse 500px 500px at 80% 70%, rgba(255,90,68,0.06), transparent)',
        }}
      />

      {/* Confetti dots */}
      {[
        { top: '8%', left: '12%', bg: 'var(--neon)', size: 6, opacity: 0.5 },
        { top: '14%', right: '18%', bg: 'var(--coral)', size: 5, opacity: 0.4 },
        { top: '30%', left: '8%', bg: 'var(--mint)', size: 4, opacity: 0.35 },
        { top: '45%', right: '10%', bg: 'var(--neon)', size: 5, opacity: 0.3 },
        { top: '60%', left: '15%', bg: 'var(--coral)', size: 4, opacity: 0.25 },
        { top: '75%', right: '20%', bg: 'var(--mint)', size: 6, opacity: 0.3 },
        { top: '22%', right: '8%', bg: 'var(--amber)', size: 4, opacity: 0.3 },
        { top: '55%', left: '5%', bg: 'var(--amber)', size: 5, opacity: 0.2 },
      ].map((dot, i) => (
        <div
          key={i}
          style={{
            position: 'fixed',
            top: dot.top,
            left: dot.left,
            right: dot.right,
            width: dot.size,
            height: dot.size,
            borderRadius: '50%',
            background: dot.bg,
            opacity: dot.opacity,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Content wrapper */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 440,
          padding: '0 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingTop: 20,
            paddingBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Logo */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--r-sm)',
                background: 'var(--ink-900)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--neon)',
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: '-0.02em',
              }}
            >
              {storeName.charAt(0)}
            </div>
            <span
              style={{
                fontWeight: 700,
                fontSize: 17,
                color: 'var(--ink-900)',
                letterSpacing: '-0.02em',
              }}
            >
              {storeName}
            </span>
          </div>

          {/* Status chip */}
          <div className={isOpen === false ? 'badge badge-coral' : 'badge badge-mint'} style={{ fontSize: 12 }}>
            {isOpen === false ? '영업 종료' : '운영 중'}
          </div>
        </header>

        {/* Hero */}
        <section
          style={{
            textAlign: 'center',
            marginTop: 48,
            marginBottom: 32,
          }}
        >
          {/* Eyebrow badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              borderRadius: 'var(--r-pill)',
              background: 'var(--ink-050)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink-600)',
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 15 }}>🎉</span>
            QR 테이블 입장 완료
          </div>

          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              lineHeight: 1.35,
              letterSpacing: '-0.03em',
              color: 'var(--ink-900)',
              margin: '0 0 0',
            }}
          >
            어서 오세요,
            <br />
            <span style={{ color: 'var(--neon-ink)', position: 'relative' }}>
              <span
                style={{
                  background: 'linear-gradient(transparent 60%, var(--neon) 60%)',
                  padding: '0 2px',
                }}
              >
                즐거운 한 잔
              </span>
            </span>{' '}
            되세요.
          </h1>
        </section>

        {/* Table card */}
        <div
          style={{
            width: '100%',
            borderRadius: 'var(--r-lg)',
            background: 'var(--ink-900)',
            padding: '28px 24px',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: 24,
          }}
        >
          {/* Stripe pattern overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'repeating-linear-gradient(45deg, transparent 0 8px, rgba(255,255,255,0.03) 8px 16px)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--ink-400)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                TABLE
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--mint)',
                    display: 'inline-block',
                    animation: 'pulse 2s infinite',
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--mint)',
                    fontWeight: 600,
                  }}
                >
                  착석 중
                </span>
              </div>
            </div>
            <div
              className="numeric"
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.1,
                letterSpacing: '-0.04em',
              }}
            >
              {table}
            </div>
            <div
              style={{
                fontSize: 15,
                color: 'var(--ink-400)',
                fontWeight: 500,
                marginTop: 4,
              }}
            >
              {table}번 테이블
            </div>
          </div>
        </div>

        {/* CTA buttons */}
        <Link
          href={`/order/menu?table=${table}`}
          className="btn btn-accent btn-lg btn-block"
          style={{
            textDecoration: 'none',
            fontSize: 17,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          주문하기
        </Link>

        <button
          className="btn btn-ghost btn-block"
          style={{ marginBottom: 32 }}
          onClick={handleCallStaff}
        >
          직원 호출
        </button>

        {/* Footer hint */}
        <p
          style={{
            fontSize: 13,
            color: 'var(--ink-400)',
            textAlign: 'center',
            lineHeight: 1.6,
            paddingBottom: 40,
          }}
        >
          메뉴를 선택하고 주문하면
          <br />
          자리에서 바로 받으실 수 있어요.
        </p>
      </div>

      {/* Inline toast */}
      {showToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--ink-900)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 'var(--r-pill)',
            boxShadow: 'var(--shadow-2)',
            fontSize: 14,
            fontWeight: 600,
            zIndex: 50,
            whiteSpace: 'nowrap',
          }}
        >
          직원을 호출했습니다. 잠시만 기다려 주세요!
        </div>
      )}
    </div>
  );
}

export default function OrderLandingPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--paper)',
          }}
        >
          <div style={{ color: 'var(--ink-400)', fontSize: 14 }}>로딩 중...</div>
        </div>
      }
    >
      <LandingContent />
    </Suspense>
  );
}
