'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Menu } from '@/lib/database.types';
import { useStore } from '../../StoreProvider';
import { formatPrice } from '@/lib/formatters';
import { cartStorageKey } from '@/lib/types/cart';

/** Menu-page-local shape: holds the full Menu object for display purposes */
type MenuCartItem = { menu: Menu; quantity: number; options?: string | null };

const CATEGORIES = ['전체', '안주', '주류', '음료'] as const;
type Category = (typeof CATEGORIES)[number];

/* ── helpers ──────────────────────────────── */

function thumbColors(category: string) {
  switch (category) {
    case '안주':
      return { a: 'var(--coral)', b: 'rgba(255,90,68,0.15)' };
    case '주류':
      return { a: 'var(--neon)', b: 'rgba(255,226,75,0.18)' };
    case '음료':
      return { a: 'var(--mint)', b: 'rgba(46,203,139,0.15)' };
    default:
      return { a: 'var(--ink-200)', b: 'var(--ink-100)' };
  }
}

function parseOptions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function cartKey(item: MenuCartItem) {
  return `${item.menu.id}:${item.options ?? ''}`;
}

/* ── main ─────────────────────────────────── */

function MenuContent() {
  const store = useStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const table = searchParams.get('table') || '1';

  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('전체');
  const [cart, setCart] = useState<MenuCartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);

  /* option modal state */
  const [optionModalMenu, setOptionModalMenu] = useState<Menu | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');

  /* bottom sheet state */
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragDelta = useRef<number>(0);

  /* fetch menus */
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('menus')
        .select('*')
        .eq('store_id', store.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (data) setMenus(data);
      setLoading(false);
    })();
  }, [store.id]);

  /* hydrate cart from localStorage on mount */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(cartStorageKey(store.slug, table));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {
      /* ignore */
    }
    setCartHydrated(true);
  }, [table]);

  /* persist cart to localStorage when changed (after hydration) */
  useEffect(() => {
    if (!cartHydrated) return;
    try {
      if (cart.length === 0) {
        localStorage.removeItem(cartStorageKey(store.slug, table));
      } else {
        localStorage.setItem(cartStorageKey(store.slug, table), JSON.stringify(cart));
      }
    } catch {
      /* ignore */
    }
  }, [cart, cartHydrated, table]);

  /* category counts */
  const counts = useMemo(() => {
    const m: Record<string, number> = { 전체: menus.length };
    for (const item of menus) {
      m[item.category] = (m[item.category] || 0) + 1;
    }
    return m;
  }, [menus]);

  /* filtered menus */
  const filtered = useMemo(
    () =>
      activeCategory === '전체'
        ? menus
        : menus.filter((m) => m.category === activeCategory),
    [menus, activeCategory],
  );

  /* popular items */
  const popular = useMemo(
    () =>
      menus
        .filter((m) => m.tag === '인기' || m.tag === '추천')
        .slice(0, 3),
    [menus],
  );

  /* cart helpers */
  const addCartItem = useCallback((menu: Menu, options?: string | null) => {
    setCart((prev) => {
      const key = `${menu.id}:${options ?? ''}`;
      const idx = prev.findIndex((c) => `${c.menu.id}:${c.options ?? ''}` === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { menu, quantity: 1, options: options ?? null }];
    });
  }, []);

  const handleMenuClick = useCallback(
    (menu: Menu) => {
      const opts = parseOptions(menu.options);
      if (opts.length > 0) {
        setSelectedOption(opts[0]);
        setOptionModalMenu(menu);
      } else {
        addCartItem(menu, null);
      }
    },
    [addCartItem],
  );

  const confirmOptionAdd = useCallback(() => {
    if (!optionModalMenu) return;
    addCartItem(optionModalMenu, selectedOption || null);
    setOptionModalMenu(null);
    setSelectedOption('');
  }, [addCartItem, optionModalMenu, selectedOption]);

  const updateQty = useCallback((key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          cartKey(c) === key ? { ...c, quantity: c.quantity + delta } : c,
        )
        .filter((c) => c.quantity > 0),
    );
  }, []);

  const removeCartItem = useCallback((key: string) => {
    setCart((prev) => prev.filter((c) => cartKey(c) !== key));
  }, []);

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartTotal = cart.reduce(
    (s, c) => s + c.menu.price * c.quantity,
    0,
  );

  /* navigate to confirm (cart is already in localStorage) */
  const goToConfirm = () => {
    router.push(`/s/${store.slug}/order/confirm?table=${table}`);
  };

  /* drag handlers for bottom sheet */
  const onHandleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragDelta.current = 0;
  };
  const onHandleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current == null) return;
    dragDelta.current = e.touches[0].clientY - dragStartY.current;
  };
  const onHandleTouchEnd = () => {
    if (dragStartY.current == null) return;
    const d = dragDelta.current;
    if (d < -40) setSheetExpanded(true);
    else if (d > 40) setSheetExpanded(false);
    dragStartY.current = null;
    dragDelta.current = 0;
  };

  const isPaused = store.is_paused === true;
  const isClosed = store.is_open === false;
  const showSheet = cartCount > 0 && !isPaused && !isClosed;

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Sticky header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          width: '100%',
          maxWidth: 440,
          background: 'rgba(251,251,247,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--ink-100)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 20px 10px',
          }}
        >
          <Link
            href={`/order?table=${table}`}
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              color: 'var(--ink-700)',
              fontSize: 18,
              flexShrink: 0,
            }}
            aria-label="뒤로"
          >
            ←
          </Link>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: 'var(--ink-900)',
              }}
            >
              메뉴
            </div>
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink-400)',
              background: 'var(--ink-050)',
              padding: '4px 10px',
              borderRadius: 'var(--r-pill)',
            }}
          >
            {table}번 테이블
          </div>
        </div>

        {/* Category tabs */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '0 20px 12px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {CATEGORIES.map((cat) => {
            const active = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  flexShrink: 0,
                  appearance: 'none',
                  border: active ? 'none' : '1px solid var(--border)',
                  borderRadius: 'var(--r-pill)',
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: active ? 'var(--ink-900)' : 'var(--white)',
                  color: active ? '#fff' : 'var(--ink-600)',
                  fontFamily: 'var(--f-sans)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'background .15s, color .15s',
                }}
              >
                {cat}
                <span
                  style={{
                    fontSize: 11,
                    opacity: 0.7,
                    fontWeight: 500,
                  }}
                >
                  {counts[cat] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Paused / closed banner */}
      {(isPaused || isClosed) && (
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            background: isClosed ? '#FFF0F0' : '#FFFBE6',
            border: `1px solid ${isClosed ? '#FFCDD2' : '#FFE066'}`,
            borderRadius: 'var(--r-md)',
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 600,
            color: isClosed ? '#9B1C1C' : '#7A5C00',
            textAlign: 'center',
            margin: '12px 20px 0',
            boxSizing: 'border-box',
          }}
        >
          {isClosed ? '현재 영업이 종료되었습니다' : '현재 주문이 일시 중지되었습니다'}
        </div>
      )}

      {/* Content area */}
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          padding: '0 20px',
          paddingBottom: showSheet ? 120 : 32,
          flex: 1,
        }}
      >
        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 0',
              color: 'var(--ink-400)',
              fontSize: 14,
            }}
          >
            메뉴를 불러오는 중...
          </div>
        ) : (
          <>
            {/* Popular section */}
            {activeCategory === '전체' && popular.length > 0 && (
              <section style={{ marginTop: 20, marginBottom: 28 }}>
                <h2
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--ink-900)',
                    letterSpacing: '-0.01em',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  🔥 오늘의 인기
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {popular.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        background: 'var(--white)',
                        borderRadius: 'var(--r-md)',
                        border: '1px solid var(--ink-100)',
                      }}
                    >
                      <span
                        className="numeric"
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color:
                            idx === 0
                              ? 'var(--coral)'
                              : idx === 1
                                ? 'var(--amber)'
                                : 'var(--ink-400)',
                          width: 20,
                          textAlign: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--ink-900)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.name}
                        </div>
                        <div
                          className="numeric"
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--ink-500)',
                            marginTop: 2,
                          }}
                        >
                          {formatPrice(item.price)}
                        </div>
                      </div>
                      {item.tag && (
                        <span
                          className="badge badge-neon"
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                          }}
                        >
                          {item.tag}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Menu grid */}
            <section style={{ marginTop: activeCategory !== '전체' || popular.length === 0 ? 20 : 0 }}>
              {activeCategory !== '전체' && (
                <h2
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--ink-900)',
                    letterSpacing: '-0.01em',
                    marginBottom: 12,
                  }}
                >
                  {activeCategory}
                </h2>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
              >
                {filtered.map((item) => {
                  const soldOut = item.is_sold_out;
                  const colors = thumbColors(item.category);
                  const hasOptions = parseOptions(item.options).length > 0;
                  return (
                    <div
                      key={item.id}
                      style={{
                        borderRadius: 'var(--r-lg)',
                        background: 'var(--white)',
                        border: '1px solid var(--ink-100)',
                        overflow: 'hidden',
                        position: 'relative',
                        opacity: soldOut ? 0.55 : 1,
                        transition: 'opacity .2s',
                      }}
                    >
                      {/* Thumbnail placeholder */}
                      <div
                        style={{
                          height: 100,
                          background: item.image_url
                            ? `url(${item.image_url}) center/cover`
                            : `repeating-linear-gradient(45deg, ${colors.b} 0 8px, ${colors.a}22 8px 16px)`,
                          position: 'relative',
                        }}
                      >
                        {/* Tag badges */}
                        {item.tag && !soldOut && (
                          <span
                            className={`badge ${item.tag === '매움' ? 'badge-coral' : 'badge-neon'}`}
                            style={{
                              position: 'absolute',
                              top: 8,
                              left: 8,
                              fontSize: 11,
                              padding: '2px 8px',
                            }}
                          >
                            {item.tag}
                          </span>
                        )}
                        {/* Sold-out overlay */}
                        {soldOut && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(14,18,32,0.45)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontWeight: 800,
                              fontSize: 16,
                              letterSpacing: '0.05em',
                            }}
                          >
                            품절
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: '10px 12px 12px' }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--ink-900)',
                            marginBottom: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.name}
                        </div>
                        {item.description && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--ink-400)',
                              marginBottom: 8,
                              lineHeight: 1.4,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {item.description}
                          </div>
                        )}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 4,
                          }}
                        >
                          <span
                            className="numeric"
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: 'var(--ink-900)',
                            }}
                          >
                            {formatPrice(item.price)}
                          </span>
                          {!soldOut && (
                            <button
                              className="btn btn-sm btn-primary"
                              disabled={isPaused || isClosed}
                              style={{
                                height: 30,
                                padding: '0 10px',
                                fontSize: 12,
                                borderRadius: 'var(--r-sm)',
                                opacity: isPaused || isClosed ? 0.4 : 1,
                                cursor: isPaused || isClosed ? 'not-allowed' : 'pointer',
                              }}
                              onClick={() => !(isPaused || isClosed) && handleMenuClick(item)}
                            >
                              {hasOptions ? '옵션 선택' : '담기'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filtered.length === 0 && !loading && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px 0',
                    color: 'var(--ink-400)',
                    fontSize: 14,
                  }}
                >
                  해당 카테고리에 메뉴가 없습니다.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── Option selection modal ───────────── */}
      {optionModalMenu && (
        <div
          onClick={() => setOptionModalMenu(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(14,18,32,0.55)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            animation: 'fadeIn .2s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              background: 'var(--paper)',
              borderTopLeftRadius: 'var(--r-xl)',
              borderTopRightRadius: 'var(--r-xl)',
              padding: '18px 20px 24px',
              boxShadow: 'var(--shadow-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            {/* handle */}
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: 'var(--ink-200)',
                margin: '0 auto 6px',
              }}
            />
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--ink-900)',
                  letterSpacing: '-0.02em',
                }}
              >
                {optionModalMenu.name}
              </div>
              {optionModalMenu.description && (
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--ink-500)',
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  {optionModalMenu.description}
                </div>
              )}
              <div
                className="numeric"
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--ink-900)',
                  marginTop: 8,
                }}
              >
                {formatPrice(optionModalMenu.price)}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--ink-100)' }} />

            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--ink-700)',
                  marginBottom: 10,
                  letterSpacing: '-0.01em',
                }}
              >
                옵션 선택 <span style={{ color: 'var(--coral)' }}>*</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {parseOptions(optionModalMenu.options).map((opt) => {
                  const active = opt === selectedOption;
                  return (
                    <label
                      key={opt}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 'var(--r-md)',
                        border: active
                          ? '1.5px solid var(--ink-900)'
                          : '1px solid var(--ink-100)',
                        background: active ? 'var(--ink-050)' : 'var(--white)',
                        cursor: 'pointer',
                        transition: 'all .15s',
                      }}
                    >
                      <input
                        type="radio"
                        name="menu-option"
                        value={opt}
                        checked={active}
                        onChange={() => setSelectedOption(opt)}
                        style={{
                          width: 18,
                          height: 18,
                          accentColor: 'var(--ink-900)',
                          cursor: 'pointer',
                        }}
                      />
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: active ? 700 : 500,
                          color: 'var(--ink-900)',
                        }}
                      >
                        {opt}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                onClick={() => setOptionModalMenu(null)}
                style={{
                  flex: 1,
                  appearance: 'none',
                  border: '1px solid var(--border)',
                  background: 'var(--white)',
                  color: 'var(--ink-700)',
                  fontWeight: 600,
                  fontSize: 14,
                  padding: '12px 14px',
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                  fontFamily: 'var(--f-sans)',
                }}
              >
                취소
              </button>
              <button
                onClick={confirmOptionAdd}
                disabled={!selectedOption}
                style={{
                  flex: 2,
                  appearance: 'none',
                  border: 'none',
                  background: 'var(--neon)',
                  color: 'var(--neon-ink)',
                  fontWeight: 700,
                  fontSize: 14,
                  padding: '12px 14px',
                  borderRadius: 'var(--r-md)',
                  cursor: selectedOption ? 'pointer' : 'not-allowed',
                  opacity: selectedOption ? 1 : 0.5,
                  fontFamily: 'var(--f-sans)',
                  letterSpacing: '-0.01em',
                }}
              >
                장바구니 담기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cart bottom sheet ────────────────── */}
      {showSheet && (
        <>
          {/* backdrop when expanded */}
          {sheetExpanded && (
            <div
              onClick={() => setSheetExpanded(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 40,
                background: 'rgba(14,18,32,0.35)',
                animation: 'fadeIn .2s ease',
              }}
            />
          )}

          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 440,
                background: 'var(--ink-900)',
                borderTopLeftRadius: 'var(--r-xl)',
                borderTopRightRadius: 'var(--r-xl)',
                boxShadow: 'var(--shadow-2)',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: sheetExpanded ? '75vh' : 'auto',
                transition: 'max-height .25s ease',
                overflow: 'hidden',
              }}
            >
              {/* handle / toggle */}
              <div
                onClick={() => setSheetExpanded((v) => !v)}
                onTouchStart={onHandleTouchStart}
                onTouchMove={onHandleTouchMove}
                onTouchEnd={onHandleTouchEnd}
                style={{
                  padding: '10px 0 6px',
                  display: 'flex',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  touchAction: 'none',
                }}
              >
                <span
                  style={{
                    width: 44,
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--ink-600)',
                  }}
                />
              </div>

              {/* expanded list */}
              {sheetExpanded && (
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '4px 16px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 0 8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#fff',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      장바구니
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--ink-400)',
                      }}
                    >
                      {cart.length}개 메뉴 · {cartCount}개 상품
                    </span>
                  </div>

                  {cart.map((c) => {
                    const k = cartKey(c);
                    const colors = thumbColors(c.menu.category);
                    return (
                      <div
                        key={k}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: 10,
                          background: 'var(--ink-700)',
                          borderRadius: 'var(--r-md)',
                        }}
                      >
                        {/* thumbnail */}
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 'var(--r-sm)',
                            flexShrink: 0,
                            background: c.menu.image_url
                              ? `url(${c.menu.image_url}) center/cover`
                              : `repeating-linear-gradient(45deg, ${colors.b} 0 6px, ${colors.a}44 6px 12px)`,
                          }}
                        />
                        {/* info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#fff',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {c.menu.name}
                          </div>
                          {c.options && (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--ink-400)',
                                marginTop: 1,
                              }}
                            >
                              {c.options}
                            </div>
                          )}
                          <div
                            className="numeric"
                            style={{
                              fontSize: 12,
                              color: 'var(--neon)',
                              fontWeight: 700,
                              marginTop: 2,
                            }}
                          >
                            {formatPrice(c.menu.price * c.quantity)}
                          </div>
                        </div>
                        {/* qty */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexShrink: 0,
                          }}
                        >
                          <button
                            onClick={() => updateQty(k, -1)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 'var(--r-sm)',
                              border: '1px solid var(--ink-600)',
                              background: 'var(--ink-900)',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: 14,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            −
                          </button>
                          <span
                            className="numeric"
                            style={{
                              width: 20,
                              textAlign: 'center',
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {c.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(k, 1)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 'var(--r-sm)',
                              border: '1px solid var(--ink-600)',
                              background: 'var(--ink-900)',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: 14,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeCartItem(k)}
                            aria-label="삭제"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 'var(--r-sm)',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--coral)',
                              cursor: 'pointer',
                              fontSize: 14,
                              marginLeft: 2,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* sticky CTA */}
              <div
                style={{
                  padding: '10px 14px 14px',
                  paddingBottom:
                    'max(14px, env(safe-area-inset-bottom))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderTop: sheetExpanded
                    ? '1px solid var(--ink-700)'
                    : 'none',
                  background: 'var(--ink-900)',
                }}
              >
                <div
                  onClick={() => setSheetExpanded((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    className="numeric"
                    style={{
                      background: 'var(--ink-700)',
                      color: '#fff',
                      minWidth: 28,
                      height: 28,
                      padding: '0 8px',
                      borderRadius: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {cartCount}
                  </span>
                  <span
                    className="numeric"
                    style={{
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    {formatPrice(cartTotal)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--ink-400)',
                      marginLeft: 4,
                    }}
                  >
                    {sheetExpanded ? '접기 ▼' : '펼쳐보기 ▲'}
                  </span>
                </div>
                <button
                  onClick={goToConfirm}
                  disabled={isPaused || isClosed}
                  style={{
                    appearance: 'none',
                    border: 'none',
                    background: 'var(--neon)',
                    color: 'var(--neon-ink)',
                    fontWeight: 700,
                    fontSize: 14,
                    padding: '10px 18px',
                    borderRadius: 'var(--r-pill)',
                    cursor: isPaused || isClosed ? 'not-allowed' : 'pointer',
                    opacity: isPaused || isClosed ? 0.4 : 1,
                    fontFamily: 'var(--f-sans)',
                    letterSpacing: '-0.01em',
                    flexShrink: 0,
                  }}
                >
                  주문하기 →
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--paper)',
          }}
        >
          <div style={{ color: 'var(--ink-400)', fontSize: 14 }}>메뉴를 불러오는 중...</div>
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
