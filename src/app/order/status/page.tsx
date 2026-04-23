'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderStatus, ServingMode } from '@/lib/database.types';

/* ── Status config (serving_mode별 ready 문구 분기) ── */
const buildStatusMap = (mode: ServingMode): Record<OrderStatus, { emoji: string; title: string; hint: string; eta: string; step: number }> => ({
  pending:   { emoji: '🔔', title: '접수 대기 중',  hint: '주문을 확인하고 있어요',       eta: '잠시만 기다려 주세요', step: 0 },
  accepted:  { emoji: '✅', title: '접수 완료!',    hint: '주문이 확인되었어요',          eta: '약 10~15분 소요',       step: 1 },
  cooking:   { emoji: '🔥', title: '조리 중',       hint: '맛있게 만들고 있어요',         eta: '곧 완성돼요!',          step: 2 },
  ready:     mode === 'table'
    ? { emoji: '🔔', title: '완성!',   hint: '곧 자리로 가져다드릴게요',   eta: '', step: 3 }
    : { emoji: '🎉', title: '완성!',   hint: '픽업대에서 가져가세요',      eta: '', step: 3 },
  served:    { emoji: '😋', title: '수령 완료',     hint: '맛있게 드세요!',              eta: '',                     step: 3 },
  cancelled: { emoji: '❌', title: '주문 취소',     hint: '주문이 취소되었어요',          eta: '',                     step: -1 },
});
const STEPS = ['접수 완료', '조리 중', '완성!'];
const CONFETTI_COLORS = [
  '#FFE24B', '#FF5A44', '#2ECB8B', '#FFA63D', '#0064FF',
  '#E53535', '#FFD700', '#00C9A7', '#FF6B6B', '#845EF7',
  '#FF9FF3', '#48DBFB',
];

/* ── Component ──────────────────────────────── */
export default function OrderStatusPageWrapper() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--f-sans)' }}>로딩 중...</div>}>
      <OrderStatusPage />
    </Suspense>
  );
}

function OrderStatusPage() {
  const searchParams = useSearchParams();
  const orderId = Number(searchParams.get('orderId') || '0');
  const tableNumber = Number(searchParams.get('table') || '1');

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [showReadyPopup, setShowReadyPopup] = useState(false);
  const [servingMode, setServingMode] = useState<ServingMode>('pickup');

  /* ── Fetch initial data ────────────────────── */
  useEffect(() => {
    if (!orderId) return;
    const fetchOrder = async () => {
      const { data } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (data) setOrder(data);
    };
    const fetchItems = async () => {
      const { data } = await supabase.from('order_items').select('*').eq('order_id', orderId);
      if (data) setItems(data);
    };
    fetchOrder();
    fetchItems();
    (async () => {
      const { data } = await supabase.from('store_settings').select('serving_mode').limit(1).single();
      if (data?.serving_mode === 'table' || data?.serving_mode === 'pickup') {
        setServingMode(data.serving_mode);
      }
    })();
  }, [orderId]);

  /* ── Realtime subscription ─────────────────── */
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        payload => {
          const updated = payload.new as Order;
          setOrder(updated);
          if (updated.status === 'ready') setShowReadyPopup(true);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  /* ── Derived values ────────────────────────── */
  const status = order?.status ?? 'pending';
  const statusMap = buildStatusMap(servingMode);
  const cfg = statusMap[status];
  const stepIndex = cfg.step; // 0-3

  /* progress bar width: step 0 → 0%, 1 → 33%, 2 → 66%, 3 → 100% */
  const progressPct = stepIndex <= 0 ? 0 : Math.min(100, Math.round((stepIndex / 3) * 100));

  /* ── Confetti spans ────────────────────────── */
  const confettiSpans = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left: `${Math.random() * 100}%`,
        delay: `${(Math.random() * 2).toFixed(2)}s`,
        size: 6 + Math.random() * 6,
        duration: `${(2 + Math.random() * 2).toFixed(2)}s`,
      })),
    [],
  );

  if (!orderId) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
        주문 정보를 찾을 수 없어요
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(420px) rotate(720deg); opacity: 0; }
        }
        @keyframes wobble {
          0%, 100% { transform: rotate(-8deg) scale(1); }
          25% { transform: rotate(8deg) scale(1.1); }
          50% { transform: rotate(-6deg) scale(1.05); }
          75% { transform: rotate(6deg) scale(1.08); }
        }
        .confetti-piece {
          position: absolute;
          top: -10px;
          border-radius: 2px;
          animation: fall linear forwards;
        }
      `}</style>

      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ─────────────────────────── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>
            주문번호 <span className="numeric">#{order?.order_number ?? '---'}</span>
          </div>
          <span className="badge badge-ink" style={{ fontSize: 12 }}>
            테이블 {tableNumber}번
          </span>
        </header>

        {/* ── Body ─────────────────────────── */}
        <main style={{ flex: 1, padding: '16px 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Big status card ─────────────── */}
          <section style={{
            background: 'var(--ink-900)',
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,226,75,.06) 0 10px, transparent 10px 20px)',
            borderRadius: 'var(--r-lg)', padding: '28px 20px',
            textAlign: 'center', color: '#fff',
          }}>
            <div style={{
              fontSize: 48, marginBottom: 8,
              animation: 'sizzle 1.2s ease-in-out infinite',
              display: 'inline-block',
            }}>
              {cfg.emoji}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{cfg.title}</div>
            <div style={{ fontSize: 14, color: 'var(--ink-300)', marginBottom: 4 }}>{cfg.hint}</div>
            {cfg.eta && (
              <div style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600 }}>{cfg.eta}</div>
            )}
          </section>

          {/* ── Stepper ────────────────────── */}
          <section style={{
            background: 'var(--surface)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border)', padding: '20px 16px',
          }}>
            {/* progress bar */}
            <div style={{
              height: 6, borderRadius: 3, background: 'var(--ink-100)',
              marginBottom: 16, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, var(--mint), var(--amber))',
                transition: 'width .6s ease',
                animation: 'shimmer 2s ease-in-out infinite',
              }} />
            </div>
            {/* step dots */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {STEPS.map((label, i) => {
                const stepNum = i + 1;
                const done = stepIndex >= stepNum;
                const current = stepIndex === stepNum || (stepIndex === 0 && i === 0);
                return (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                      background: done ? 'var(--mint)' : current && stepIndex > 0 ? 'var(--amber)' : 'var(--ink-100)',
                      color: done || (current && stepIndex > 0) ? '#fff' : 'var(--text-3)',
                      animation: current && stepIndex > 0 ? 'ping 1.5s ease-in-out infinite' : 'none',
                      transition: 'all .3s ease',
                    }}>
                      {done ? '✓' : stepNum}
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: done || current ? 700 : 500,
                      color: done ? 'var(--mint)' : current && stepIndex > 0 ? 'var(--amber)' : 'var(--text-3)',
                    }}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Order summary card ─────────── */}
          <section style={{
            background: 'var(--surface)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 15 }}>
              주문 내역
            </div>
            {items.map(item => (
              <div key={item.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderBottom: '1px solid var(--ink-100)',
              }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{item.menu_name}</span>
                  <span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 6 }}>x{item.quantity}</span>
                  {item.options && (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{item.options}</div>
                  )}
                </div>
                <span className="numeric" style={{ fontWeight: 600, fontSize: 14, flexShrink: 0 }}>
                  {(item.unit_price * item.quantity).toLocaleString()}원
                </span>
              </div>
            ))}
            {/* total */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '14px 16px',
              fontWeight: 700, fontSize: 16, background: 'var(--surface-2)',
            }}>
              <span>합계</span>
              <span className="numeric">{(order?.final_amount ?? 0).toLocaleString()}원</span>
            </div>
          </section>

          {/* ── Note card ──────────────────── */}
          {order?.note && (
            <section style={{
              background: 'var(--surface)', borderRadius: 'var(--r-lg)',
              border: '1px solid var(--border)', padding: 16,
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>요청 사항</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>{order.note}</div>
            </section>
          )}
        </main>

        {/* ── Bottom button ────────────────── */}
        <footer style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
          padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          display: 'flex', gap: 10,
        }}>
          <Link
            href={`/order?table=${tableNumber}`}
            className="btn btn-ghost btn-lg"
            style={{ textDecoration: 'none', flex: 'none', padding: '0 18px' }}
          >
            처음으로
          </Link>
          <Link
            href={`/order/menu?table=${tableNumber}`}
            className="btn btn-primary btn-lg"
            style={{ textDecoration: 'none', flex: 1 }}
          >
            추가 주문하기
          </Link>
        </footer>

        {/* ── Ready popup overlay ──────────── */}
        {showReadyPopup && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(14,18,32,.6)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'fadeIn .3s ease',
              padding: 24,
            }}
            onClick={() => setShowReadyPopup(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'relative', width: '100%', maxWidth: 340,
                background: 'var(--neon)', borderRadius: 'var(--r-xl)',
                padding: '36px 24px 28px', textAlign: 'center',
                boxShadow: 'var(--shadow-3)',
                animation: 'pop .4s cubic-bezier(.34,1.56,.64,1)',
                overflow: 'hidden',
              }}
            >
              {/* confetti */}
              {confettiSpans.map(c => (
                <span
                  key={c.id}
                  className="confetti-piece"
                  style={{
                    left: c.left,
                    width: c.size,
                    height: c.size,
                    background: c.color,
                    animationDuration: c.duration,
                    animationDelay: c.delay,
                  }}
                />
              ))}

              {/* wobble emoji */}
              <div style={{
                fontSize: 56, marginBottom: 12,
                animation: 'wobble 1.5s ease-in-out infinite',
                display: 'inline-block',
              }}>
                🎉
              </div>

              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--neon-ink)', marginBottom: 6 }}>
                {servingMode === 'table' ? '완성됐어요!' : '나왔어요! 가져가세요'}
              </div>
              <div style={{ fontSize: 14, color: 'var(--neon-ink)', opacity: 0.7, marginBottom: 20 }}>
                {servingMode === 'table'
                  ? '곧 자리로 가져다드릴게요'
                  : '주문하신 메뉴가 완성되었어요'}
              </div>

              {/* pickup / serving info */}
              <div style={{
                background: 'var(--ink-900)', borderRadius: 'var(--r-md)',
                padding: '14px 16px', color: '#fff', marginBottom: 20,
              }}>
                <div style={{ fontSize: 12, color: 'var(--ink-300)', marginBottom: 4 }}>
                  {servingMode === 'table' ? '안내' : '픽업 위치'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {servingMode === 'table' ? '직원이 곧 서빙해드립니다' : '카운터 앞 픽업대'}
                </div>
              </div>

              {/* close */}
              <button
                className="btn btn-lg btn-block"
                onClick={() => setShowReadyPopup(false)}
                style={{ background: 'var(--neon-ink)', color: 'var(--neon)' }}
              >
                확인했어요
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
