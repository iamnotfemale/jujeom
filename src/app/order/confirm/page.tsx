'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/* ── Types ──────────────────────────────────── */
interface CartItem {
  menuId: number;
  name: string;
  price: number;
  quantity: number;
  options?: string;
  imageUrl?: string | null;
}

const QUICK_TAGS = ['# 덜 맵게', '# 빨리 부탁드려요', '# 앞접시 추가', '# 물티슈 추가'];

/* ── Component ──────────────────────────────── */
export default function OrderConfirmPageWrapper() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--f-sans)' }}>로딩 중...</div>}>
      <OrderConfirmPage />
    </Suspense>
  );
}

function OrderConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tableNumber = Number(searchParams.get('table') || '1');

  const [items, setItems] = useState<CartItem[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [accountInfo, setAccountInfo] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [bankName, setBankName] = useState('');
  const [storeName, setStoreName] = useState<string>('주점');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);

  /* fetch store settings */
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('store_settings')
        .select('*')
        .limit(1)
        .single();
      if (data) {
        setAccountInfo(`${data.bank_name} · ${data.account_holder} ${data.account_number}`);
        setAccountNo(data.account_number || '');
        setBankName(data.bank_name || '');
        setAccountHolder(data.account_holder || '');
        if (data.store_name) setStoreName(data.store_name);
      }
    })();
  }, []);

  /* hydrate cart from sessionStorage */
  useEffect(() => {
    const raw = sessionStorage.getItem('cart');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // The menu page stores CartItem[] as { menu: Menu; quantity: number }
        // Transform to the shape this page expects
        const transformed = parsed.map((c: any) => ({
          menuId: c.menu.id,
          name: c.menu.name,
          price: c.menu.price,
          quantity: c.quantity,
          options: c.menu.options || null,
          imageUrl: c.menu.image_url || null,
        }));
        setItems(transformed);
      } catch { /* ignore */ }
    }
  }, []);

  /* ── Price helpers ─────────────────────────── */
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount = 0;
  const total = subtotal;

  /* ── Quantity controls ─────────────────────── */
  const updateQty = useCallback((menuId: number, delta: number) => {
    setItems(prev =>
      prev
        .map(it => (it.menuId === menuId ? { ...it, quantity: it.quantity + delta } : it))
        .filter(it => it.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((menuId: number) => {
    setItems(prev => prev.filter(it => it.menuId !== menuId));
  }, []);

  /* ── Tag toggle ────────────────────────────── */
  const toggleTag = (tag: string) => {
    setNote(prev => {
      if (prev.includes(tag)) return prev.replace(tag, '').replace(/\s{2,}/g, ' ').trim();
      return prev ? `${prev} ${tag}` : tag;
    });
  };

  /* ── Copy account ──────────────────────────── */
  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(accountNo);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* fallback: noop */ }
  };

  /* ── Submit order ──────────────────────────── */
  const submitOrder = async (method: 'toss' | 'transfer') => {
    if (items.length === 0 || submitting) return;
    setSubmitting(true);

    try {
      /* 1. generate order number */
      const now = new Date();
      const orderNumber = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`;

      /* 2. look up actual table ID from table number */
      const { data: tableData } = await supabase
        .from('tables')
        .select('id')
        .eq('number', tableNumber)
        .single();

      const actualTableId = tableData?.id;

      /* 3. insert order */
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          table_id: actualTableId,
          table_number: tableNumber,
          status: 'pending',
          note: note || null,
          total_amount: subtotal,
          discount_amount: 0,
          final_amount: subtotal,
        })
        .select()
        .single();

      if (orderErr || !order) throw orderErr;

      /* 4. insert order items */
      const orderItems = items.map(it => ({
        order_id: order.id,
        menu_id: it.menuId,
        menu_name: it.name,
        quantity: it.quantity,
        unit_price: it.price,
        options: it.options || null,
      }));

      const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
      if (itemsErr) throw itemsErr;

      /* 4.5. deduct stock from menus */
      try {
        for (const it of items) {
          const { data: menuData } = await supabase
            .from('menus')
            .select('stock')
            .eq('id', it.menuId)
            .single();

          if (menuData) {
            const newStock = Math.max(0, (menuData.stock ?? 0) - it.quantity);
            await supabase
              .from('menus')
              .update({ stock: newStock, is_sold_out: newStock === 0 })
              .eq('id', it.menuId);
          }
        }
      } catch (stockErr) {
        console.error('Stock deduction error (non-fatal):', stockErr);
      }

      /* 5. insert payment */
      const { error: payErr } = await supabase.from('payments').insert({
        order_id: order.id,
        amount: subtotal,
        status: 'waiting',
        method,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        confirmed_at: null,
      });
      if (payErr) throw payErr;

      /* 6. open toss deeplink if applicable */
      if (method === 'toss') {
        window.location.href = `supertoss://send?bank=${encodeURIComponent(bankName)}&accountNo=${accountNo}&amount=${subtotal}&origin=컴공주점`;
      }

      /* 7. redirect to status page */
      router.push(`/order/status?orderId=${order.id}&table=${tableNumber}`);
    } catch (err) {
      console.error('Order submit failed:', err);
      alert('주문에 실패했어요. 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  /* ── Render ────────────────────────────────── */
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ─────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href={`/order/menu?table=${tableNumber}`} style={{
          width: 36, height: 36, borderRadius: 'var(--r-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface-2)', textDecoration: 'none', color: 'var(--text)',
          fontSize: 18, flexShrink: 0,
        }}>
          ←
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>주문 확인</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{storeName} · {tableNumber}번 테이블</div>
        </div>
      </header>

      {/* ── Body ───────────────────────────── */}
      <main style={{ flex: 1, padding: '16px 16px 160px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Order items card ─────────────── */}
        <section style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 15 }}>
            주문 내역 <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>({items.length})</span>
          </div>
          {items.length === 0 && (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <span>장바구니가 비어 있어요. 메뉴를 먼저 선택해 주세요.</span>
              <Link href={`/order/menu?table=${tableNumber}`} style={{
                padding: '8px 20px', borderRadius: 'var(--r-pill)',
                background: 'var(--ink-900)', color: '#fff', fontSize: 14,
                fontWeight: 600, textDecoration: 'none',
              }}>
                메뉴 보러 가기
              </Link>
            </div>
          )}
          {items.map(item => (
            <div key={item.menuId} style={{
              display: 'flex', gap: 12, padding: '14px 16px',
              borderBottom: '1px solid var(--ink-100)',
            }}>
              {/* thumbnail placeholder */}
              <div style={{
                width: 52, height: 52, borderRadius: 'var(--r-sm)',
                background: 'var(--ink-100)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>
                🍽
              </div>
              {/* info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{item.name}</div>
                {item.options && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>{item.options}</div>
                )}
                <div className="numeric" style={{ fontSize: 14, fontWeight: 600 }}>
                  {(item.price * item.quantity).toLocaleString()}원
                </div>
              </div>
              {/* qty controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => item.quantity === 1 ? removeItem(item.menuId) : updateQty(item.menuId, -1)}
                  style={{
                    width: 30, height: 30, borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 14, color: item.quantity === 1 ? 'var(--crim)' : 'var(--text)',
                  }}
                >
                  {item.quantity === 1 ? '✕' : '−'}
                </button>
                <span className="numeric" style={{ width: 24, textAlign: 'center', fontWeight: 600, fontSize: 15 }}>
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQty(item.menuId, 1)}
                  style={{
                    width: 30, height: 30, borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 14,
                  }}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* ── Note / request ───────────────── */}
        <section style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', padding: 16,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>요청 사항</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {QUICK_TAGS.map(tag => {
              const active = note.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--r-pill)',
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    border: active ? '1px solid var(--ink-900)' : '1px solid var(--border)',
                    background: active ? 'var(--ink-900)' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--text-2)',
                    transition: 'all .15s ease',
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="추가 요청사항을 입력해 주세요"
            rows={2}
            style={{
              width: '100%', resize: 'none', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', padding: '10px 12px', fontSize: 14,
              fontFamily: 'var(--f-sans)', color: 'var(--text)',
              background: 'var(--surface-2)', outline: 'none',
            }}
          />
        </section>

        {/* ── Summary ──────────────────────── */}
        <section style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-2)' }}>
            <span>소계</span>
            <span className="numeric">{subtotal.toLocaleString()}원</span>
          </div>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
            <span>결제 금액</span>
            <span className="numeric">{total.toLocaleString()}원</span>
          </div>
        </section>

        {/* ── Customer info ───────────────── */}
        <section style={{
          background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>결제자 정보</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>입금자명 <span style={{ color: 'var(--crim)' }}>*</span></label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="입금 시 이름"
              style={{
                width: '100%', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', padding: '10px 12px', fontSize: 14,
                fontFamily: 'var(--f-sans)', color: 'var(--text)',
                background: 'var(--surface-2)', outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>연락처</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value.replace(/[^\d-]/g, '').slice(0, 13))}
              placeholder="010-1234-5678"
              style={{
                width: '100%', border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)', padding: '10px 12px', fontSize: 14,
                fontFamily: 'var(--f-sans)', color: 'var(--text)',
                background: 'var(--surface-2)', outline: 'none',
              }}
            />
          </div>
        </section>
      </main>

      {/* ── Payment footer ─────────────────── */}
      <footer style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* toss button */}
        <button
          className="btn btn-lg btn-block"
          disabled={items.length === 0 || submitting || !customerName.trim()}
          onClick={() => submitOrder('toss')}
          style={{
            background: '#0064FF', color: '#fff', gap: 8,
            opacity: (items.length === 0 || !customerName.trim()) ? 0.4 : 1,
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: 6, background: '#fff',
            color: '#0064FF', fontWeight: 800, fontSize: 14, lineHeight: 1,
          }}>t</span>
          토스로 결제하기
        </button>

        {/* transfer button */}
        <button
          className="btn btn-ghost btn-block"
          disabled={items.length === 0 || submitting || !customerName.trim()}
          onClick={() => setShowTransferModal(true)}
          style={{ opacity: (items.length === 0 || !customerName.trim()) ? 0.4 : 1 }}
        >
          계좌이체로 결제
        </button>

        {/* account info */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 13, color: 'var(--text-3)',
        }}>
          <span>{accountInfo}</span>
          <button
            onClick={copyAccount}
            style={{
              padding: '3px 8px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)',
              transition: 'all .15s ease',
            }}
          >
            {copied ? '복사됨!' : '복사'}
          </button>
        </div>
      </footer>

      {/* ── Transfer Modal ────────────────── */}
      {showTransferModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(23,23,25,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setShowTransferModal(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 'var(--r-xl)',
              width: '100%', maxWidth: 380,
              padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 20,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 18, textAlign: 'center' }}>계좌이체 안내</div>

            {/* account info box */}
            <div style={{
              background: 'var(--ink-050, #f5f5f5)', borderRadius: 'var(--r-md)',
              padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6,
              alignItems: 'center',
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>{bankName} · {accountHolder}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--f-mono, monospace)', letterSpacing: '0.02em' }}>
                {accountNo}
              </div>
              <button
                onClick={copyAccount}
                style={{
                  marginTop: 4, padding: '5px 14px', borderRadius: 'var(--r-pill)',
                  border: '1px solid var(--border)', background: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)',
                  transition: 'all .15s ease',
                }}
              >
                {copied ? '복사됨!' : '계좌번호 복사하기'}
              </button>
            </div>

            {/* amount */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>입금 금액</div>
              <div className="numeric" style={{ fontSize: 22, fontWeight: 700 }}>{total.toLocaleString()}원</div>
            </div>

            {/* note */}
            <div style={{
              textAlign: 'center', fontSize: 13, color: 'var(--text-2)',
              background: 'var(--ink-050, #f5f5f5)', borderRadius: 'var(--r-md)',
              padding: '10px 16px', lineHeight: 1.5,
            }}>
              입금자명에 &lsquo;<strong>{customerName}</strong>&rsquo;을 꼭 입력해주세요
            </div>

            {/* actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <button
                className="btn btn-lg btn-block"
                disabled={submitting}
                onClick={async () => {
                  await submitOrder('transfer');
                }}
                style={{ background: 'var(--ink-900)', color: '#fff' }}
              >
                {submitting ? '처리 중...' : '입금 완료 · 계속하기'}
              </button>
              <button
                className="btn btn-ghost btn-block"
                onClick={() => setShowTransferModal(false)}
                disabled={submitting}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
