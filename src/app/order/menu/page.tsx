'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Menu } from '@/lib/database.types';

type CartItem = { menu: Menu; quantity: number };

const CATEGORIES = ['전체', '안주', '주류', '음료'] as const;
type Category = (typeof CATEGORIES)[number];

/* ── helpers ──────────────────────────────── */

function formatPrice(n: number) {
  return n.toLocaleString('ko-KR') + '원';
}

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

/* ── main ─────────────────────────────────── */

function MenuContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const table = searchParams.get('table') || '1';

  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('전체');
  const [cart, setCart] = useState<CartItem[]>([]);

  /* fetch menus */
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('menus')
        .select('*')
        .order('sort_order', { ascending: true });
      if (data) setMenus(data);
      setLoading(false);
    })();
  }, []);

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

  /* popular items (top 3 by sort_order or just first 3 with tag) */
  const popular = useMemo(
    () =>
      menus
        .filter((m) => m.tag === '인기' || m.tag === '추천')
        .slice(0, 3),
    [menus],
  );

  /* cart helpers */
  const addToCart = useCallback((menu: Menu) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menu.id === menu.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { menu, quantity: 1 }];
    });
  }, []);

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const cartTotal = cart.reduce(
    (s, c) => s + c.menu.price * c.quantity,
    0,
  );

  /* navigate to confirm with cart data in sessionStorage */
  const goToConfirm = () => {
    sessionStorage.setItem('cart', JSON.stringify(cart));
    router.push(`/order/confirm?table=${table}`);
  };

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

      {/* Content area */}
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          padding: '0 20px',
          paddingBottom: cartCount > 0 ? 100 : 32,
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
                              style={{
                                height: 30,
                                padding: '0 10px',
                                fontSize: 12,
                                borderRadius: 'var(--r-sm)',
                              }}
                              onClick={() => addToCart(item)}
                            >
                              담기
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

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 40px)',
            maxWidth: 400,
            zIndex: 30,
            animation: 'pop .25s ease',
          }}
        >
          <div
            style={{
              background: 'var(--ink-900)',
              borderRadius: 'var(--r-xl)',
              boxShadow: 'var(--shadow-2)',
              padding: '12px 14px 12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                className="numeric"
                style={{
                  background: 'var(--ink-700)',
                  color: '#fff',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
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
                  fontWeight: 600,
                }}
              >
                {formatPrice(cartTotal)}
              </span>
            </div>
            <button
              onClick={goToConfirm}
              style={{
                appearance: 'none',
                border: 'none',
                background: 'var(--neon)',
                color: 'var(--neon-ink)',
                fontWeight: 700,
                fontSize: 14,
                padding: '8px 18px',
                borderRadius: 'var(--r-pill)',
                cursor: 'pointer',
                fontFamily: 'var(--f-sans)',
                letterSpacing: '-0.01em',
              }}
            >
              주문하기 →
            </button>
          </div>
        </div>
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
