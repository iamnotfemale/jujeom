'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '../StoreProvider';

interface OrderRow {
  id: number;
  order_number: string;
  created_at: string;
  status: string;
  final_amount: number;
  items?: string;
}

function LandingContent() {
  const store = useStore();
  const searchParams = useSearchParams();
  const table = searchParams.get('table') || '1';
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 테이블 진입 시 이 테이블의 장바구니 초기화
  useEffect(() => {
    try {
      localStorage.removeItem(`cart:${store.slug}:${table}`);
    } catch {
      /* ignore */
    }
  }, [store.slug, table]);

  // 이 테이블의 주문 기록 (RLS: orders는 anon SELECT 차단 — 손님 기록 기능은
  // Phase 3에서 서명된 토큰 기반으로 복구 예정. 지금은 빈 배열)
  useEffect(() => {
    setOrderHistory([]);
  }, [table, store.id]);

  const handleCallStaff = async () => {
    setShowToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowToast(false), 2500);
    await supabase.channel(`staff-calls:${store.slug}`).send({
      type: 'broadcast',
      event: 'call',
      payload: { table, time: new Date().toISOString() },
    });
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const closed = !store.is_open;

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440, padding: '0 20px' }}>
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
              }}
            >
              {store.name.charAt(0)}
            </div>
            <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--ink-900)' }}>
              {store.name}
            </span>
          </div>
          <div
            className={closed ? 'badge badge-coral' : 'badge badge-mint'}
            style={{ fontSize: 12 }}
          >
            {closed ? '영업 종료' : '운영 중'}
          </div>
        </header>

        <section style={{ textAlign: 'center', marginTop: 48, marginBottom: 32 }}>
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
              color: 'var(--ink-900)',
              margin: 0,
            }}
          >
            어서 오세요
          </h1>
        </section>

        <div
          style={{
            width: '100%',
            borderRadius: 'var(--r-lg)',
            background: 'var(--ink-900)',
            padding: '28px 24px',
            marginBottom: 24,
          }}
        >
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
          </div>
          <div
            className="numeric"
            style={{ fontSize: 48, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}
          >
            {table}
          </div>
          <div style={{ fontSize: 15, color: 'var(--ink-400)', marginTop: 4 }}>
            {table}번 테이블
          </div>
        </div>

        {closed ? (
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--r-md)',
              background: 'color-mix(in oklab, var(--coral) 12%, white)',
              border: '1px solid var(--coral)',
              color: '#8e0f0f',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            현재 영업이 종료되어 주문을 받을 수 없습니다.
          </div>
        ) : (
          <Link
            href={`/s/${store.slug}/order/menu?table=${table}`}
            className="btn btn-accent btn-lg btn-block"
            style={{ textDecoration: 'none', fontSize: 17, fontWeight: 700, marginBottom: 12 }}
          >
            주문하기
          </Link>
        )}

        <button
          className="btn btn-ghost btn-block"
          style={{ marginBottom: 32 }}
          onClick={handleCallStaff}
          disabled={closed}
        >
          직원 호출
        </button>

        {orderHistory.length > 0 && (
          <div style={{ width: '100%', marginBottom: 24 }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--ink-100)',
                background: 'var(--white)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink-600)',
              }}
            >
              이 테이블 주문 기록 ({orderHistory.length}건) {showHistory ? '▲' : '▼'}
            </button>
          </div>
        )}

        <p
          style={{
            fontSize: 13,
            color: 'var(--ink-400)',
            textAlign: 'center',
            paddingBottom: 40,
          }}
        >
          방문해 주셔서 감사합니다.
        </p>
      </div>

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
            fontSize: 14,
            fontWeight: 600,
            zIndex: 50,
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
