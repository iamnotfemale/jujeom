'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Order, Payment, OrderItem } from '@/lib/database.types';

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

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('전체');
  const [now, setNow] = useState(Date.now());
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
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false }) as { data: Order[] | null };

      const allOrders = orders ?? [];
      const orderIds = allOrders.map((o) => o.id);
      if (orderIds.length === 0) { setRows([]); setLoading(false); return; }

      const { data: payments } = await supabase
        .from('payments')
        .select('*')
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
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();
    // 초기화 broadcast 수신
    const resetChannel = supabase
      .channel('data-reset-payments')
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
    const paymentUpdate: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'confirmed') paymentUpdate.confirmed_at = new Date().toISOString();
    await supabase.from('payments').update(paymentUpdate).eq('order_id', orderId);

    let orderStatus = 'pending';
    if (newStatus === 'confirmed') orderStatus = 'accepted';
    else if (newStatus === 'completed') orderStatus = 'served';
    else if (newStatus === 'cancelled') orderStatus = 'cancelled';
    await supabase.from('orders').update({ status: orderStatus, updated_at: new Date().toISOString() }).eq('id', orderId);

    // 입금 확인 시 해당 테이블이 비어있으면 사용중으로 변경
    if (newStatus === 'confirmed' && tableId) {
      const { data: tbl } = await supabase.from('tables').select('status').eq('id', tableId).single();
      if (tbl?.status === 'empty') {
        await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId);
      }
    }

    // 취소 시 재고 원복
    if (newStatus === 'cancelled') {
      try {
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('menu_id, quantity')
          .eq('order_id', orderId);
        for (const item of orderItems ?? []) {
          const { data: menu } = await supabase.from('menus').select('stock').eq('id', item.menu_id).single();
          if (menu) {
            await supabase.from('menus').update({
              stock: menu.stock + item.quantity,
              is_sold_out: false,
            }).eq('id', item.menu_id);
          }
        }
      } catch (e) { console.error('재고 원복 실패:', e); }
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
      await supabase.from('payments').update({ status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('order_id', r.orderId);
      await supabase.from('orders').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', r.orderId);
      // 테이블이 비어있으면 사용중으로
      const { data: tbl } = await supabase.from('tables').select('status').eq('id', r.tableId).single();
      if (tbl?.status === 'empty') {
        await supabase.from('tables').update({ status: 'occupied' }).eq('id', r.tableId);
      }
    }
    showToast(`${waiting.length}건 일괄 입금 확인 완료`);
    fetchData();
  };

  const exportCSV = () => {
    const header = '주문번호,테이블,이름,연락처,주문내역,금액,상태,주문시간\n';
    const body = filtered.map((r) =>
      [r.orderNumber, r.tableNumber, r.customerName ?? '', r.customerPhone ?? '', `"${r.items}"`, r.amount, r.paymentStatus, r.createdAt].join(',')
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const getElapsedMin = (iso: string) => Math.floor((now - new Date(iso).getTime()) / 60000);
  const formatElapsed = (min: number) => {
    if (min < 1) return '방금';
    if (min < 60) return `${min}분`;
    return `${Math.floor(min / 60)}시간 ${min % 60}분`;
  };

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
  const totalSales = rows.filter((r) => r.paymentStatus !== 'waiting').reduce((s, r) => s + r.amount, 0);
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
    <div style={s.page}>
      {/* Flow Banner */}
      <div style={s.flowBanner}>
        {FLOW_STEPS.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <div style={{ width: 24, height: 1, background: 'rgba(255,255,255,.2)' }} />}
            <div style={{
              ...s.flowCircle,
              ...(i === 3 ? { background: 'var(--neon)', color: 'var(--neon-ink)' } : {}),
            }}>
              {i + 1}
            </div>
            <span style={{
              fontSize: 12,
              fontWeight: i === 3 ? 700 : 500,
              color: i === 3 ? 'var(--neon)' : 'rgba(255,255,255,.6)',
            }}>
              {step}
            </span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>결제 내역</h1>
          <p style={s.sub}>오늘의 주문 및 입금 현황을 관리합니다</p>
        </div>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statLabel}>총 주문</div>
          <div style={s.statValue} className="numeric">{totalOrders}</div>
        </div>
        <div style={{ ...s.statCard, background: 'color-mix(in oklab, var(--mint) 6%, white)', border: '1px solid color-mix(in oklab, var(--mint) 18%, white)' }}>
          <div style={s.statLabel}>입금 확인</div>
          <div style={{ ...s.statValue, color: 'var(--mint)' }} className="numeric">{confirmedCount}</div>
        </div>
        <div style={{ ...s.statCard, background: 'color-mix(in oklab, var(--amber) 8%, white)', border: '1px solid color-mix(in oklab, var(--amber) 20%, white)' }}>
          <div style={s.statLabel}>입금 대기</div>
          <div style={{ ...s.statValue, color: 'var(--amber)' }} className="numeric">{waitingCount}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>총 매출</div>
          <div style={s.statValue} className="numeric">{totalSales.toLocaleString()}원</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={s.toolbar}>
        <input
          type="text"
          placeholder="주문번호, 이름, 연락처 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={s.searchInput}
        />
        <div style={s.filterChips}>
          {(['전체', '입금 대기', '입금 확인', '완료', '취소'] as FilterTab[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...s.chip,
                ...(filter === f ? s.chipActive : {}),
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={exportCSV} className="btn btn-ghost btn-sm">CSV 내보내기</button>
        {waitingCount > 0 && (
          <button onClick={bulkConfirm} className="btn btn-sm" style={{ background: 'var(--mint)', color: '#fff', border: 0 }}>
            대기 {waitingCount}건 일괄 확인
          </button>
        )}
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-400)' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-400)' }}>결제 내역이 없습니다</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>주문번호</th>
                <th style={s.th}>테이블</th>
                <th style={s.th}>이름 · 연락처</th>
                <th style={s.th}>주문 내역</th>
                <th style={{ ...s.th, textAlign: 'right' }}>금액</th>
                <th style={s.th}>상태 · 경과</th>
                <th style={{ ...s.th, textAlign: 'center' }}>작업</th>
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
                    style={{
                      background: isOverdue
                        ? 'color-mix(in oklab, var(--crim) 5%, white)'
                        : isWarn
                        ? 'color-mix(in oklab, var(--amber) 6%, white)'
                        : r.paymentStatus === 'cancelled'
                        ? 'color-mix(in oklab, var(--crim) 3%, white)'
                        : 'transparent',
                      transition: 'background .15s ease',
                      cursor: 'pointer',
                      opacity: r.paymentStatus === 'cancelled' ? 0.6 : 1,
                    }}
                  >
                    <td style={s.td}>
                      <div style={{ fontWeight: 700, fontSize: 13 }} className="numeric">{r.orderNumber}</div>
                      <div className="numeric" style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 2 }}>
                        {new Date(r.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                      </div>
                    </td>
                    <td style={s.td}>
                      <span style={s.tableChip}>{r.tableNumber}</span>
                    </td>
                    <td style={s.td}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.customerName ?? '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>{r.customerPhone ?? '-'}</div>
                    </td>
                    <td style={{ ...s.td, maxWidth: 200 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.items}</div>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }} className="numeric">{r.amount.toLocaleString()}원</span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className={badge.cls}>{badge.label}</span>
                        {isWaiting && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 'var(--r-pill)',
                            fontSize: 11,
                            fontWeight: 600,
                            background: age.bg,
                            color: age.color,
                          }}>
                            {age.label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
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
      <div style={s.footer}>
        <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>
          총 {filtered.length}건 표시 중
        </span>
        {pendingAmount > 0 && (
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>
            대기 금액: {pendingAmount.toLocaleString()}원
          </span>
        )}
      </div>

      {/* Order Detail Modal */}
      {detailRow && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(14,18,32,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
            animation: 'fadeIn .15s ease',
          }}
          onClick={() => setDetailRow(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 'var(--r-lg)', padding: '28px 32px',
              maxWidth: 440, width: '90%', boxShadow: 'var(--shadow-3)',
              animation: 'pop .2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>주문 #{detailRow.orderNumber}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>{detailRow.tableNumber}번 테이블</div>
              </div>
              <button onClick={() => setDetailRow(null)} style={{
                width: 32, height: 32, borderRadius: '50%', border: 0, background: 'var(--ink-050)',
                cursor: 'pointer', fontSize: 16, color: 'var(--ink-400)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 주문 시간 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-400)', fontWeight: 600 }}>주문 시간</span>
                <span className="numeric" style={{ fontWeight: 600 }}>
                  {new Date(detailRow.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </span>
              </div>

              {/* 결제 방식 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-400)', fontWeight: 600 }}>결제 방식</span>
                <span style={{
                  fontWeight: 600, padding: '2px 10px', borderRadius: 'var(--r-pill)',
                  background: detailRow.method === 'toss' ? '#0064FF' : 'var(--ink-100)',
                  color: detailRow.method === 'toss' ? '#fff' : 'var(--ink-600)',
                  fontSize: 12,
                }}>
                  {detailRow.method === 'toss' ? '토스' : '계좌이체'}
                </span>
              </div>

              {/* 이름 · 연락처 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-400)', fontWeight: 600 }}>이름 · 연락처</span>
                <span style={{ fontWeight: 600 }}>
                  {detailRow.customerName ?? '-'} · {detailRow.customerPhone ?? '-'}
                </span>
              </div>

              {/* 구분선 */}
              <div style={{ height: 1, background: 'var(--ink-100)' }} />

              {/* 주문 내역 */}
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-400)', fontWeight: 600, marginBottom: 8 }}>주문 내역</div>
                <div style={{
                  background: 'var(--ink-050)', borderRadius: 'var(--r-sm)', padding: '12px 14px',
                  fontSize: 13, lineHeight: 1.7, color: 'var(--ink-700)',
                }}>
                  {detailRow.items.split(', ').map((item, i) => (
                    <div key={i}>{item}</div>
                  ))}
                </div>
              </div>

              {/* 요청사항 */}
              {detailRow.note && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)', fontWeight: 600, marginBottom: 6 }}>요청 사항</div>
                  <div style={{
                    background: 'color-mix(in oklab, var(--neon) 8%, white)',
                    border: '1px dashed var(--neon)', borderRadius: 'var(--r-sm)',
                    padding: '10px 14px', fontSize: 13, color: 'var(--neon-ink)', lineHeight: 1.5,
                  }}>
                    {detailRow.note}
                  </div>
                </div>
              )}

              {/* 구분선 */}
              <div style={{ height: 1, background: 'var(--ink-100)' }} />

              {/* 합계 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-400)' }}>결제 금액</span>
                <span className="numeric" style={{ fontSize: 22, fontWeight: 800 }}>{detailRow.amount.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={s.toast}>{toast}</div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '0 0 40px',
    maxWidth: 1060,
  },
  flowBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '14px 24px',
    background: 'linear-gradient(135deg, var(--ink-900) 0%, var(--ink-800) 100%)',
    flexWrap: 'wrap',
  },
  flowCircle: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'rgba(255,255,255,.12)',
    color: 'rgba(255,255,255,.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  header: {
    padding: '24px 28px 0',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
    lineHeight: 1.3,
  },
  sub: {
    fontSize: 13,
    color: 'var(--ink-400)',
    margin: '2px 0 0',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    padding: '0 28px',
    marginBottom: 20,
  },
  statCard: {
    background: 'var(--white)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '14px 16px',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--ink-400)',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 28px',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  searchInput: {
    height: 36,
    padding: '0 14px',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--border)',
    fontSize: 13,
    fontFamily: 'var(--f-sans)',
    width: 220,
    outline: 'none',
    background: 'var(--white)',
  },
  filterChips: {
    display: 'flex',
    gap: 4,
  },
  chip: {
    height: 32,
    padding: '0 14px',
    borderRadius: 'var(--r-pill)',
    border: '1px solid var(--border)',
    background: 'var(--white)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    color: 'var(--ink-500)',
    transition: 'all .12s ease',
  },
  chipActive: {
    background: 'var(--ink-900)',
    color: '#fff',
    border: '1px solid var(--ink-900)',
  },
  tableWrap: {
    margin: '0 28px',
    background: 'var(--white)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ink-400)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--ink-100)',
    background: 'var(--ink-050)',
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--ink-050)',
    fontSize: 13,
    verticalAlign: 'middle',
  },
  tableChip: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 'var(--r-sm)',
    background: 'var(--ink-900)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 28px',
  },
  toast: {
    position: 'fixed',
    bottom: 32,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--ink-900)',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: 'var(--r-md)',
    fontSize: 14,
    fontWeight: 600,
    boxShadow: 'var(--shadow-3)',
    animation: 'toastIn .2s ease',
    zIndex: 100,
  },
};
