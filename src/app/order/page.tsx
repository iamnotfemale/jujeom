'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import ClosedGate from '@/components/ClosedGate';

function LandingContent() {
  const searchParams = useSearchParams();
  const table = searchParams.get('table') || '1';
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [storeName, setStoreName] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [welcomeText, setWelcomeText] = useState('');
  const [welcomeHighlight, setWelcomeHighlight] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [orderHistory, setOrderHistory] = useState<{ id: number; order_number: string; created_at: string; status: string; items: string; final_amount: number }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('store_settings').select('store_name, is_open, welcome_text, welcome_highlight').limit(1).single();
      if (data) {
        setStoreName(data.store_name || '주점');
        setIsOpen(data.is_open ?? null);
        setWelcomeText(data.welcome_text || '어서 오세요');
        setWelcomeHighlight(data.welcome_highlight || '');
      } else {
        setStoreName('주점');
        setWelcomeText('어서 오세요');
      }
      setSettingsLoaded(true);
    })();
  }, []);

  // Clear this table's cart when the landing page mounts (fresh entry via QR).
  useEffect(() => {
    try {
      localStorage.removeItem(`cart:table:${table}`);
    } catch { /* ignore */ }
  }, [table]);

  // 이 테이블의 주문 기록 조회
  useEffect(() => {
    (async () => {
      const tableNum = Number(table);
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, created_at, status, final_amount, table_number')
        .eq('table_number', tableNum)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!orders || orders.length === 0) { setOrderHistory([]); return; }
      const orderIds = orders.map((o: { id: number }) => o.id);
      const { data: allItems } = await supabase
        .from('order_items')
        .select('order_id, menu_name, quantity')
        .in('order_id', orderIds);
      const itemsMap: Record<number, string> = {};
      for (const it of allItems ?? []) {
        const label = it.quantity > 1 ? `${it.menu_name} x${it.quantity}` : it.menu_name;
        itemsMap[it.order_id] = itemsMap[it.order_id] ? `${itemsMap[it.order_id]}, ${label}` : label;
      }
      setOrderHistory(orders.map((o: { id: number; order_number: string; created_at: string; status: string; final_amount: number }) => ({
        ...o,
        items: itemsMap[o.id] ?? '-',
      })));
    })();
  }, [table]);

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

  if (!settingsLoaded) {
    return (
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
    );
  }

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
            {(() => {
              if (!welcomeHighlight || !welcomeText.includes(welcomeHighlight)) return welcomeText;
              const parts = welcomeText.split(welcomeHighlight);
              return (
                <>
                  {parts[0]}
                  <span style={{ color: 'var(--neon-ink)', position: 'relative' }}>
                    <span style={{ background: 'linear-gradient(transparent 60%, var(--neon) 60%)', padding: '0 2px' }}>
                      {welcomeHighlight}
                    </span>
                  </span>
                  {parts.slice(1).join(welcomeHighlight)}
                </>
              );
            })()}
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

        {/* Order history */}
        {orderHistory.length > 0 && (
          <div style={{ width: '100%', marginBottom: 24 }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                width: '100%', padding: '12px 16px',
                borderRadius: 'var(--r-md)', border: '1px solid var(--ink-100)',
                background: 'var(--white)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontFamily: 'var(--f-sans)', fontSize: 14, fontWeight: 600, color: 'var(--ink-600)',
              }}
            >
              <span>이 테이블 주문 기록 ({orderHistory.length}건)</span>
              <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>{showHistory ? '접기 ▲' : '보기 ▼'}</span>
            </button>
            {showHistory && (
              <div style={{
                marginTop: 8, borderRadius: 'var(--r-md)', border: '1px solid var(--ink-100)',
                background: 'var(--white)', overflow: 'hidden',
              }}>
                {orderHistory.map((o) => {
                  const time = new Date(o.created_at);
                  const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
                  const statusLabel: Record<string, string> = {
                    pending: '대기', accepted: '접수', cooking: '조리 중', ready: '완성', served: '완료', cancelled: '취소',
                  };
                  return (
                    <Link
                      key={o.id}
                      href={`/order/status?orderId=${o.id}&table=${table}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderBottom: '1px solid var(--ink-050)',
                        textDecoration: 'none', color: 'var(--text)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span className="numeric" style={{ fontSize: 13, fontWeight: 700 }}>#{o.order_number}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--r-pill)',
                            background: o.status === 'served' || o.status === 'ready' ? 'color-mix(in oklab, var(--mint) 14%, white)' :
                              o.status === 'cancelled' ? 'color-mix(in oklab, var(--crim) 14%, white)' : 'var(--ink-100)',
                            color: o.status === 'served' || o.status === 'ready' ? '#0e6b46' :
                              o.status === 'cancelled' ? '#8e0f0f' : 'var(--ink-600)',
                          }}>
                            {statusLabel[o.status] ?? o.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.items}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="numeric" style={{ fontSize: 13, fontWeight: 700 }}>{o.final_amount.toLocaleString()}원</div>
                        <div className="numeric" style={{ fontSize: 11, color: 'var(--ink-400)' }}>{timeStr}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
          방문해 주셔서 감사합니다.
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
      <ClosedGate>
        <LandingContent />
      </ClosedGate>
    </Suspense>
  );
}
