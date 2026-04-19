'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import QRCode from 'react-qr-code';
import { supabase } from '@/lib/supabase';
import type { Table, TableStatus, Order, Payment } from '@/lib/database.types';

/* ── Constants ─────────────────────── */
const GRID = 40;
const CANVAS_W = 960;
const CANVAS_H = 640;
const TABLE_DIMS: Record<string, { w: number; h: number }> = {
  'square-2': { w: 120, h: 64 },
  'square-4': { w: 140, h: 76 },
};
const TOOLS_W = 240;
const DETAIL_W = 360;
const TRANSITION = 'grid-template-columns 0.28s cubic-bezier(.4,0,.2,1)';

/* ── Helpers ─────────────────────── */
const snap = (v: number) => Math.round(v / GRID) * GRID;
const tableDims = (shape: Table['shape']) => TABLE_DIMS[shape] ?? TABLE_DIMS['square-4'];
const formatElapsed = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return '0분';
  if (diff < 60) return `${diff}분`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
};
const statusLabel = (s: TableStatus) => {
  switch (s) {
    case 'occupied': return '이용 중';
    case 'payment_pending': return '입금 대기';
    default: return '비어 있음';
  }
};
const statusBadge = (s: TableStatus) => {
  switch (s) {
    case 'occupied': return 'badge-ink';
    case 'payment_pending': return 'badge-amber';
    default: return 'badge-neutral';
  }
};
const timeAgo = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return '방금';
  if (diff < 60) return `${diff}분 전`;
  return `${Math.floor(diff / 60)}시간 전`;
};

/* ── Component ─────────────────────── */
export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [tableStats, setTableStats] = useState<Record<number, { earliest: string; total: number }>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);

  const selectedTable = tables.find((t) => t.id === selectedId) ?? null;

  /* ── Toast helper ─────────────────────── */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  /* ── Fetch tables ─────────────────────── */
  const fetchTables = useCallback(async () => {
    const { data } = await supabase
      .from('tables')
      .select('*')
      .order('number', { ascending: true }) as { data: Table[] | null };
    setTables(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  /* ── Fetch table stats (elapsed time & order totals) ─── */
  const fetchTableStats = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: orders } = await supabase
      .from('orders')
      .select('table_id, created_at, final_amount, status')
      .gte('created_at', todayStart.toISOString())
      .not('status', 'in', '("served","cancelled")');

    const stats: Record<number, { earliest: string; total: number }> = {};
    for (const o of orders ?? []) {
      if (!stats[o.table_id]) stats[o.table_id] = { earliest: o.created_at, total: 0 };
      if (o.created_at < stats[o.table_id].earliest) stats[o.table_id].earliest = o.created_at;
      stats[o.table_id].total += o.final_amount;
    }
    setTableStats(stats);
  }, []);

  useEffect(() => {
    fetchTableStats();
    const interval = setInterval(fetchTableStats, 30000);
    return () => clearInterval(interval);
  }, [fetchTableStats]);

  /* ── Force re-render every 30s to keep elapsed times current ─── */
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  /* ── Fetch detail data for selected table ─────────── */
  useEffect(() => {
    if (!selectedTable) {
      setRecentOrders([]);
      setRecentPayments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('table_id', selectedTable.id)
        .order('created_at', { ascending: false })
        .limit(5) as { data: Order[] | null };
      if (cancelled) return;
      setRecentOrders(orders ?? []);
      const orderIds = (orders ?? []).map((o) => o.id);
      if (orderIds.length > 0) {
        const { data: payments } = await supabase
          .from('payments')
          .select('*')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false }) as { data: Payment[] | null };
        if (!cancelled) setRecentPayments(payments ?? []);
      } else {
        setRecentPayments([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTable]);

  /* ── Add table ─────────────────────── */
  const addTable = async (shape: Table['shape']) => {
    const maxNum = tables.reduce((m, t) => Math.max(m, t.number), 0);
    const newNum = maxNum + 1;
    // Find a free spot
    const dim = tableDims(shape);
    let px = GRID * 2;
    let py = GRID * 2;
    const occupied = new Set(tables.map((t) => `${t.position_x},${t.position_y}`));
    while (occupied.has(`${px},${py}`)) {
      px += GRID * 4;
      if (px + dim.w > CANVAS_W) {
        px = GRID * 2;
        py += GRID * 3;
      }
      if (py + dim.h > CANVAS_H) break;
    }
    const { data, error } = await supabase.from('tables')
      .insert({ number: newNum, shape, position_x: px, position_y: py, status: 'empty' as TableStatus })
      .select()
      .single();
    if (error) {
      showToast('추가 실패');
      return;
    }
    setTables((prev) => [...prev, data as Table]);
    setSelectedId((data as Table).id);
    showToast(`테이블 ${newNum} 추가됨`);
  };

  /* ── Save positions ─────────────────────── */
  const savePositions = async () => {
    const promises = tables.map((t) =>
      supabase.from('tables')
        .update({ position_x: t.position_x, position_y: t.position_y })
        .eq('id', t.id)
    );
    await Promise.all(promises);
    showToast('저장됨');
  };

  /* ── Delete all tables ─────────────────────── */
  const deleteAllTables = async () => {
    const ids = tables.map((t) => t.id);
    if (ids.length === 0) return;
    await supabase.from('tables').delete().in('id', ids);
    setTables([]);
    setSelectedId(null);
    showToast('삭제됨');
  };

  /* ── Drag handlers ─────────────────────── */
  const onPointerDown = (e: React.PointerEvent, table: Table) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragRef.current = {
      id: table.id,
      offsetX: e.clientX - rect.left - table.position_x,
      offsetY: e.clientY - rect.top - table.position_y,
    };
    setSelectedId(table.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left - dragRef.current.offsetX;
    const rawY = e.clientY - rect.top - dragRef.current.offsetY;
    const t = tables.find((t) => t.id === dragRef.current!.id);
    if (!t) return;
    const dim = tableDims(t.shape);
    const x = Math.max(0, Math.min(snap(rawX), CANVAS_W - dim.w));
    const y = Math.max(0, Math.min(snap(rawY), CANVAS_H - dim.h));
    setTables((prev) =>
      prev.map((tbl) => (tbl.id === dragRef.current!.id ? { ...tbl, position_x: x, position_y: y } : tbl))
    );
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  /* ── Toggle table status ─────────────────────── */
  const toggleTableStatus = async (tableId: number, newStatus: string) => {
    await supabase.from('tables').update({ status: newStatus }).eq('id', tableId);
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus as TableStatus } : t));
    showToast(newStatus === 'empty' ? '빈 테이블로 변경' : '사용 중으로 변경');
  };

  /* ── QR download ─────────────────────── */
  const downloadQR = () => {
    if (!selectedTable) return;
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 256, 256);
      ctx.drawImage(img, 0, 0, 256, 256);
      const a = document.createElement('a');
      a.download = `table-${selectedTable.number}-qr.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  /* ── Canvas click deselect ─────────────────────── */
  const onCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) setSelectedId(null);
  };

  const qrUrl = selectedTable
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/order?table=${selectedTable.number}`
    : '';

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-400)' }}>
        불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Main 3-panel grid ─────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: toolsOpen ? `${TOOLS_W}px 1fr ${selectedTable ? DETAIL_W + 'px' : '0px'}` : `0px 1fr ${selectedTable ? DETAIL_W + 'px' : '0px'}`,
          transition: TRANSITION,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* ── Tools Panel (left) ─────────────────────── */}
        <div
          style={{
            background: 'var(--white)',
            borderRight: '1px solid var(--border)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <div style={{ width: TOOLS_W, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 20, flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--ink-600)' }}>테이블 추가</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1, flexDirection: 'column', height: 60, gap: 4, fontSize: 12 }}
                  onClick={() => addTable('square-2')}
                >
                  <span style={{ fontSize: 20 }}>&#9634;</span>
                  2인석
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1, flexDirection: 'column', height: 60, gap: 4, fontSize: 12 }}
                  onClick={() => addTable('square-4')}
                >
                  <span style={{ fontSize: 24 }}>&#9634;</span>
                  4인석
                </button>
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--ink-600)' }}>
              테이블 수: <strong style={{ color: 'var(--ink-900)' }}>{tables.length}</strong>개
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="btn btn-accent btn-block btn-sm"
                onClick={savePositions}
              >
                저장
              </button>
              <button
                className="btn btn-ghost btn-block btn-sm"
                style={{ color: 'var(--crim)', border: '1px solid color-mix(in oklab, var(--crim) 30%, white)' }}
                onClick={() =>
                  setConfirmDialog({
                    message: '모든 테이블을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
                    onConfirm: () => {
                      deleteAllTables();
                      setConfirmDialog(null);
                    },
                  })
                }
              >
                전체 삭제
              </button>
            </div>
          </div>
        </div>

        {/* ── Canvas (center) ─────────────────────── */}
        <div style={{ position: 'relative', overflow: 'auto', background: '#F2F1EA' }}>
          {/* Toggle tools button */}
          <button
            onClick={() => setToolsOpen((v) => !v)}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 20,
              width: 40,
              height: 40,
              background: 'var(--ink-900)',
              color: '#fff',
              border: 0,
              borderRadius: 'var(--r-sm)',
              cursor: 'pointer',
              fontSize: 18,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--f-sans)',
              transition: 'transform 0.28s cubic-bezier(.4,0,.2,1)',
              transform: toolsOpen ? 'scaleX(-1)' : 'scaleX(1)',
            }}
            title={toolsOpen ? '패널 닫기' : '패널 열기'}
          >
            &#8811;
          </button>

          {/* Canvas area */}
          <div
            ref={canvasRef}
            onClick={onCanvasClick}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              position: 'relative',
              width: CANVAS_W,
              height: CANVAS_H,
              margin: '56px auto 40px',
              backgroundImage:
                'linear-gradient(to right, rgba(0,0,0,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.06) 1px, transparent 1px)',
              backgroundSize: `${GRID}px ${GRID}px`,
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--ink-200)',
              overflow: 'hidden',
            }}
          >
            {/* Wall labels */}
            <div style={{ ...wallLabelStyle, top: 10, right: 16 }}>주방</div>
            <div style={{ ...wallLabelStyle, top: 10, left: 16 }}>화장실</div>
            <div style={{ ...wallLabelStyle, bottom: 10, left: '50%', transform: 'translateX(-50%)' }}>입구</div>

            {/* Table blocks */}
            {tables.map((t) => {
              const dim = tableDims(t.shape);
              const isSelected = t.id === selectedId;
              const stat = tableStats[t.id];
              const isOccupied = t.status === 'occupied' || t.status === 'payment_pending';
              let bg = 'var(--white)';
              let color = 'var(--ink-900)';
              let border = '2px dashed var(--ink-300)';
              let dotColor = 'var(--ink-300)';
              if (t.status === 'occupied') {
                bg = 'var(--ink-900)';
                color = '#fff';
                border = '2px solid var(--ink-900)';
                dotColor = 'var(--neon)';
              } else if (t.status === 'payment_pending') {
                bg = 'var(--amber)';
                color = '#fff';
                border = '2px solid var(--amber)';
                dotColor = '#fff';
              }
              if (isSelected) {
                border = '3px solid var(--neon)';
              }
              return (
                <div
                  key={t.id}
                  onPointerDown={(e) => onPointerDown(e, t)}
                  style={{
                    position: 'absolute',
                    left: t.position_x,
                    top: t.position_y,
                    width: dim.w,
                    height: dim.h,
                    background: bg,
                    color,
                    border,
                    borderRadius: 'var(--r-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '0 10px',
                    cursor: 'grab',
                    userSelect: 'none',
                    touchAction: 'none',
                    boxShadow: isSelected ? '0 0 0 2px var(--neon), var(--shadow-2)' : 'var(--shadow-1)',
                    transition: 'box-shadow .15s ease',
                    zIndex: isSelected ? 10 : 1,
                    gap: 2,
                  }}
                >
                  {/* Top line: number + status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{t.number}번</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: 10, fontWeight: 500, opacity: 0.85,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                      {t.status === 'empty' ? '비어있음' : t.status === 'occupied' ? '사용중' : '입금대기'}
                    </span>
                  </div>
                  {/* Bottom line: elapsed + total */}
                  <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.7, display: 'flex', justifyContent: 'space-between' }}>
                    {isOccupied && stat ? (
                      <>
                        <span>{formatElapsed(stat.earliest)}</span>
                        {stat.total > 0 && <span className="numeric">{stat.total.toLocaleString()}원</span>}
                      </>
                    ) : (
                      <span>{t.shape === 'square-2' ? '2인석' : '4인석'}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend chips */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, paddingBottom: 20 }}>
            <div style={legendChipStyle}>
              <span style={{ width: 14, height: 14, border: '2px dashed var(--ink-300)', borderRadius: 4, background: 'var(--white)' }} />
              <span>빈 테이블</span>
            </div>
            <div style={legendChipStyle}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--ink-900)' }} />
              <span>이용 중</span>
            </div>
            <div style={legendChipStyle}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--amber)' }} />
              <span>주문 중</span>
            </div>
          </div>
        </div>

        {/* ── Detail Panel (right) ─────────────────────── */}
        <div
          style={{
            background: 'var(--white)',
            borderLeft: '1px solid var(--border)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          {selectedTable && (
            <div style={{ width: DETAIL_W, overflowY: 'auto', height: '100%' }}>
              {/* Header */}
              <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>테이블 {selectedTable.number}</h2>
                <button
                  onClick={() => setSelectedId(null)}
                  style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: 18, color: 'var(--ink-400)', fontFamily: 'var(--f-sans)' }}
                >
                  &times;
                </button>
              </div>

              {/* Info row */}
              <div style={{ padding: '12px 20px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={`badge ${statusBadge(selectedTable.status)}`}>{statusLabel(selectedTable.status)}</span>
                <span className="badge badge-neutral">{selectedTable.shape === 'square-2' ? '2인석' : '4인석'}</span>
              </div>

              {/* Status toggle */}
              <div style={{ padding: '0 20px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-600)', marginBottom: 10 }}>테이블 상태</div>
                <div style={{ display: 'flex', gap: 0, borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => toggleTableStatus(selectedTable.id, 'empty')}
                    style={{
                      flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 600, border: 0, cursor: 'pointer',
                      background: selectedTable.status === 'empty' ? 'var(--ink-900)' : 'var(--white)',
                      color: selectedTable.status === 'empty' ? '#fff' : 'var(--ink-500)',
                    }}
                  >
                    비어있음
                  </button>
                  <button
                    onClick={() => toggleTableStatus(selectedTable.id, 'occupied')}
                    style={{
                      flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 600, border: 0, cursor: 'pointer',
                      background: selectedTable.status === 'occupied' ? 'var(--ink-900)' : 'var(--white)',
                      color: selectedTable.status === 'occupied' ? '#fff' : 'var(--ink-500)',
                    }}
                  >
                    사용 중
                  </button>
                </div>
              </div>

              {/* QR section */}
              <div style={{ padding: '0 20px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-600)', marginBottom: 10 }}>QR 코드</div>
                <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <QRCode
                    id="qr-code-svg"
                    value={qrUrl}
                    size={140}
                    level="M"
                    bgColor="transparent"
                    fgColor="var(--ink-900)"
                  />
                  <div style={{ fontSize: 11, color: 'var(--ink-400)', wordBreak: 'break-all', textAlign: 'center' }}>{qrUrl}</div>
                  <button className="btn btn-primary btn-sm btn-block" onClick={downloadQR}>
                    QR 다운로드
                  </button>
                </div>
              </div>

              {/* Recent orders */}
              <div style={{ padding: '0 20px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-600)', marginBottom: 10 }}>최근 주문</div>
                {recentOrders.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-400)', padding: '10px 0' }}>주문 내역이 없습니다</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recentOrders.map((o) => (
                      <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', fontSize: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{o.order_number}</div>
                          <div style={{ color: 'var(--ink-400)', marginTop: 2 }}>{timeAgo(o.created_at)}</div>
                        </div>
                        <div style={{ fontWeight: 700 }} className="numeric">{o.final_amount.toLocaleString()}원</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent payments */}
              <div style={{ padding: '0 20px 24px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-600)', marginBottom: 10 }}>최근 결제</div>
                {recentPayments.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--ink-400)', padding: '10px 0' }}>결제 내역이 없습니다</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recentPayments.map((p) => {
                      const pBadge = p.status === 'confirmed' || p.status === 'completed' ? 'badge-mint' : p.status === 'waiting' ? 'badge-amber' : 'badge-neutral';
                      const pLabel = p.status === 'confirmed' || p.status === 'completed' ? '확인됨' : p.status === 'waiting' ? '대기 중' : p.status;
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', fontSize: 12 }}>
                          <div>
                            <span className={`badge ${pBadge}`} style={{ fontSize: 11, padding: '2px 8px' }}>{pLabel}</span>
                            <div style={{ color: 'var(--ink-400)', marginTop: 4 }}>{p.method === 'toss' ? '토스' : '계좌이체'}</div>
                          </div>
                          <div style={{ fontWeight: 700 }} className="numeric">{p.amount.toLocaleString()}원</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm Dialog ─────────────────────── */}
      {confirmDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(14,18,32,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn .15s ease',
          }}
          onClick={() => setConfirmDialog(null)}
        >
          <div
            style={{
              background: 'var(--white)',
              borderRadius: 'var(--r-lg)',
              padding: '28px 24px 20px',
              maxWidth: 360,
              width: '90%',
              boxShadow: 'var(--shadow-3)',
              animation: 'pop .2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>확인</div>
            <div style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.6, marginBottom: 20 }}>
              {confirmDialog.message}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDialog(null)}>취소</button>
              <button className="btn btn-danger btn-sm" onClick={confirmDialog.onConfirm}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            background: 'var(--ink-900)',
            color: '#fff',
            padding: '10px 24px',
            borderRadius: 'var(--r-pill)',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: 'var(--shadow-3)',
            animation: 'toastIn .2s ease',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Shared inline styles ─────────────────────── */
const wallLabelStyle: React.CSSProperties = {
  position: 'absolute',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--ink-400)',
  letterSpacing: '0.04em',
  pointerEvents: 'none',
  zIndex: 5,
};

const legendChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--ink-600)',
};
