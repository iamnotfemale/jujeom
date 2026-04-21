'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { adminApi } from '@/lib/admin-api';
import { useAdminStoreName } from '../layout';
import type { Order, Table, Payment, StoreSettings, OrderItem } from '@/lib/database.types';

interface DashboardStats {
  totalOrders: number;
  confirmedPayments: number;
  pendingPayments: number;
  totalSales: number;
}

interface RecentOrder {
  id: number;
  table_number: number;
  customer_name: string | null;
  items: string;
  final_amount: number;
  created_at: string;
  payment_status: string;
}

export default function DashboardPage() {
  const storeName = useAdminStoreName();
  const [isOpen, setIsOpen] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    confirmedPayments: 0,
    pendingPayments: 0,
    totalSales: 0,
  });
  const [tables, setTables] = useState<Table[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Fetch store settings
      const { data: settings } = await supabase
        .from('store_settings')
        .select('*')
        .single() as { data: StoreSettings | null };
      if (settings) setIsOpen(settings.is_open);

      // Fetch today's orders
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false }) as { data: Order[] | null };

      const todayOrders = orders ?? [];

      // Fetch payments for today's orders
      const orderIds = todayOrders.map((o) => o.id);
      let payments: Payment[] = [];
      if (orderIds.length > 0) {
        const { data: payData } = await supabase
          .from('payments')
          .select('*')
          .in('order_id', orderIds) as { data: Payment[] | null };
        payments = payData ?? [];
      }

      const confirmed = payments.filter((p) => p.status === 'confirmed' || p.status === 'completed');
      const pending = payments.filter((p) => p.status === 'waiting');
      // 매출 합계: confirmed/completed만 포함 (waiting, cancelled 제외)
      const totalSales = confirmed.reduce((s, p) => s + (Number.isFinite(p.amount) ? p.amount : 0), 0);

      setStats({
        totalOrders: todayOrders.length,
        confirmedPayments: confirmed.length,
        pendingPayments: pending.length,
        totalSales,
      });

      // Fetch tables
      const { data: tableData } = await supabase
        .from('tables')
        .select('*')
        .order('number', { ascending: true }) as { data: Table[] | null };
      setTables(tableData ?? []);

      // Build recent orders with items
      const recent = todayOrders.slice(0, 5);
      const recentIds = recent.map((o) => o.id);
      let itemsMap: Record<number, string> = {};
      if (recentIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('order_id, menu_name, quantity')
          .in('order_id', recentIds) as { data: Pick<OrderItem, 'order_id' | 'menu_name' | 'quantity'>[] | null };
        if (items) {
          for (const item of items) {
            const label = item.quantity > 1 ? `${item.menu_name} x${item.quantity}` : item.menu_name;
            itemsMap[item.order_id] = itemsMap[item.order_id]
              ? `${itemsMap[item.order_id]}, ${label}`
              : label;
          }
        }
      }

      const paymentMap: Record<number, Payment> = {};
      for (const p of payments) {
        paymentMap[p.order_id] = p;
      }

      setRecentOrders(
        recent.map((o) => ({
          id: o.id,
          table_number: o.table_number,
          customer_name: paymentMap[o.id]?.customer_name ?? null,
          items: itemsMap[o.id] ?? '-',
          final_amount: o.final_amount,
          created_at: o.created_at,
          payment_status: paymentMap[o.id]?.status ?? 'waiting',
        }))
      );
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    // 초기화 broadcast 수신
    const resetChannel = supabase
      .channel('data-reset-dashboard')
      .on('broadcast', { event: 'reset' }, () => fetchData())
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(resetChannel); };
  }, [fetchData]);


  const toggleOpen = async () => {
    const next = !isOpen;
    setIsOpen(next);
    const { error } = await adminApi('/api/admin/settings', { method: 'PATCH', body: { is_open: next } });
    if (error) {
      // 롤백
      setIsOpen(!next);
    }
  };

  const todayStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  const timeAgo = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diff < 1) return '방금';
    if (diff < 60) return `${diff}분 전`;
    return `${Math.floor(diff / 60)}시간 전`;
  };

  const tableStatusLabel = (s: string) => {
    switch (s) {
      case 'occupied': return '이용 중';
      case 'payment_pending': return '입금 대기';
      default: return '빈 테이블';
    }
  };

  // Sales breakdown for donut (0으로 나눔 방지)
  const hasData = stats.totalOrders > 0;
  const safeMintPct = hasData ? Math.round((stats.confirmedPayments / stats.totalOrders) * 100) : 0;
  const safeAmberPct = hasData ? Math.round((stats.pendingPayments / stats.totalOrders) * 100) : 0;
  const mintPct = Number.isFinite(safeMintPct) ? Math.max(0, Math.min(100, safeMintPct)) : 0;
  const amberPct = Number.isFinite(safeAmberPct) ? Math.max(0, Math.min(100, safeAmberPct)) : 0;
  const restPct = Math.max(0, 100 - mintPct - amberPct);

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>대시보드</h1>
            <p style={s.date}>{todayStr}</p>
          </div>
        </div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-400)' }}>
          불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{storeName} · 대시보드</h1>
          <p style={s.date}>{todayStr}</p>
        </div>
        <button onClick={toggleOpen} style={{ ...s.toggleBtn, background: isOpen ? 'var(--mint)' : 'var(--ink-300)' }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isOpen ? '#fff' : 'var(--ink-500)',
            animation: isOpen ? 'pulse 2s infinite' : 'none',
            flexShrink: 0,
          }} />
          {isOpen ? '영업 중' : '영업 종료'}
        </button>
      </div>

      {/* Alert banner */}
      {stats.pendingPayments > 0 && (
        <Link href="/admin/payments" style={s.alertBanner}>
          <span style={s.alertDot} />
          <span>입금 대기 중인 주문이 <strong>{stats.pendingPayments}건</strong> 있어요</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.8 }}>확인하기 &rarr;</span>
        </Link>
      )}

      {/* Stats row */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statLabel}>오늘 총 주문</div>
          <div style={s.statValue} className="numeric">{stats.totalOrders}</div>
        </div>
        <div style={{ ...s.statCard, ...s.statCardMint }}>
          <div style={s.statLabel}>입금 확인</div>
          <div style={{ ...s.statValue, color: 'var(--mint)' }} className="numeric">{stats.confirmedPayments}</div>
        </div>
        <div style={{ ...s.statCard, ...s.statCardWarn }}>
          <div style={s.statLabel}>입금 대기</div>
          <div style={{ ...s.statValue, color: 'var(--crim)' }} className="numeric">{stats.pendingPayments}</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statLabel}>오늘 총 매출</div>
          <div style={s.statValue} className="numeric">{stats.totalSales.toLocaleString()}원</div>
        </div>
      </div>

      {/* Two column layout */}
      <div style={s.columns}>
        {/* Left: Tables grid */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <h2 style={s.panelTitle}>테이블 현황</h2>
            <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>
              {tables.filter((t) => t.status !== 'empty').length}/{tables.length} 이용 중
            </span>
          </div>
          <div style={s.tablesGrid}>
            {tables.map((table) => (
              <div
                key={table.id}
                style={{
                  ...s.tableCell,
                  ...(table.status === 'occupied' ? s.tableCellActive : {}),
                  ...(table.status === 'payment_pending' ? s.tableCellPending : {}),
                  ...(table.status === 'empty' ? s.tableCellEmpty : {}),
                }}
              >
                <div style={s.tableNumber}>{table.number}</div>
                <div style={s.tableStatus}>
                  {table.status === 'payment_pending' && (
                    <span style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--amber)',
                      animation: 'ping 2s infinite',
                      marginRight: 4,
                      verticalAlign: 'middle',
                    }} />
                  )}
                  {tableStatusLabel(table.status)}
                </div>
              </div>
            ))}
            {/* Show placeholder cells if fewer than 15 tables */}
            {tables.length < 15 && Array.from({ length: Math.max(0, 15 - tables.length) }).map((_, i) => (
              <div key={`empty-${i}`} style={{ ...s.tableCell, ...s.tableCellEmpty }}>
                <div style={s.tableNumber}>-</div>
                <div style={s.tableStatus}>미사용</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Sales donut */}
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <h2 style={s.panelTitle}>매출 현황</h2>
            </div>
            {hasData && stats.totalSales > 0 ? (
              <div style={s.donutWrap}>
                <div
                  style={{
                    ...s.donut,
                    background: `conic-gradient(var(--mint) 0% ${mintPct}%, var(--amber) ${mintPct}% ${mintPct + amberPct}%, var(--ink-200) ${mintPct + amberPct}% 100%)`,
                  }}
                >
                  <div style={s.donutCenter}>
                    <div style={{ fontSize: 18, fontWeight: 700 }} className="numeric">
                      {stats.totalSales.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>원</div>
                  </div>
                </div>
                <div style={s.donutLegend}>
                  <div style={s.legendItem}>
                    <span style={{ ...s.legendDot, background: 'var(--mint)' }} />
                    입금 확인 {mintPct}%
                  </div>
                  <div style={s.legendItem}>
                    <span style={{ ...s.legendDot, background: 'var(--amber)' }} />
                    입금 대기 {amberPct}%
                  </div>
                  <div style={s.legendItem}>
                    <span style={{ ...s.legendDot, background: 'var(--ink-200)' }} />
                    기타 {restPct}%
                  </div>
                </div>
              </div>
            ) : (
              <div style={s.donutEmpty}>
                <div style={{ fontSize: 13, color: 'var(--ink-400)', fontWeight: 500, textAlign: 'center' }}>
                  아직 주문이 없습니다
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-300)', marginTop: 6, textAlign: 'center' }}>
                  첫 주문이 들어오면 매출 현황이 표시됩니다
                </div>
              </div>
            )}
          </div>

          {/* Recent orders */}
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <h2 style={s.panelTitle}>최근 주문</h2>
              <Link href="/admin/payments" style={{ fontSize: 12, color: 'var(--ink-400)', textDecoration: 'none' }}>
                전체 보기 &rarr;
              </Link>
            </div>
            <div style={s.orderList}>
              {recentOrders.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-400)', fontSize: 13 }}>
                  오늘 주문이 없어요
                </div>
              )}
              {recentOrders.map((order) => (
                <div key={order.id} style={s.orderRow}>
                  <span style={s.orderTableChip}>{order.table_number}</span>
                  <div style={s.orderInfo}>
                    <div style={s.orderName}>
                      {order.customer_name ?? `테이블 ${order.table_number}`}
                    </div>
                    <div style={s.orderItems}>{order.items}</div>
                  </div>
                  <div style={s.orderRight}>
                    <div style={s.orderAmount} className="numeric">
                      {order.final_amount.toLocaleString()}원
                    </div>
                    <div style={s.orderTime}>{timeAgo(order.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '24px 28px 40px',
    maxWidth: 1060,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
    lineHeight: 1.3,
  },
  date: {
    fontSize: 13,
    color: 'var(--ink-400)',
    margin: '2px 0 0',
  },
  toggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 18px',
    borderRadius: 'var(--r-pill)',
    border: 0,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    transition: 'background .15s ease',
  },
  alertBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 18px',
    borderRadius: 'var(--r-md)',
    background: 'color-mix(in oklab, var(--crim) 8%, white)',
    border: '1px solid color-mix(in oklab, var(--crim) 20%, white)',
    color: '#8e0f0f',
    fontSize: 14,
    fontWeight: 500,
    textDecoration: 'none',
    marginBottom: 20,
    transition: 'background .12s ease',
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--crim)',
    animation: 'alertPing 2s infinite',
    flexShrink: 0,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    background: 'var(--white)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '14px 16px',
  },
  statCardMint: {
    background: 'color-mix(in oklab, var(--mint) 6%, white)',
    border: '1px solid color-mix(in oklab, var(--mint) 18%, white)',
  },
  statCardWarn: {
    background: 'color-mix(in oklab, var(--crim) 5%, white)',
    border: '1px solid color-mix(in oklab, var(--crim) 15%, white)',
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
  columns: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr',
    gap: 16,
    alignItems: 'start',
  },
  panel: {
    background: 'var(--white)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--ink-100)',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: 700,
    margin: 0,
  },
  tablesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 8,
    padding: 14,
  },
  tableCell: {
    aspectRatio: '1/1',
    borderRadius: 'var(--r-md)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    transition: 'background .15s ease',
  },
  tableCellEmpty: {
    border: '2px dashed var(--ink-200)',
    background: 'transparent',
  },
  tableCellActive: {
    background: 'var(--ink-900)',
    color: '#fff',
  },
  tableCellPending: {
    background: 'color-mix(in oklab, var(--amber) 14%, white)',
    border: '2px solid var(--amber)',
  },
  tableNumber: {
    fontSize: 20,
    fontWeight: 800,
    lineHeight: 1,
  },
  tableStatus: {
    fontSize: 10,
    fontWeight: 500,
    opacity: 0.7,
    lineHeight: 1.3,
  },
  donutWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    padding: '20px 18px',
  },
  donutEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 18px',
    minHeight: 160,
  },
  donut: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    position: 'relative',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'var(--white)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutLegend: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--ink-600)',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  orderList: {
    display: 'flex',
    flexDirection: 'column',
  },
  orderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 18px',
    borderBottom: '1px solid var(--ink-050)',
  },
  orderTableChip: {
    width: 32,
    height: 32,
    borderRadius: 'var(--r-sm)',
    background: 'var(--ink-900)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  orderInfo: {
    flex: 1,
    minWidth: 0,
  },
  orderName: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  orderItems: {
    fontSize: 12,
    color: 'var(--ink-400)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.4,
  },
  orderRight: {
    textAlign: 'right',
    flexShrink: 0,
  },
  orderAmount: {
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.3,
  },
  orderTime: {
    fontSize: 11,
    color: 'var(--ink-400)',
    lineHeight: 1.4,
  },
};
