'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem } from '@/lib/database.types';
import PinLogin from '@/components/PinLogin';

type KDSStatus = 'new' | 'cooking' | 'done' | 'served' | 'cancelled';
type FilterTab = '전체' | '신규' | '조리 중' | '완료 대기' | '오늘 완료';

interface Ticket {
  orderId: number;
  orderNumber: string;
  tableNumber: number;
  status: KDSStatus;
  note: string | null;
  items: { name: string; quantity: number; options: string | null }[];
  createdAt: string;
  updatedAt: string;
}

interface ConfirmDialog {
  action: string;
  label: string;
  ticket: Ticket;
  onConfirm: () => void;
}

const statusMap: Record<string, KDSStatus> = {
  accepted: 'new',
  cooking: 'cooking',
  ready: 'done',
  served: 'served',
  cancelled: 'cancelled',
};

export default function KitchenKDSPage() {
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('전체');
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ConfirmDialog | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [storeName, setStoreName] = useState<string>('주점');

  useEffect(() => {
    setAuthed(sessionStorage.getItem('admin_auth') === 'true');
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('store_settings').select('store_name').limit(1).single();
      if (data?.store_name) setStoreName(data.store_name);
    })();
  }, []);

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
        .in('status', ['accepted', 'cooking', 'ready', 'served', 'cancelled'])
        .order('created_at', { ascending: false }) as { data: Order[] | null };

      const allOrders = orders ?? [];
      const orderIds = allOrders.map((o) => o.id);

      let itemsMap: Record<number, { name: string; quantity: number; options: string | null }[]> = {};
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds) as { data: OrderItem[] | null };
        for (const it of items ?? []) {
          if (!itemsMap[it.order_id]) itemsMap[it.order_id] = [];
          itemsMap[it.order_id].push({ name: it.menu_name, quantity: it.quantity, options: it.options });
        }
      }

      setTickets(
        allOrders.map((o) => ({
          orderId: o.id,
          orderNumber: o.order_number,
          tableNumber: o.table_number,
          status: statusMap[o.status] ?? 'new',
          note: o.note,
          items: itemsMap[o.id] ?? [],
          createdAt: o.created_at,
          updatedAt: o.updated_at,
        }))
      );
    } catch (err) {
      console.error('KDS fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('kds-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { fetchData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // 1-second timer tick
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const updateStatus = async (orderId: number, newOrderStatus: string) => {
    await supabase.from('orders').update({ status: newOrderStatus, updated_at: new Date().toISOString() }).eq('id', orderId);
    fetchData();
  };

  const handleAction = (ticket: Ticket, action: string) => {
    if (action === 'accept') {
      setDialog({
        action: 'accept',
        label: '이 주문을 접수하고 조리를 시작하시겠습니까?',
        ticket,
        onConfirm: async () => {
          await updateStatus(ticket.orderId, 'cooking');
          showToast(`#${ticket.orderNumber} 조리 시작`);
          setDialog(null);
        },
      });
    } else if (action === 'done') {
      setDialog({
        action: 'done',
        label: '조리가 완료되었습니까?',
        ticket,
        onConfirm: async () => {
          await updateStatus(ticket.orderId, 'ready');
          showToast(`#${ticket.orderNumber} 조리 완료`);
          setDialog(null);
        },
      });
    } else if (action === 'served') {
      setDialog({
        action: 'served',
        label: '서빙이 완료되었습니까?',
        ticket,
        onConfirm: async () => {
          await updateStatus(ticket.orderId, 'served');
          await supabase.from('payments').update({ status: 'completed' }).eq('order_id', ticket.orderId);
          showToast(`#${ticket.orderNumber} 서빙 완료`);
          setDialog(null);
        },
      });
    } else if (action === 'cancel') {
      setDialog({
        action: 'cancel',
        label: '이 주문을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
        ticket,
        onConfirm: async () => {
          await updateStatus(ticket.orderId, 'cancelled');
          showToast(`#${ticket.orderNumber} 주문 취소됨`);
          setDialog(null);
        },
      });
    }
  };

  const getElapsedSec = (iso: string) => Math.floor((now - new Date(iso).getTime()) / 1000);
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s2 = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;
  };

  // Active tickets exclude served/cancelled; completed tickets are served/cancelled
  const activeTickets = tickets.filter((t) => t.status !== 'served' && t.status !== 'cancelled');
  const completedTickets = tickets.filter((t) => t.status === 'served' || t.status === 'cancelled');

  const filtered = (() => {
    if (filter === '전체') return activeTickets;
    if (filter === '신규') return activeTickets.filter((t) => t.status === 'new');
    if (filter === '조리 중') return activeTickets.filter((t) => t.status === 'cooking');
    if (filter === '완료 대기') return activeTickets.filter((t) => t.status === 'done');
    if (filter === '오늘 완료') return completedTickets;
    return activeTickets;
  })();

  const counts = {
    new: activeTickets.filter((t) => t.status === 'new').length,
    cooking: activeTickets.filter((t) => t.status === 'cooking').length,
    done: activeTickets.filter((t) => t.status === 'done').length,
    completed: completedTickets.length,
  };

  const statusRibbon = (status: KDSStatus) => {
    const map: Record<KDSStatus, { bg: string; label: string }> = {
      new: { bg: 'var(--coral)', label: '신규' },
      cooking: { bg: 'var(--amber)', label: '조리 중' },
      done: { bg: 'var(--mint)', label: '완료 대기' },
      served: { bg: 'var(--ink-400)', label: '서빙 완료' },
      cancelled: { bg: 'var(--crim)', label: '취소' },
    };
    return map[status] ?? { bg: 'var(--ink-400)', label: status };
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth');
    setAuthed(false);
  };

  if (!authChecked) return null;
  if (!authed) return <PinLogin onSuccess={() => setAuthed(true)} />;

  return (
    <div style={k.frame}>
      <div style={k.tablet}>
        {/* Top Bar */}
        <div style={k.topBar}>
          <div style={k.topLeft}>
            <div style={k.logo}>{storeName.charAt(0)}</div>
            <div>
              <div style={k.topTitle}>{storeName} · 주방 KDS</div>
            </div>
          </div>
          <div style={k.topStats}>
            <div style={k.topStat}>
              <span style={{ color: 'var(--coral)', fontWeight: 800, fontSize: 18 }} className="numeric">{counts.new}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-400)' }}>미처리</span>
            </div>
            <div style={k.topStat}>
              <span style={{ color: 'var(--amber)', fontWeight: 800, fontSize: 18 }} className="numeric">{counts.cooking}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-400)' }}>조리 중</span>
            </div>
            <div style={k.topStat}>
              <span style={{ fontWeight: 800, fontSize: 18 }} className="numeric">{counts.completed}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-400)' }}>오늘 완료</span>
            </div>
          </div>
          <div style={k.topRight}>
            <div style={k.wakeHint}>
              <span style={{ fontSize: 12 }}>화면 꺼짐 방지</span>
            </div>
            <button
              onClick={() => setPaused(!paused)}
              style={{
                ...k.pauseBtn,
                background: paused ? 'var(--crim)' : 'var(--ink-100)',
                color: paused ? '#fff' : 'var(--ink-600)',
              }}
            >
              {paused ? '일시정지 중' : '일시정지'}
            </button>
            <button onClick={handleLogout} style={k.logoutBtn}>
              로그아웃
            </button>
          </div>
        </div>

        {/* Filter Chips */}
        <div style={k.filterBar}>
          {(['전체', '신규', '조리 중', '완료 대기', '오늘 완료'] as FilterTab[]).map((f) => {
            const cnt = f === '전체' ? activeTickets.length : f === '신규' ? counts.new : f === '조리 중' ? counts.cooking : f === '완료 대기' ? counts.done : counts.completed;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  ...k.filterChip,
                  ...(filter === f ? k.filterChipActive : {}),
                }}
              >
                {f}
                <span style={{
                  padding: '1px 6px',
                  borderRadius: 'var(--r-pill)',
                  fontSize: 11,
                  fontWeight: 700,
                  background: filter === f ? 'rgba(255,255,255,.25)' : 'var(--ink-100)',
                  color: filter === f ? '#fff' : 'var(--ink-500)',
                }}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Ticket Grid */}
        <div style={k.grid}>
          {loading ? (
            <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--ink-400)' }}>
              불러오는 중...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: 60, textAlign: 'center', color: 'var(--ink-400)', fontSize: 15 }}>
              {filter === '전체' ? '대기 중인 주문이 없습니다' : `${filter} 주문이 없습니다`}
            </div>
          ) : (
            filtered.map((ticket) => {
              const elapsed = getElapsedSec(ticket.createdAt);
              const elapsedMin = Math.floor(elapsed / 60);
              const ribbon = statusRibbon(ticket.status);
              const isCompleted = ticket.status === 'served' || ticket.status === 'cancelled';
              const isOver10 = !isCompleted && elapsedMin >= 10;
              const isOver5 = !isCompleted && elapsedMin >= 5 && !isOver10;

              return (
                <div
                  key={ticket.orderId}
                  style={{
                    ...k.ticket,
                    ...(isCompleted ? { opacity: 0.55 } : {}),
                    border: isOver10
                      ? '2px solid var(--crim)'
                      : isOver5
                      ? '2px solid var(--amber)'
                      : '2px solid var(--border)',
                    boxShadow: isOver10
                      ? '0 0 12px rgba(229,53,53,.2)'
                      : isOver5
                      ? '0 0 8px rgba(255,166,61,.15)'
                      : 'var(--shadow-1)',
                    animation: isOver10 ? 'alertPing 2s infinite' : 'none',
                  }}
                >
                  {/* Status Ribbon */}
                  <div style={{ ...k.ribbon, background: ribbon.bg }}>
                    {ribbon.label}
                  </div>

                  {/* Header */}
                  <div style={k.ticketHeader}>
                    <div style={k.tableNum}>{ticket.tableNumber}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-400)', fontWeight: 500 }}>#{ticket.orderNumber}</div>
                    </div>
                    {!isCompleted && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: isOver10 ? 'var(--crim)' : isOver5 ? 'var(--amber)' : 'var(--mint)',
                          animation: isOver10 ? 'alertPing 1.5s infinite' : 'pulse 2s infinite',
                          flexShrink: 0,
                        }} />
                        <span style={{
                          fontSize: 16,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: isOver10 ? 'var(--crim)' : isOver5 ? 'var(--amber)' : 'var(--ink-600)',
                        }}>
                          {formatTimer(elapsed)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div style={k.itemsList}>
                    {(ticket.items ?? []).map((item, i) => (
                      <div key={i} style={k.itemRow}>
                        <span style={k.itemQty}>{item.quantity}</span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</span>
                        {item.options && (
                          <span style={{ fontSize: 11, color: 'var(--ink-400)', marginLeft: 4 }}>({item.options})</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Note */}
                  {ticket.note && (
                    <div style={k.note}>
                      {ticket.note}
                    </div>
                  )}

                  {/* Actions - not shown for completed/cancelled tickets */}
                  {!isCompleted && (
                    <div style={k.actions}>
                      {ticket.status === 'new' && (
                        <>
                          <button
                            onClick={() => handleAction(ticket, 'accept')}
                            style={{ ...k.actionBtn, background: 'var(--coral)', color: '#fff' }}
                          >
                            조리 시작
                          </button>
                          <button
                            onClick={() => handleAction(ticket, 'cancel')}
                            style={{ ...k.actionBtnSmall, color: 'var(--ink-400)' }}
                          >
                            취소
                          </button>
                        </>
                      )}
                      {ticket.status === 'cooking' && (
                        <button
                          onClick={() => handleAction(ticket, 'done')}
                          style={{ ...k.actionBtn, background: 'var(--amber)', color: '#fff' }}
                        >
                          조리 완료
                        </button>
                      )}
                      {ticket.status === 'done' && (
                        <button
                          onClick={() => handleAction(ticket, 'served')}
                          style={{ ...k.actionBtn, background: 'var(--mint)', color: '#fff' }}
                        >
                          서빙 완료
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pause Overlay */}
        {paused && (
          <div style={k.pauseOverlay}>
            <div style={k.pauseContent}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⏸</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>일시정지</div>
              <div style={{ fontSize: 14, color: 'var(--ink-400)', marginBottom: 24 }}>
                신규 주문 알림이 중단됩니다
              </div>
              <button
                onClick={() => setPaused(false)}
                className="btn"
                style={{ background: 'var(--ink-900)', color: '#fff', border: 0 }}
              >
                다시 시작
              </button>
            </div>
          </div>
        )}

        {/* Confirm Dialog */}
        {dialog && (
          <div style={k.dialogOverlay} onClick={() => setDialog(null)}>
            <div style={k.dialogBox} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                #{dialog.ticket.orderNumber} - 테이블 {dialog.ticket.tableNumber}
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-600)', marginBottom: 20 }}>
                {dialog.label}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDialog(null)}
                  className="btn btn-ghost btn-sm"
                >
                  취소
                </button>
                <button
                  onClick={dialog.onConfirm}
                  className="btn btn-sm"
                  style={{
                    background: dialog.action === 'cancel' ? 'var(--crim)' : 'var(--ink-900)',
                    color: '#fff',
                    border: 0,
                  }}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={k.toast}>{toast}</div>
        )}
      </div>
    </div>
  );
}

const k: Record<string, React.CSSProperties> = {
  frame: {
    minHeight: '100vh',
    background: '#E9E7DE',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '20px 0',
  },
  tablet: {
    width: 1280,
    maxWidth: '100%',
    minHeight: 800,
    aspectRatio: '16 / 10',
    background: 'var(--paper)',
    borderRadius: 22,
    boxShadow: 'var(--shadow-3)',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    background: 'var(--ink-900)',
    color: '#fff',
    gap: 16,
    flexShrink: 0,
  },
  topLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 'var(--r-sm)',
    background: 'var(--neon)',
    color: 'var(--neon-ink)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 16,
    flexShrink: 0,
  },
  topTitle: {
    fontSize: 15,
    fontWeight: 700,
  },
  topStats: {
    display: 'flex',
    gap: 24,
  },
  topStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  topRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  wakeHint: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 'var(--r-pill)',
    background: 'color-mix(in oklab, var(--amber) 20%, var(--ink-900))',
    color: 'var(--amber)',
    fontSize: 11,
    fontWeight: 600,
  },
  pauseBtn: {
    height: 32,
    padding: '0 14px',
    borderRadius: 'var(--r-pill)',
    border: 0,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    transition: 'all .12s ease',
  },
  logoutBtn: {
    height: 32,
    padding: '0 12px',
    borderRadius: 'var(--r-pill)',
    border: '1px solid rgba(255,255,255,.2)',
    background: 'transparent',
    color: 'rgba(255,255,255,.6)',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    transition: 'all .12s ease',
  },
  filterBar: {
    display: 'flex',
    gap: 6,
    padding: '12px 24px',
    borderBottom: '1px solid var(--ink-100)',
    background: 'var(--white)',
    flexShrink: 0,
  },
  filterChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 34,
    padding: '0 14px',
    borderRadius: 'var(--r-pill)',
    border: '1px solid var(--border)',
    background: 'var(--white)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    color: 'var(--ink-600)',
    transition: 'all .12s ease',
  },
  filterChipActive: {
    background: 'var(--ink-900)',
    color: '#fff',
    border: '1px solid var(--ink-900)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 14,
    padding: '16px 24px',
    overflowY: 'auto',
    flex: 1,
    alignContent: 'start',
  },
  ticket: {
    background: 'var(--white)',
    border: '2px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'border-color .15s ease, box-shadow .15s ease',
  },
  ribbon: {
    padding: '4px 14px',
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: '0.04em',
  },
  ticketHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px 8px',
  },
  tableNum: {
    width: 44,
    height: 44,
    borderRadius: 'var(--r-md)',
    background: 'var(--ink-900)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1,
    flexShrink: 0,
  },
  itemsList: {
    padding: '4px 14px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1,
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  itemQty: {
    width: 26,
    height: 26,
    borderRadius: 'var(--r-sm)',
    background: 'var(--ink-050)',
    border: '1px solid var(--ink-100)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 800,
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  note: {
    margin: '0 14px 8px',
    padding: '8px 12px',
    borderRadius: 'var(--r-sm)',
    border: '1.5px dashed var(--neon)',
    background: 'color-mix(in oklab, var(--neon) 6%, white)',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--neon-ink)',
    lineHeight: 1.4,
  },
  actions: {
    display: 'flex',
    gap: 6,
    padding: '8px 14px 12px',
    alignItems: 'center',
  },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 'var(--r-sm)',
    border: 0,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    transition: 'opacity .12s ease',
  },
  actionBtnSmall: {
    height: 38,
    padding: '0 12px',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--border)',
    background: 'transparent',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
  },
  pauseOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(14,18,32,.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    animation: 'fadeIn .2s ease',
  },
  pauseContent: {
    textAlign: 'center',
    color: '#fff',
  },
  dialogOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(14,18,32,.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
    animation: 'fadeIn .15s ease',
  },
  dialogBox: {
    background: 'var(--white)',
    borderRadius: 'var(--r-lg)',
    padding: '24px 28px',
    maxWidth: 380,
    width: '90%',
    boxShadow: 'var(--shadow-3)',
    animation: 'pop .2s ease',
    color: 'var(--text)',
  },
  toast: {
    position: 'absolute',
    bottom: 24,
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
    zIndex: 70,
    whiteSpace: 'nowrap',
  },
};
