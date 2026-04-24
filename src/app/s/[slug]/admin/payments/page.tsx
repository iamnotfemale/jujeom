'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { adminApi } from '@/lib/admin-api';
import type { Order, Payment, OrderItem } from '@/lib/database.types';
import { useStore } from '../../StoreProvider';
import { formatPrice, elapsedMinutes, formatElapsed } from '@/lib/formatters';

interface PaymentRow {
  orderId: number;
  orderNumber: string;
  tableId: number;
  tableNumber: number;
  customerName: string | null;
  customerPhone: string | null;
  items: string;
  amount: number;
  paymentStatus: 'waiting' | 'confirmed' | 'completed' | 'cancelled';
  method: 'toss' | 'transfer';
  createdAt: string;
  note: string | null;
}

type FilterTab = '전체' | '입금 대기' | '입금 확인' | '완료' | '취소';

const FLOW_STEPS = [
  '손님이 메뉴 선택',
  '주문 접수',
  '손님이 입금',
  '관리자가 입금 확인',
  '서빙 완료',
];

export default function PaymentsPageWrapper() {
  return (
    <Suspense fallback={null}>
      <PaymentsPage />
    </Suspense>
  );
}

function PaymentsPage() {
  const store = useStore();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>(() => {
    const p = searchParams.get('filter');
    if (p === 'waiting') return '입금 대기';
    return '전체';
  });
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<PaymentRow | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const fetchData = useCallback(async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', store.id)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false }) as { data: Order[] | null };

      const allOrders = orders ?? [];
      const orderIds = allOrders.map((o) => o.id);
      if (orderIds.length === 0) { setRows([]); setLoading(false); return; }

      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('store_id', store.id)
        .in('order_id', orderIds) as { data: Payment[] | null };

      const { data: items } = await supabase
        .from('order_items')
        .select('order_id, menu_name, quantity')
        .in('order_id', orderIds) as { data: Pick<OrderItem, 'order_id' | 'menu_name' | 'quantity'>[] | null };

      const itemsMap: Record<number, string> = {};
      for (const it of items ?? []) {
        const label = it.quantity > 1 ? `${it.menu_name} x${it.quantity}` : it.menu_name;
        itemsMap[it.order_id] = itemsMap[it.order_id] ? `${itemsMap[it.order_id]}, ${label}` : label;
      }

      const payMap: Record<number, Payment> = {};
      for (const p of payments ?? []) payMap[p.order_id] = p;

      setRows(
        allOrders.map((o) => ({
          orderId: o.id,
          orderNumber: o.order_number,
          tableId: o.table_id,
          tableNumber: o.table_number,
          customerName: payMap[o.id]?.customer_name ?? null,
          customerPhone: payMap[o.id]?.customer_phone ?? null,
          items: itemsMap[o.id] ?? '-',
          amount: o.final_amount,
          paymentStatus: (payMap[o.id]?.status ?? 'waiting') as PaymentRow['paymentStatus'],
          method: (payMap[o.id]?.method ?? 'transfer') as PaymentRow['method'],
          createdAt: o.created_at,
          note: o.note ?? null,
        }))
      );
    } catch (err) {
      console.error('Payments fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [store.id]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`payments-realtime:${store.slug}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();
    // 초기화 broadcast 수신
    const resetChannel = supabase
      .channel(`data-reset-payments:${store.slug}`)
      .on('broadcast', { event: 'reset' }, () => { setRows([]); fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(resetChannel); };
  }, [fetchData]);

  // Timer tick
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const updatePaymentStatus = async (orderId: number, newStatus: PaymentRow['paymentStatus'], tableId?: number) => {
    const { error } = await adminApi(`/api/admin/${store.slug}/payment/status`, {
      method: 'POST',
      body: { orderId, newStatus, tableId },
    });
    if (error) {
      showToast('상태 변경 실패');
      return;
    }
    showToast(newStatus === 'cancelled' ? '주문 취소 · 재고 원복 완료' : '상태 변경 완료');
    fetchData();
  };

  const confirmPayment = async (orderId: number, tableId?: number) => {
    await updatePaymentStatus(orderId, 'confirmed', tableId);
  };

  const bulkConfirm = async () => {
    const waiting = filtered.filter((r) => r.paymentStatus === 'waiting');
    if (waiting.length === 0) return;
    for (const r of waiting) {
      await adminApi(`/api/admin/${store.slug}/payment/status`, {
        method: 'POST',
        body: { orderId: r.orderId, newStatus: 'confirmed', tableId: r.tableId },
      });
    }
    showToast(`${waiting.length}건 일괄 입금 확인 완료`);
    fetchData();
  };

  const csvCell = (v: string | number | null | undefined): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const exportCSV = () => {
    const header = '주문번호,테이블,이름,연락처,주문내역,금액,상태,주문시간\n';
    const body = filtered.map((r) =>
      [r.orderNumber, r.tableNumber, csvCell(r.customerName), csvCell(r.customerPhone), csvCell(r.items), r.amount, r.paymentStatus, r.createdAt].join(',')
    ).join('\n');
    const blob = new Blob(['﻿' + header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const getElapsedMin = (iso: string) => elapsedMinutes(iso);

  const statusFilterMap: Record<FilterTab, PaymentRow['paymentStatus'] | null> = {
    '전체': null, '입금 대기': 'waiting', '입금 확인': 'confirmed', '완료': 'completed', '취소': 'cancelled',
  };

  const filtered = rows.filter((r) => {
    const sf = statusFilterMap[filter];
    if (sf && r.paymentStatus !== sf) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.orderNumber.toLowerCase().includes(q) ||
        r.customerName?.toLowerCase().includes(q) ||
        r.customerPhone?.includes(q) ||
        String(r.tableNumber).includes(q)
      );
    }
    return true;
  });

  const totalOrders = rows.length;
  const confirmedCount = rows.filter((r) => r.paymentStatus === 'confirmed').length;
  const waitingCount = rows.filter((r) => r.paymentStatus === 'waiting').length;
  const totalSales = rows
    .filter((r) => r.paymentStatus === 'confirmed' || r.paymentStatus === 'completed')
    .reduce((s, r) => s + r.amount, 0);
  const pendingAmount = rows.filter((r) => r.paymentStatus === 'waiting').reduce((s, r) => s + r.amount, 0);

  const statusBadge = (status: PaymentRow['paymentStatus']) => {
    const map: Record<string, { cls: string; label: string }> = {
      waiting: { cls: 'badge badge-amber', label: '입금 대기' },
      confirmed: { cls: 'badge badge-mint', label: '입금 확인' },
      completed: { cls: 'badge badge-neutral', label: '완료' },
      cancelled: { cls: 'badge badge-crim', label: '취소' },
    };
    return map[status] ?? { cls: 'badge badge-neutral', label: status };
  };

  const ageChip = (min: number) => {
    if (min >= 10) return { bg: 'color-mix(in oklab, var(--crim) 14%, white)', color: '#8e0f0f', label: `⚠ ${formatElapsed(min)}` };
    if (min >= 5) return { bg: 'color-mix(in oklab, var(--amber) 18%, white)', color: '#8a4d00', label: formatElapsed(min) };
    return { bg: 'var(--ink-100)', color: 'var(--ink-600)', label: formatElapsed(min) };
  };

  return (
    <div className="pb-10 max-w-[1060px]">
      {/* Flow Banner */}
      <div
        className="flex items-center justify-center gap-1 py-[14px] px-6 flex-wrap"
        style={{ background: 'linear-gradient(135deg, var(--ink-900) 0%, var(--ink-800) 100%)' }}
      >
        {FLOW_STEPS.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px" style={{ background: 'rgba(255,255,255,.2)' }} />}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              style={
                i === 3
                  ? { background: 'var(--neon)', color: 'var(--neon-ink)' }
                  : { background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.5)' }
              }
            >
              {i + 1}
            </div>
            <span
              className="text-xs"
              style={{
                fontWeight: i === 3 ? 700 : 500,
                color: i === 3 ? 'var(--neon)' : 'rgba(255,255,255,.6)',
              }}
            >
              {step}
            </span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="pt-6 px-7 pb-0 mb-5">
        <div>
          <h1 className="text-[22px] font-extrabold m-0 leading-[1.3]">결제 내역</h1>
          <p className="text-[13px] text-[var(--ink-400)] mt-[2px] mb-0">오늘의 주문 및 입금 현황을 관리합니다</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 px-7 mb-5">
        <div className="bg-[var(--white)] border border-[var(--border)] rounded-[var(--r-lg)] py-[14px] px-4">
          <div className="text-xs font-medium text-[var(--ink-400)] mb-[6px]">총 주문</div>
          <div className="text-[26px] font-extrabold leading-[1.2] tracking-[-0.02em] numeric">{totalOrders}</div>
        </div>
        <div
          className="border rounded-[var(--r-lg)] py-[14px] px-4"
          style={{
            background: 'color-mix(in oklab, var(--mint) 6%, white)',
            border: '1px solid color-mix(in oklab, var(--mint) 18%, white)',
          }}
        >
          <div className="text-xs font-medium text-[var(--ink-400)] mb-[6px]">입금 확인</div>
          <div className="text-[26px] font-extrabold leading-[1.2] tracking-[-0.02em] text-[var(--mint)] numeric">{confirmedCount}</div>
        </div>
        <div
          className="border rounded-[var(--r-lg)] py-[14px] px-4"
          style={{
            background: 'color-mix(in oklab, var(--amber) 8%, white)',
            border: '1px solid color-mix(in oklab, var(--amber) 20%, white)',
          }}
        >
          <div className="text-xs font-medium text-[var(--ink-400)] mb-[6px]">입금 대기</div>
          <div className="text-[26px] font-extrabold leading-[1.2] tracking-[-0.02em] text-[var(--amber)] numeric">{waitingCount}</div>
        </div>
        <div className="bg-[var(--white)] border border-[var(--border)] rounded-[var(--r-lg)] py-[14px] px-4">
          <div className="text-xs font-medium text-[var(--ink-400)] mb-[6px]">총 매출</div>
          <div className="text-[26px] font-extrabold leading-[1.2] tracking-[-0.02em] numeric">{formatPrice(totalSales)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-[10px] px-7 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="주문번호, 이름, 연락처 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 py-0 px-[14px] rounded-[var(--r-sm)] border border-[var(--border)] text-[13px] w-[220px] outline-none bg-[var(--white)]"
          style={{ fontFamily: 'var(--f-sans)' }}
        />
        <div className="flex gap-1">
          {(['전체', '입금 대기', '입금 확인', '완료', '취소'] as FilterTab[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="h-8 py-0 px-[14px] rounded-[var(--r-pill)] text-xs font-semibold cursor-pointer transition-all"
              style={
                filter === f
                  ? { background: 'var(--ink-900)', color: '#fff', border: '1px solid var(--ink-900)', fontFamily: 'var(--f-sans)' }
                  : { background: 'var(--white)', color: 'var(--ink-500)', border: '1px solid var(--border)', fontFamily: 'var(--f-sans)' }
              }
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={exportCSV} className="btn btn-ghost btn-sm">CSV 내보내기</button>
        {waitingCount > 0 && (
          <button onClick={bulkConfirm} className="btn btn-sm" style={{ background: 'var(--mint)', color: '#fff', border: 0 }}>
            대기 {waitingCount}건 일괄 확인
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mx-7 bg-[var(--white)] border border-[var(--border)] rounded-[var(--r-lg)] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[var(--ink-400)]">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[var(--ink-400)]">결제 내역이 없습니다</div>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="text-left py-3 px-[14px] text-[11px] font-semibold text-[var(--ink-400)] uppercase tracking-[0.04em] border-b border-[var(--ink-100)] bg-[var(--ink-050)]">주문번호</th>
                <th className="text-left py-3 px-[14px] text-[11px] font-semibold text-[var(--ink-400)] uppercase tracking-[0.04em] border-b border-[var(--ink-100)] bg-[var(--ink-050)]">테이블</th>
                <th className="text-left py-3 px-[14px] text-[11px] font-semibold text-[var(--ink-400)] uppercase tracking-[0.04em] border-b border-[var(--ink-100)] bg-[var(--ink-050)]">이름 · 연락처</th>
                <th className="text-left py-3 px-[14px] text-[11px] font-semibold text-[var(--ink-400)] uppercase tracking-[0.04em] border-b border-[var(--ink-100)] bg-[var(--ink-050)]">주문 내역</th>
                <th className="text-right py-3 px-[14px] text-[11px] font-semibold text-[var(--ink-400)] uppercase tracking-[0.04em] border-b border-[var(--ink-100)] bg-[var(--ink-050)]">금액</th>
                <th className="text-left py-3 px-[14px] text-[11px] font-semibold text-[var(--ink-400)] uppercase tracking-[0.04em] border-b border-[var(--ink-100)] bg-[var(--ink-050)]">상태 · 경과</th>
                <th className="text-center py-3 px-[14px] text-[11px] font-semibold text-[var(--ink-400)] uppercase tracking-[0.04em] border-b border-[var(--ink-100)] bg-[var(--ink-050)]">작업</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const elapsed = getElapsedMin(r.createdAt);
                const age = ageChip(elapsed);
                const badge = statusBadge(r.paymentStatus);
                const isWaiting = r.paymentStatus === 'waiting';
                const isOverdue = isWaiting && elapsed >= 10;
                const isWarn = isWaiting && elapsed >= 5 && elapsed < 10;
                return (
                  <tr
                    key={r.orderId}
                    onClick={() => setDetailRow(r)}
                    className="cursor-pointer transition-[background_.15s_ease]"
                    style={{
                      background: isOverdue
                        ? 'color-mix(in oklab, var(--crim) 5%, white)'
                        : isWarn
                        ? 'color-mix(in oklab, var(--amber) 6%, white)'
                        : r.paymentStatus === 'cancelled'
                        ? 'color-mix(in oklab, var(--crim) 3%, white)'
                        : 'transparent',
                      opacity: r.paymentStatus === 'cancelled' ? 0.6 : 1,
                    }}
                  >
                    <td className="py-3 px-[14px] border-b border-[var(--ink-050)] text-[13px] align-middle">
                      <div className="font-bold text-[13px] numeric">{r.orderNumber}</div>
                      <div className="numeric text-[11px] text-[var(--ink-400)] mt-[2px]">
                        {new Date(r.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                      </div>
                    </td>
                    <td className="py-3 px-[14px] border-b border-[var(--ink-050)] text-[13px] align-middle">
                      <span className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-[var(--r-sm)] bg-[var(--ink-900)] text-white text-[13px] font-bold">{r.tableNumber}</span>
                    </td>
                    <td className="py-3 px-[14px] border-b border-[var(--ink-050)] text-[13px] align-middle">
                      <div className="text-[13px] font-semibold">{r.customerName ?? '-'}</div>
                      <div className="text-[11px] text-[var(--ink-400)]">{r.customerPhone ?? '-'}</div>
                    </td>
                    <td className="py-3 px-[14px] border-b border-[var(--ink-050)] text-[13px] align-middle max-w-[200px]">
                      <div className="text-xs text-[var(--ink-600)] whitespace-nowrap overflow-hidden text-ellipsis">{r.items}</div>
                    </td>
                    <td className="py-3 px-[14px] border-b border-[var(--ink-050)] text-[13px] align-middle text-right">
                      <span className="font-bold text-[13px] numeric">{formatPrice(r.amount)}</span>
                    </td>
                    <td className="py-3 px-[14px] border-b border-[var(--ink-050)] text-[13px] align-middle">
                      <div className="flex items-center gap-[6px] flex-wrap">
                        <span className={badge.cls}>{badge.label}</span>
                        {isWaiting && (
                          <span
                            className="inline-flex items-center gap-1 py-[3px] px-2 rounded-[var(--r-pill)] text-[11px] font-semibold"
                            style={{ background: age.bg, color: age.color }}
                          >
                            {age.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-[14px] border-b border-[var(--ink-050)] text-[13px] align-middle text-center" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
                          waiting:   { bg: 'color-mix(in oklab, var(--amber) 14%, white)', color: '#8a4d00', border: '1px solid color-mix(in oklab, var(--amber) 25%, white)' },
                          confirmed: { bg: 'color-mix(in oklab, var(--mint) 14%, white)',  color: '#0e6b46', border: '1px solid color-mix(in oklab, var(--mint) 25%, white)' },
                          completed: { bg: 'var(--ink-050)',                               color: 'var(--ink-500)', border: '1px solid var(--ink-100)' },
                          cancelled: { bg: 'color-mix(in oklab, var(--crim) 10%, white)',  color: '#8e0f0f', border: '1px solid color-mix(in oklab, var(--crim) 20%, white)' },
                        };
                        const st = statusStyles[r.paymentStatus] ?? statusStyles.waiting;
                        return (
                          <select
                            value={r.paymentStatus}
                            onChange={(e) => updatePaymentStatus(r.orderId, e.target.value as PaymentRow['paymentStatus'], r.tableId)}
                            style={{
                              appearance: 'none', WebkitAppearance: 'none',
                              padding: '6px 24px 6px 10px',
                              borderRadius: 'var(--r-pill)', border: st.border,
                              fontSize: 12, fontWeight: 700, fontFamily: 'var(--f-sans)',
                              cursor: 'pointer', outline: 'none',
                              background: `${st.bg} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238A91A5'/%3E%3C/svg%3E") no-repeat right 8px center`,
                              color: st.color,
                              transition: 'all .12s ease',
                            }}
                          >
                            <option value="waiting">입금 대기</option>
                            <option value="confirmed">입금 확인</option>
                            <option value="completed">완료</option>
                            <option value="cancelled">취소</option>
                          </select>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between py-[14px] px-7">
        <span className="text-[13px] text-[var(--ink-500)]">
          총 {filtered.length}건 표시 중
        </span>
        {pendingAmount > 0 && (
          <span className="text-[13px] font-semibold text-[var(--amber)]">
            대기 금액: {formatPrice(pendingAmount)}
          </span>
        )}
      </div>

      {/* Order Detail Modal */}
      {detailRow && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[200]"
          style={{ background: 'rgba(14,18,32,.45)', animation: 'fadeIn .15s ease' }}
          onClick={() => setDetailRow(null)}
        >
          <div
            className="bg-white rounded-[var(--r-lg)] py-7 px-8 max-w-[440px] w-[90%] shadow-[var(--shadow-3)]"
            style={{ animation: 'pop .2s ease' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-lg font-extrabold">주문 #{detailRow.orderNumber}</div>
                <div className="text-xs text-[var(--ink-400)] mt-[2px]">{detailRow.tableNumber}번 테이블</div>
              </div>
              <button
                onClick={() => setDetailRow(null)}
                className="w-8 h-8 rounded-full border-0 bg-[var(--ink-050)] cursor-pointer text-base text-[var(--ink-400)] flex items-center justify-center"
              >✕</button>
            </div>

            <div className="flex flex-col gap-[14px]">
              {/* 주문 시간 */}
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--ink-400)] font-semibold">주문 시간</span>
                <span className="numeric font-semibold">
                  {new Date(detailRow.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </span>
              </div>

              {/* 결제 방식 */}
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--ink-400)] font-semibold">결제 방식</span>
                <span
                  className="font-semibold py-[2px] px-[10px] rounded-[var(--r-pill)] text-xs"
                  style={{
                    background: detailRow.method === 'toss' ? '#0064FF' : 'var(--ink-100)',
                    color: detailRow.method === 'toss' ? '#fff' : 'var(--ink-600)',
                  }}
                >
                  {detailRow.method === 'toss' ? '토스' : '계좌이체'}
                </span>
              </div>

              {/* 이름 · 연락처 */}
              <div className="flex justify-between text-[13px]">
                <span className="text-[var(--ink-400)] font-semibold">이름 · 연락처</span>
                <span className="font-semibold">
                  {detailRow.customerName ?? '-'} · {detailRow.customerPhone ?? '-'}
                </span>
              </div>

              {/* 구분선 */}
              <div className="h-px bg-[var(--ink-100)]" />

              {/* 주문 내역 */}
              <div>
                <div className="text-xs text-[var(--ink-400)] font-semibold mb-2">주문 내역</div>
                <div className="bg-[var(--ink-050)] rounded-[var(--r-sm)] py-3 px-[14px] text-[13px] leading-[1.7] text-[var(--ink-700)]">
                  {detailRow.items.split(', ').map((item, i) => (
                    <div key={i}>{item}</div>
                  ))}
                </div>
              </div>

              {/* 요청사항 */}
              {detailRow.note && (
                <div>
                  <div className="text-xs text-[var(--ink-400)] font-semibold mb-[6px]">요청 사항</div>
                  <div
                    className="rounded-[var(--r-sm)] py-[10px] px-[14px] text-[13px] text-[var(--neon-ink)] leading-[1.5]"
                    style={{
                      background: 'color-mix(in oklab, var(--neon) 8%, white)',
                      border: '1px dashed var(--neon)',
                    }}
                  >
                    {detailRow.note}
                  </div>
                </div>
              )}

              {/* 구분선 */}
              <div className="h-px bg-[var(--ink-100)]" />

              {/* 합계 */}
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-semibold text-[var(--ink-400)]">결제 금액</span>
                <span className="numeric text-[22px] font-extrabold">{formatPrice(detailRow.amount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[var(--ink-900)] text-white py-3 px-6 rounded-[var(--r-md)] text-sm font-semibold shadow-[var(--shadow-3)] z-[100]"
          style={{ animation: 'toastIn .2s ease' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
