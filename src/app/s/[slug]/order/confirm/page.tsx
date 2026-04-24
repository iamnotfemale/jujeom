'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ToastProvider';
import { normalizeBankName } from '@/lib/banks';
import { useStore } from '../../StoreProvider';
import type { CartItem, StoredCartItem } from '@/lib/types/cart';
import { cartStorageKey } from '@/lib/types/cart';
import { formatPrice } from '@/lib/formatters';

const QUICK_TAGS = ['# 덜 맵게', '# 빨리 부탁드려요', '# 앞접시 추가', '# 물티슈 추가'];


/* ── Component ──────────────────────────────── */
export default function OrderConfirmPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen font-[var(--f-sans)]">로딩 중...</div>}>
      <OrderConfirmPage />
    </Suspense>
  );
}

function OrderConfirmPage() {
  const store = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const tableNumber = Number(searchParams.get('table') || '1');

  const [items, setItems] = useState<CartItem[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };
  const [showTransferModal, setShowTransferModal] = useState(false);

  const storeName = store.name;
  const accountNo = store.account_number;
  const bankName = store.bank_name;
  const accountHolder = store.account_holder ?? store.name;
  const accountInfo = `${bankName}${bankName ? ' · ' : ''}${accountHolder} ${accountNo}`;

  const [hydrated, setHydrated] = useState(false);

  /* hydrate cart from localStorage (per-table key) */
  useEffect(() => {
    const key = cartStorageKey(store.slug, tableNumber);
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // The menu page stores items as StoredCartItem[] — transform to the flat CartItem shape
        const transformed: CartItem[] = (parsed as StoredCartItem[]).map((c) => ({
          menuId: c.menu.id,
          name: c.menu.name,
          price: c.menu.price,
          quantity: c.quantity,
          // prefer the user's selected option, fall back to the raw options blob
          options: c.options ?? c.menu.options ?? undefined,
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
    const storageKey = cartStorageKey(store.slug, tableNumber);
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      // filter/update existing records by (menu.id + options) to keep menu objects intact
      const byKey = new Map(items.map(it => [`${it.menuId}:${it.options ?? ''}`, it]));
      const nextCart = (parsed as StoredCartItem[])
        .map((c) => {
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
    if (!customerPhone.trim()) {
      showToast('연락처를 입력해 주세요.', 'warn');
      return;
    }
    const phonePattern = /^\d{3}-\d{3,4}-\d{4}$/;
    if (!phonePattern.test(customerPhone)) {
      showToast('연락처를 올바른 형식으로 입력해 주세요. (예: 010-1234-5678)', 'warn');
      return;
    }
    setSubmitting(true);

    try {
      // table_number → table_id 조회 (anon SELECT 허용됨)
      const { data: tbl } = await supabase
        .from('tables')
        .select('id')
        .eq('store_id', store.id)
        .eq('number', tableNumber)
        .eq('kind', 'table')
        .maybeSingle();
      const tableId = (tbl as { id?: number } | null)?.id ?? null;
      if (!tableId) {
        showToast('테이블을 찾을 수 없습니다. QR을 다시 스캔해 주세요.', 'error');
        setSubmitting(false);
        return;
      }

      const { data, error } = await supabase.rpc('create_order_atomic', {
        p_store_id: store.id,
        p_table_id: tableId,
        p_items: items.map((it) => ({
          menu_id: it.menuId,
          quantity: it.quantity,
          options: it.options ?? null,
        })),
        p_customer_name: customerName.trim(),
        p_customer_phone: customerPhone.trim() || null,
        p_method: method,
        p_note: note.trim() || null,
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
          items_required: '주문 항목이 없습니다. 메뉴를 선택해 주세요.',
          invalid_quantity: '수량이 올바르지 않습니다.',
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

      // RPC는 jsonb 단일 객체 반환
      const row = data as { order_id: number; order_number: string; total: number } | null;
      if (!row?.order_id) {
        showToast('주문 생성 응답이 비어있습니다. 잠시 후 다시 시도해주세요.', 'error');
        setSubmitting(false);
        return;
      }

      // 장바구니 비우기
      try {
        localStorage.removeItem(cartStorageKey(store.slug, tableNumber));
      } catch { /* ignore */ }

      if (method === 'toss') {
        const bank = normalizeBankName(bankName);
        const cleanAccountNo = accountNo.replace(/\D/g, '');
        const deeplink = `supertoss://send?bank=${bank}&accountNo=${cleanAccountNo}&amount=${row.total}`;
        // anchor 방식: 브라우저의 자동 퍼센트 인코딩 없이 스킴 핸들러에 그대로 전달
        const a = document.createElement('a');
        a.setAttribute('href', deeplink);
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise((r) => setTimeout(r, 1500));
      }

      // 상태 페이지로 이동
      router.push(`/s/${store.slug}/order/status?orderNo=${row.order_number}&table=${tableNumber}`);
    } catch (err) {
      console.error('Order submit failed:', err);
      showToast('주문에 실패했어요. 네트워크를 확인하고 다시 시도해 주세요.', 'error');
      setSubmitting(false);
    }
  };

  /* ── Render ────────────────────────────────── */
  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] flex flex-col">
      {/* ── Header ─────────────────────────── */}
      <header className="sticky top-0 z-20 bg-[var(--surface)] border-b border-[var(--border)] px-4 h-14 flex items-center gap-3">
        <Link
          href={`/s/${store.slug}/order/menu?table=${tableNumber}`}
          className="w-9 h-9 rounded-[var(--r-sm)] flex items-center justify-center bg-[var(--surface-2)] no-underline text-[var(--text)] text-lg shrink-0"
        >
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[17px] tracking-[-0.01em]">주문 확인</div>
          <div className="text-xs text-[var(--text-3)]">{storeName} · {tableNumber}번 테이블</div>
        </div>
      </header>

      {/* ── Body ───────────────────────────── */}
      <main className="flex-1 px-4 pt-4 pb-8 flex flex-col gap-4">

        {/* ── Order items card ─────────────── */}
        <section className="bg-[var(--surface)] rounded-[var(--r-lg)] border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-[14px] border-b border-[var(--border)] font-bold text-[15px]">
            주문 내역 <span className="text-[var(--text-3)] font-medium">({items.length})</span>
          </div>
          {!hydrated && (
            <div className="px-4 py-10 text-center text-[var(--text-3)] text-sm">불러오는 중...</div>
          )}
          {hydrated && items.length === 0 && (
            <div className="px-4 py-10 text-center text-[var(--text-3)] text-sm flex flex-col items-center gap-3">
              <span>장바구니가 비어 있어요. 메뉴를 먼저 선택해 주세요.</span>
              <Link
                href={`/s/${store.slug}/order/menu?table=${tableNumber}`}
                className="py-2 px-5 rounded-[var(--r-pill)] bg-[var(--ink-900)] text-white text-sm font-semibold no-underline"
              >
                메뉴 보러 가기
              </Link>
            </div>
          )}
          {items.map(item => {
            const k = itemKey(item);
            return (
            <div key={k} className="flex gap-3 px-4 py-[14px] border-b border-[var(--ink-100)]">
              {/* thumbnail placeholder */}
              <div className="w-[52px] h-[52px] rounded-[var(--r-sm)] bg-[var(--ink-100)] shrink-0 flex items-center justify-center text-[22px]">
                🍽
              </div>
              {/* info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] mb-[2px]">{item.name}</div>
                {item.options && (
                  <div className="text-xs text-[var(--text-3)] mb-1">{item.options}</div>
                )}
                <div className="numeric text-sm font-semibold">
                  {formatPrice(item.price * item.quantity)}
                </div>
              </div>
              {/* qty controls */}
              <div className="flex items-center gap-[6px] shrink-0">
                <button
                  onClick={() => item.quantity === 1 ? removeItem(k) : updateQty(k, -1)}
                  className="w-[30px] h-[30px] rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center cursor-pointer text-sm"
                  style={{ color: item.quantity === 1 ? 'var(--crim)' : 'var(--text)' }}
                >
                  {item.quantity === 1 ? '✕' : '−'}
                </button>
                <span className="numeric w-6 text-center font-semibold text-[15px]">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQty(k, 1)}
                  className="w-[30px] h-[30px] rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center cursor-pointer text-sm"
                >
                  +
                </button>
              </div>
            </div>
            );
          })}
        </section>

        {/* ── Note / request ───────────────── */}
        <section className="bg-[var(--surface)] rounded-[var(--r-lg)] border border-[var(--border)] p-4">
          <div className="font-bold text-[15px] mb-[10px]">요청 사항</div>
          <div className="flex flex-wrap gap-2 mb-[10px]">
            {QUICK_TAGS.map(tag => {
              const active = note.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="py-[6px] px-3 rounded-[var(--r-pill)] text-[13px] font-medium cursor-pointer transition-all duration-[150ms] ease"
                  style={{
                    border: active ? '1px solid var(--ink-900)' : '1px solid var(--border)',
                    background: active ? 'var(--ink-900)' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--text-2)',
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
            className="w-full resize-none border border-[var(--border)] rounded-[var(--r-md)] py-[10px] px-3 text-sm font-[var(--f-sans)] text-[var(--text)] bg-[var(--surface-2)] outline-none"
          />
        </section>

        {/* ── Summary ──────────────────────── */}
        <section className="bg-[var(--surface)] rounded-[var(--r-lg)] border border-[var(--border)] p-4 flex flex-col gap-[10px]">
          <div className="flex justify-between text-lg font-bold">
            <span>결제 금액</span>
            <span className="numeric">{formatPrice(total)}</span>
          </div>
        </section>

        {/* ── Customer info ───────────────── */}
        <section className="bg-[var(--surface)] rounded-[var(--r-lg)] border border-[var(--border)] p-4 flex flex-col gap-3">
          <div className="font-bold text-[15px]">결제자 정보</div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-[var(--text-2)]">입금자명 <span className="text-[var(--crim)]">*</span></label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="입금 시 이름"
              className="w-full border border-[var(--border)] rounded-[var(--r-md)] py-[10px] px-3 text-sm font-[var(--f-sans)] text-[var(--text)] bg-[var(--surface-2)] outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-[var(--text-2)]">연락처 <span className="text-[var(--crim)]">*</span></label>
            <input
              type="tel"
              inputMode="numeric"
              value={customerPhone}
              onChange={e => setCustomerPhone(formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              className="w-full border border-[var(--border)] rounded-[var(--r-md)] py-[10px] px-3 text-sm font-[var(--f-sans)] text-[var(--text)] bg-[var(--surface-2)] outline-none"
            />
          </div>
        </section>

        {/* ── Payment buttons ─────────────── */}
        <div
          className="flex flex-col gap-[10px] border-t border-[var(--border)] pt-4"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          {/* toss button */}
          <button
            className="btn btn-lg btn-block"
            disabled={!hydrated || items.length === 0 || submitting || !customerName.trim() || !customerPhone.trim()}
            onClick={() => submitOrder('toss')}
            style={{
              background: '#0064FF', color: '#fff', gap: 8,
              opacity: (!hydrated || items.length === 0 || !customerName.trim() || !customerPhone.trim()) ? 0.4 : 1,
            }}
          >
            <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-[6px] bg-white text-[#0064FF] font-extrabold text-sm leading-none">t</span>
            토스로 결제하기
          </button>

          {/* transfer button */}
          <button
            className="btn btn-ghost btn-block"
            disabled={!hydrated || items.length === 0 || submitting || !customerName.trim() || !customerPhone.trim()}
            onClick={() => setShowTransferModal(true)}
            style={{ opacity: (!hydrated || items.length === 0 || !customerName.trim() || !customerPhone.trim()) ? 0.4 : 1 }}
          >
            계좌이체로 결제
          </button>

          {/* account info */}
          <div className="flex items-center justify-center gap-2 text-[13px] text-[var(--text-3)]">
            <span>{accountInfo}</span>
            <button
              onClick={copyAccount}
              className="py-[3px] px-2 rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-semibold cursor-pointer text-[var(--text-2)] transition-all duration-[150ms] ease"
            >
              {copied ? '복사됨!' : '복사'}
            </button>
          </div>
        </div>
      </main>

      {/* ── Transfer Modal ────────────────── */}
      {showTransferModal && (
        <div
          className="fixed inset-0 z-[100] bg-[rgba(23,23,25,0.6)] flex items-center justify-center p-6"
          onClick={() => setShowTransferModal(false)}
        >
          <div
            className="bg-white rounded-[var(--r-xl)] w-full max-w-[380px] px-6 py-7 flex flex-col gap-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="font-bold text-lg text-center">계좌이체 안내</div>

            {/* account info box */}
            <div className="bg-[var(--ink-050,#f5f5f5)] rounded-[var(--r-md)] px-5 py-4 flex flex-col gap-[6px] items-center">
              <div className="text-[13px] text-[var(--text-3)] font-medium">{bankName} · {accountHolder}</div>
              <div className="text-[22px] font-bold font-[var(--f-mono,monospace)] tracking-[0.02em]">
                {accountNo}
              </div>
              <button
                onClick={copyAccount}
                className="mt-1 py-[5px] px-[14px] rounded-[var(--r-pill)] border border-[var(--border)] bg-white text-xs font-semibold cursor-pointer text-[var(--text-2)] transition-all duration-[150ms] ease"
              >
                {copied ? '복사됨!' : '계좌번호 복사하기'}
              </button>
            </div>

            {/* amount */}
            <div className="text-center">
              <div className="text-[13px] text-[var(--text-3)] mb-1">입금 금액</div>
              <div className="numeric text-[22px] font-bold">{formatPrice(total)}</div>
            </div>

            {/* note */}
            <div className="text-center text-[13px] text-[var(--text-2)] bg-[var(--ink-050,#f5f5f5)] rounded-[var(--r-md)] px-4 py-[10px] leading-[1.5]">
              입금자명에 &lsquo;<strong>{customerName}</strong>&rsquo;을 꼭 입력해주세요
            </div>

            {/* actions */}
            <div className="flex flex-col gap-[10px] mt-1">
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
