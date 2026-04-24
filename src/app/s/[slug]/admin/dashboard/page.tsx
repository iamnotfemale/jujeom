'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { adminApi } from '@/lib/admin-api';
import { useAdminStoreName } from '../AdminShell';
import { useStore } from '../../StoreProvider';
import type { Order, Table, Payment, OrderItem } from '@/lib/database.types';
import { formatPrice, formatTimeAgo } from '@/lib/formatters';

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
  const store = useStore();
  const storeName = useAdminStoreName();
  const [isOpen, setIsOpen] = useState(store.is_open);
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
      // Fetch today's orders (이 가게 한정)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', store.id)
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
          .eq('store_id', store.id)
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

      // Fetch tables (이 가게의 실제 고객 테이블만)
      const { data: tableData } = await supabase
        .from('tables')
        .select('*')
        .eq('store_id', store.id)
        .eq('kind', 'table')
        .order('number', { ascending: true }) as { data: Table[] | null };
      setTables(tableData ?? []);

      // Build recent orders with items
      const recent = todayOrders.slice(0, 5);
      const recentIds = recent.map((o) => o.id);
      const itemsMap: Record<number, string> = {};
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
  }, [store.id]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    // 초기화 broadcast 수신
    const resetChannel = supabase
      .channel(`data-reset-dashboard:${store.slug}`)
      .on('broadcast', { event: 'reset' }, () => fetchData())
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(resetChannel); };
  }, [fetchData]);


  const toggleOpen = async () => {
    const next = !isOpen;
    setIsOpen(next);
    const { error } = await adminApi(`/api/stores/${store.slug}`, { method: 'PATCH', body: { is_open: next } });
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
      <div className="px-7 pt-6 pb-10 max-w-[1060px]">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-[22px] font-extrabold m-0 leading-[1.3]">대시보드</h1>
            <p className="text-[13px] text-[var(--ink-400)] mt-[2px] mb-0">{todayStr}</p>
          </div>
        </div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-400)' }}>
          불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="px-7 pt-6 pb-10 max-w-[1060px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-extrabold m-0 leading-[1.3]">{storeName} · 대시보드</h1>
          <p className="text-[13px] text-[var(--ink-400)] mt-[2px] mb-0">{todayStr}</p>
        </div>
        <button
          onClick={toggleOpen}
          className="inline-flex items-center gap-2 py-2 px-[18px] rounded-[var(--r-pill)] border-0 text-white text-[13px] font-bold cursor-pointer transition-[background_.15s_ease]"
          style={{ background: isOpen ? 'var(--mint)' : 'var(--ink-300)' }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: isOpen ? '#fff' : 'var(--ink-500)',
              animation: isOpen ? 'pulse 2s infinite' : 'none',
            }}
          />
          {isOpen ? '영업 중' : '영업 종료'}
        </button>
      </div>

      {/* Alert banner */}
      {stats.pendingPayments > 0 && (
        <Link
          href={`/s/${store.slug}/admin/payments?filter=waiting`}
          className="flex items-center gap-[10px] py-3 px-[18px] rounded-[var(--r-md)] text-[#8e0f0f] text-sm font-medium no-underline mb-5 transition-[background_.12s_ease]"
          style={{
            background: 'color-mix(in oklab, var(--crim) 8%, white)',
            border: '1px solid color-mix(in oklab, var(--crim) 20%, white)',
          }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: 'var(--crim)', animation: 'alertPing 2s infinite' }}
          />
          <span>입금 대기 중인 주문이 <strong>{stats.pendingPayments}건</strong> 있어요</span>
          <span className="ml-auto text-[13px] opacity-80">확인하기 &rarr;</span>
        </Link>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-[var(--white)] border border-[var(--border)] rounded-[var(--r-lg)] py-[14px] px-4">
          <div className="text-xs font-medium text-[var(--ink-400)] mb-[6px]">오늘 총 주문</div>
          <div className="text-[26px] font-extrabold leading-[1.2] tracking-[-0.02em] numeric">{stats.totalOrders}</div>
        </div>
        <div
          className="border rounded-[var(--r-lg)] py-[14px] px-4"
          style={{
            background: 'color-mix(in oklab, var(--mint) 6%, white)',
            border: '1px solid color-mix(in oklab, var(--mint) 18%, white)',
          }}
        >
          <div className="text-xs font-medium text-[var(--ink-400)] mb-[6px]">입금 확인</div>
          <div className="text-[26px] font-extrabold leading-[1.2] tracking-[-0.02em] text-[var(--mint)] numeric">{stats.confirmedPayments}</div>
        </div>
        <div
          className="border rounded-[var(--r-lg)] py-[14px] px-4"
          style={{
            background: 'color-mix(in oklab, var(--crim) 5%, white)',
            border: '1px solid color-mix(in oklab, var(--crim) 15%, white)',
          }}
        >
          <div className="text-xs font-medium text-[var(--ink-400)] mb-[6px]">입금 대기</div>
          <div className="text-[26px] font-extrabold leading-[1.2] tracking-[-0.02em] text-[var(--crim)] numeric">{stats.pendingPayments}</div>
        </div>
        <div className="bg-[var(--white)] border border-[var(--border)] rounded-[var(--r-lg)] py-[14px] px-4">
          <div className="text-xs font-medium text-[var(--ink-400)] mb-[6px]">오늘 총 매출</div>
          <div className="text-[26px] font-extrabold leading-[1.2] tracking-[-0.02em] numeric">{formatPrice(stats.totalSales)}</div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        {/* Left: Tables grid */}
        <div className="bg-[var(--white)] border border-[var(--border)] rounded-[var(--r-lg)] overflow-hidden">
          <div className="flex items-center justify-between py-[14px] px-[18px] border-b border-[var(--ink-100)]">
            <h2 className="text-[15px] font-bold m-0">테이블 현황</h2>
            <span className="text-xs text-[var(--ink-400)]">
              {tables.filter((t) => t.status !== 'empty').length}/{tables.length} 이용 중
            </span>
          </div>
          <div className="grid gap-2 p-[14px]" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {tables.map((table) => (
              <div
                key={table.id}
                className="aspect-square rounded-[var(--r-md)] flex flex-col items-center justify-center gap-1 transition-[background_.15s_ease]"
                style={
                  table.status === 'occupied'
                    ? { background: 'var(--ink-900)', color: '#fff' }
                    : table.status === 'payment_pending'
                    ? { background: 'color-mix(in oklab, var(--amber) 14%, white)', border: '2px solid var(--amber)' }
                    : { border: '2px dashed var(--ink-200)', background: 'transparent' }
                }
              >
                <div className="text-xl font-extrabold leading-none">{table.number}</div>
                <div className="text-[10px] font-medium opacity-70 leading-[1.3]">
                  {table.status === 'payment_pending' && (
                    <span
                      className="inline-block w-[6px] h-[6px] rounded-full mr-1 align-middle"
                      style={{ background: 'var(--amber)', animation: 'ping 2s infinite' }}
                    />
                  )}
                  {tableStatusLabel(table.status)}
                </div>
              </div>
            ))}
            {/* Show placeholder cells if fewer than 15 tables */}
            {tables.length < 15 && Array.from({ length: Math.max(0, 15 - tables.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-square rounded-[var(--r-md)] flex flex-col items-center justify-center gap-1 transition-[background_.15s_ease]"
                style={{ border: '2px dashed var(--ink-200)', background: 'transparent' }}
              >
                <div className="text-xl font-extrabold leading-none">-</div>
                <div className="text-[10px] font-medium opacity-70 leading-[1.3]">미사용</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Sales donut */}
          <div className="bg-[var(--white)] border border-[var(--border)] rounded-[var(--r-lg)] overflow-hidden">
            <div className="flex items-center justify-between py-[14px] px-[18px] border-b border-[var(--ink-100)]">
              <h2 className="text-[15px] font-bold m-0">매출 현황</h2>
            </div>
            {hasData && stats.totalSales > 0 ? (
              <div className="flex items-center gap-6 py-5 px-[18px]">
                <div
                  className="w-[120px] h-[120px] rounded-full relative shrink-0 flex items-center justify-center"
                  style={{
                    background: `conic-gradient(var(--mint) 0% ${mintPct}%, var(--amber) ${mintPct}% ${mintPct + amberPct}%, var(--ink-200) ${mintPct + amberPct}% 100%)`,
                  }}
                >
                  <div className="w-[72px] h-[72px] rounded-full bg-[var(--white)] flex flex-col items-center justify-center">
                    <div className="text-lg font-bold numeric">
                      {stats.totalSales.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-[var(--ink-400)]">원</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--ink-600)]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--mint)' }} />
                    입금 확인 {mintPct}%
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--ink-600)]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--amber)' }} />
                    입금 대기 {amberPct}%
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--ink-600)]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--ink-200)' }} />
                    기타 {restPct}%
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-[18px] min-h-[160px]">
                <div className="text-[13px] text-[var(--ink-400)] font-medium text-center">
                  아직 주문이 없습니다
                </div>
                <div className="text-[11px] text-[var(--ink-300)] mt-[6px] text-center">
                  첫 주문이 들어오면 매출 현황이 표시됩니다
                </div>
              </div>
            )}
          </div>

          {/* Recent orders */}
          <div className="bg-[var(--white)] border border-[var(--border)] rounded-[var(--r-lg)] overflow-hidden">
            <div className="flex items-center justify-between py-[14px] px-[18px] border-b border-[var(--ink-100)]">
              <h2 className="text-[15px] font-bold m-0">최근 주문</h2>
              <Link href={`/s/${store.slug}/admin/payments`} className="text-xs text-[var(--ink-400)] no-underline">
                전체 보기 &rarr;
              </Link>
            </div>
            <div className="flex flex-col">
              {recentOrders.length === 0 && (
                <div className="p-5 text-center text-[var(--ink-400)] text-[13px]">
                  오늘 주문이 없어요
                </div>
              )}
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center gap-3 py-3 px-[18px] border-b border-[var(--ink-050)]">
                  <span className="w-8 h-8 rounded-[var(--r-sm)] bg-[var(--ink-900)] text-white flex items-center justify-center text-[13px] font-bold shrink-0">
                    {order.table_number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold leading-[1.3]">
                      {order.customer_name ?? `테이블 ${order.table_number}`}
                    </div>
                    <div className="text-xs text-[var(--ink-400)] whitespace-nowrap overflow-hidden text-ellipsis leading-[1.4]">{order.items}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13px] font-bold leading-[1.3] numeric">
                      {formatPrice(order.final_amount)}
                    </div>
                    <div className="text-[11px] text-[var(--ink-400)] leading-[1.4]">{formatTimeAgo(order.created_at)}</div>
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
