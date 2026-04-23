'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ClosedGate from '@/components/ClosedGate';
import { useToast } from '@/components/ToastProvider';
import { normalizeBankName } from '@/lib/banks';

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
      <ClosedGate>
        <OrderConfirmPage />
      </ClosedGate>
    </Suspense>
  );
}

function OrderConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

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

  const [hydrated, setHydrated] = useState(false);

  /* hydrate cart from localStorage (per-table key) */
  useEffect(() => {
    const key = `cart:table:${tableNumber}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // The menu page stores CartItem[] as { menu: Menu; quantity: number; options?: string | null }
        // Transform to the shape this page expects
        const transformed = parsed.map((c: any) => ({
          menuId: c.menu.id,
          name: c.menu.name,
          price: c.menu.price,
          quantity: c.quantity,
          // prefer the user's selected option, fall back to the raw options blob
          options: c.options ?? c.menu.options ?? null,
          imageUrl: c.menu.image_url || null,
        }));
        setItems(transformed);
      } catch { /* ignore */ }
    }
    setHydrated(true);
  }, [tableNumber]);

  /* ── Price helpers ─────────────────────────── */
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  /* ── Quantity controls ─────────────────────── */
  const itemKey = (it: CartItem) => `${it.menuId}:${it.options ?? ''}`;

  const updateQty = useCallback((key: string, delta: number) => {
    setItems(prev =>
      prev
        .map(it => (`${it.menuId}:${it.options ?? ''}` === key ? { ...it, quantity: it.quantity + delta } : it))
        .filter(it => it.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems(prev => prev.filter(it => `${it.menuId}:${it.options ?? ''}` !== key));
  }, []);

  /* persist item edits back to localStorage so menu page stays in sync */
  useEffect(() => {
    if (!hydrated) return; // hydrate 되기 전엔 절대 persist 하지 않음
    const storageKey = `cart:table:${tableNumber}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      // filter/update existing records by (menu.id + options) to keep menu objects intact
      const byKey = new Map(items.map(it => [`${it.menuId}:${it.options ?? ''}`, it]));
      const nextCart = parsed
        .map((c: any) => {
          const k = `${c.menu.id}:${c.options ?? ''}`;
          const updated = byKey.get(k);
          if (!updated) return null;
          return { ...c, quantity: updated.quantity };
        })
        .filter(Boolean);
      if (nextCart.length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(nextCart));
      }
    } catch { /* ignore */ }
  }, [items, tableNumber, hydrated]);

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
    if (!customerName.trim()) {
      showToast('입금자명을 입력해 주세요.', 'warn');
      return;
    }
    setSubmitting(true);

    try {
      const { data, error } = await supabase.rpc('create_order_atomic', {
        p_table_number: tableNumber,
        p_note: note || null,
        p_items: items.map(it => ({
          menu_id: it.menuId,
          quantity: it.quantity,
          options: it.options ?? null,
        })),
        p_customer_name: customerName.trim(),
        p_customer_phone: customerPhone || null,
        p_method: method,
      });

      if (error) {
        console.error('create_order_atomic error:', error);
        // RAISE EXCEPTION 'code' USING HINT = '사용자 친화 메시지' 형태로 저장됨
        // error.hint에 한글 메시지, error.message에 영문 코드
        const err = error as { message?: string; hint?: string; details?: string };
        const codeToMsg: Record<string, string> = {
          table_not_found: 'QR을 다시 스캔해주세요. 테이블 정보가 올바르지 않습니다.',
          invalid_table_kind: '이 자리는 주문을 받지 않는 위치입니다.',
          store_closed: '영업이 종료되었습니다.',
          store_paused: '현재 주문을 일시 중단 중입니다.',
          store_not_configured: '주점 설정이 완료되지 않았습니다.',
          empty_cart: '장바구니가 비어있습니다.',
          empty_customer_name: '입금자명을 입력해 주세요.',
          invalid_method: '결제 수단이 올바르지 않습니다.',
          invalid_items: '주문 형식이 올바르지 않습니다.',
          menu_not_found: '존재하지 않는 메뉴가 포함되어 있습니다.',
          menu_sold_out: '품절된 메뉴가 있습니다. 장바구니를 확인해 주세요.',
          insufficient_stock: '재고가 부족한 메뉴가 있습니다.',
        };
        const friendly =
          codeToMsg[err.message ?? ''] ||
          err.hint ||
          err.message ||
          '주문 실패. 다시 시도해 주세요.';
        showToast(friendly, 'error');
        setSubmitting(false);
        return;
      }

      // RPC의 RETURNS TABLE은 배열로 반환됨
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.order_id) {
        showToast('주문 생성 응답이 비어있습니다. 잠시 후 다시 시도해주세요.', 'error');
        setSubmitting(false);
        return;
      }

      // 장바구니 비우기
      try {
        localStorage.removeItem(`cart:table:${tableNumber}`);
      } catch { /* ignore */ }

      // Toss 딥링크 (모바일에서만)
      // 스펙: supertoss://send?bank=<한글단축명>&accountNo=<숫자>&amount=<금액>
      // - bank: 한글 단축형 ("국민", "카카오뱅크" 등). 잘못된 값이면 은행 선택 페이지로 빠짐.
      // - accountNo: 하이픈/공백 제거한 숫자만
      // - origin 파라미터는 비표준이라 전달하지 않음 (전달 시 선택 페이지로 빠질 수 있음)
      if (method === 'toss') {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          const bank = normalizeBankName(bankName);
          const cleanAccountNo = accountNo.replace(/\D/g, '');
          window.location.href = `supertoss://send?bank=${encodeURIComponent(bank)}&accountNo=${cleanAccountNo}&amount=${row.total}`;
        }
        // 데스크톱: 그냥 redirect
      }

      // 상태 페이지로 이동
      router.push(`/order/status?orderId=${row.order_id}&table=${tableNumber}`);
    } catch (err) {
      console.error('Order submit failed:', err);
      showToast('주문에 실패했어요. 네트워크를 확인하고 다시 시도해 주세요.', 'error');
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
          {items.map(item => {
            const k = itemKey(item);
            return (
            <div key={k} style={{
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
                  onClick={() => item.quantity === 1 ? removeItem(k) : updateQty(k, -1)}
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
                  onClick={() => updateQty(k, 1)}
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
            );
          })}
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
              onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="01012345678"
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
