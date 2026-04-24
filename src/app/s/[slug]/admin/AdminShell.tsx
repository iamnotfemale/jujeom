'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '../StoreProvider';
import type { StoreRole } from '@/lib/types/store';

/** @deprecated Use StoreRole from \@/lib/types/store instead */
export type AdminRole = StoreRole;

const AdminRoleContext = createContext<StoreRole>('kitchen');
export function useAdminRole(): StoreRole {
  return useContext(AdminRoleContext);
}

export function useAdminStoreName(): string {
  return useStore().name;
}

interface NavItem {
  icon: string;
  label: string;
  href: string;
  count?: number | null;
  external?: boolean;
}

const ROLE_LABEL: Record<StoreRole, string> = {
  owner: '소유자',
  manager: '매니저',
  kitchen: '주방',
};

export default function AdminShell({
  children,
  userEmail,
  role,
}: {
  children: React.ReactNode;
  userEmail: string;
  role: StoreRole;
}) {
  const store = useStore();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [staffCall, setStaffCall] = useState<{ table: string; time: string } | null>(null);
  const [menuCount, setMenuCount] = useState<number | null>(null);
  const [paymentPendingCount, setPaymentPendingCount] = useState<number | null>(null);
  const storeName = store.name;

  const avatarChar = (userEmail || '?').charAt(0).toUpperCase();
  const emailLocal = userEmail.split('@')[0] || userEmail;

  /* Fetch dynamic counts (이 가게 한정) */
  useEffect(() => {
    const fetchCounts = async () => {
      const [menuRes, paymentRes] = await Promise.all([
        supabase.from('menus').select('*', { count: 'exact', head: true }).eq('store_id', store.id),
        supabase.from('payments').select('*', { count: 'exact', head: true })
          .eq('store_id', store.id).eq('status', 'waiting'),
      ]);
      setMenuCount(menuRes.count ?? null);
      setPaymentPendingCount(paymentRes.count ?? null);
    };
    fetchCounts();

    const channel = supabase
      .channel(`admin-payments:${store.slug}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `store_id=eq.${store.id}` },
        () => {
          supabase.from('payments').select('*', { count: 'exact', head: true })
            .eq('store_id', store.id).eq('status', 'waiting')
            .then(({ count }) => setPaymentPendingCount(count ?? null));
        })
      .subscribe();

    const staffChannel = supabase
      .channel(`staff-calls:${store.slug}`)
      .on('broadcast', { event: 'call' }, (payload: { payload: { table: string; time: string } }) => {
        setStaffCall({ table: payload.payload.table, time: payload.payload.time });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(staffChannel);
    };
  }, [store.id, store.slug]);

  const navSections: { label: string; items: NavItem[] }[] = useMemo(() => [
    {
      label: '운영',
      items: [
        { icon: '◆', label: '대시보드', href: `/s/${store.slug}/admin/dashboard` },
        { icon: '▦', label: '테이블 관리', href: `/s/${store.slug}/admin/tables` },
        { icon: '☰', label: '메뉴 관리', href: `/s/${store.slug}/admin/menu`, count: menuCount },
        { icon: '₩', label: '결제 내역', href: `/s/${store.slug}/admin/payments`, count: paymentPendingCount },
        ...(['owner', 'manager'].includes(role)
          ? [{ icon: '✦', label: '팀 관리', href: `/s/${store.slug}/admin/members` }]
          : []),
      ],
    },
    {
      label: '참고',
      items: [
        { icon: '▤', label: '주방', href: `/s/${store.slug}/kitchen`, external: true },
        { icon: '☐', label: '손님 화면', href: `/s/${store.slug}/order`, external: true },
        ...(role !== 'kitchen' ? [{ icon: '⚙', label: '설정', href: `/s/${store.slug}/admin/settings` }] : []),
        { icon: '⌂', label: '내 가게 목록', href: '/dashboard' },
      ],
    },
  ], [menuCount, paymentPendingCount, role, store.slug]);

  useEffect(() => {
    const mqMobile = window.matchMedia('(max-width: 767px)');
    const mqTablet = window.matchMedia('(max-width: 1023px)');
    const handleMobile = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      if (e.matches) setMobileOpen(false);
    };
    const handleTablet = (e: MediaQueryListEvent | MediaQueryList) => setCollapsed(e.matches);
    handleMobile(mqMobile);
    handleTablet(mqTablet);
    mqMobile.addEventListener('change', handleMobile);
    mqTablet.addEventListener('change', handleTablet);
    return () => {
      mqMobile.removeEventListener('change', handleMobile);
      mqTablet.removeEventListener('change', handleTablet);
    };
  }, []);

  const handleLogout = () => {
    window.location.href = '/auth/logout';
  };

  const showLabel = isMobile ? true : !collapsed;

  const sidebarInner = (
    <aside style={{ ...styles.sidebar, ...(isMobile ? { width: 260, height: '100%' } : {}) }}>
      <div style={styles.brand}>
        <div style={styles.logo}>{storeName.charAt(0)}</div>
        {showLabel && (
          <div>
            <div style={styles.brandName}>{storeName}</div>
            <div style={styles.brandSub}>관리자 콘솔</div>
          </div>
        )}
      </div>
      <nav style={styles.nav}>
        {navSections.map((section) => (
          <div key={section.label} style={styles.navSection}>
            {showLabel && <div style={styles.navSectionLabel}>{section.label}</div>}
            {section.items.map((item) => {
              const isActive = !item.external && (pathname === item.href || pathname?.startsWith(item.href + '/'));
              const linkStyle = {
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                justifyContent: showLabel ? 'flex-start' : 'center',
                padding: showLabel ? '10px 14px' : '10px 0',
              };
              const linkContent = (
                <>
                  <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                  {showLabel && (
                    <>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.count != null && <span style={styles.navCount}>{item.count}</span>}
                    </>
                  )}
                </>
              );
              if (item.external) {
                return (
                  <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" style={linkStyle}
                    onClick={() => isMobile && setMobileOpen(false)}>
                    {linkContent}
                  </a>
                );
              }
              return (
                <Link key={item.href} href={item.href} style={linkStyle}
                  onClick={() => isMobile && setMobileOpen(false)}>
                  {linkContent}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div style={styles.sidebarFooter}>
        <div style={styles.avatar} title={userEmail}>{avatarChar}</div>
        {showLabel && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.footerName} title={userEmail}>{emailLocal}</div>
            <div style={styles.footerRole}>{ROLE_LABEL[role]}</div>
          </div>
        )}
        <button onClick={handleLogout} style={styles.logoutBtn} title="로그아웃">
          {showLabel ? '로그아웃' : '↩'}
        </button>
      </div>
    </aside>
  );

  const staffCallModal = staffCall && (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(14,18,32,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, animation: 'fadeIn .15s ease' }}
      onClick={() => setStaffCall(null)}
    >
      <div
        style={{ background: '#fff', borderRadius: 'var(--r-lg)', padding: '32px 36px', maxWidth: 400, width: '90%', boxShadow: 'var(--shadow-3)', textAlign: 'center', border: '2px solid var(--coral)', animation: 'pop .2s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'color-mix(in oklab, var(--coral) 12%, white)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>🔔</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: 'var(--ink-900)' }}>직원 호출</div>
        <div style={{ fontSize: 15, color: 'var(--ink-600)', marginBottom: 24, lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--coral)' }}>{staffCall.table}번 테이블</strong>에서<br />직원을 호출했습니다!
        </div>
        <button onClick={() => setStaffCall(null)} style={{ padding: '10px 32px', borderRadius: 'var(--r-md)', border: 0, background: 'var(--ink-900)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--f-sans)' }}>확인</button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <AdminRoleContext.Provider value={role}>
        <div style={{ minHeight: '100vh', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column' }}>
          {/* Mobile top bar */}
          <header style={{ position: 'sticky', top: 0, zIndex: 200, height: 52, background: 'var(--ink-900)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', flexShrink: 0 }}>
            <button
              onClick={() => setMobileOpen(true)}
              style={{ width: 36, height: 36, border: 0, background: 'transparent', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              ☰
            </button>
            <div style={styles.logo}>{storeName.charAt(0)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...styles.brandName, fontSize: 14 }}>{storeName}</div>
            </div>
            {paymentPendingCount != null && paymentPendingCount > 0 && (
              <span style={{ background: 'var(--crim)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{paymentPendingCount}</span>
            )}
          </header>

          {/* Drawer overlay */}
          {mobileOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,18,32,.45)' }} onClick={() => setMobileOpen(false)} />
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
                {sidebarInner}
              </div>
            </div>
          )}

          <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
        </div>
        {staffCallModal}
      </AdminRoleContext.Provider>
    );
  }

  return (
    <AdminRoleContext.Provider value={role}>
    <div style={styles.frame}>
      <div style={{ ...styles.grid, gridTemplateColumns: collapsed ? '72px 1fr' : '220px 1fr' }}>
        {sidebarInner}
        <main style={styles.main}>{children}</main>
      </div>
      {staffCallModal}
    </div>
    </AdminRoleContext.Provider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  frame: {
    minHeight: '100vh',
    background: '#E9E7DE',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  grid: {
    display: 'grid',
    width: '100%',
    maxWidth: 1280,
    minHeight: '100vh',
    background: 'var(--paper)',
    boxShadow: 'var(--shadow-3)',
  },
  sidebar: {
    background: 'var(--ink-900)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'sticky',
    top: 0,
    overflow: 'hidden',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '24px 18px 20px',
    borderBottom: '1px solid rgba(255,255,255,.08)',
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 'var(--r-sm)',
    background: 'var(--neon)',
    color: 'var(--ink-900)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 18,
    flexShrink: 0,
  },
  brandName: {
    fontWeight: 700,
    fontSize: 15,
    lineHeight: 1.3,
  },
  brandSub: {
    fontSize: 11,
    opacity: 0.5,
    lineHeight: 1.3,
  },
  nav: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  navSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navSectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    opacity: 0.35,
    padding: '12px 14px 6px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 'var(--r-sm)',
    fontSize: 13,
    fontWeight: 500,
    color: 'rgba(255,255,255,.65)',
    textDecoration: 'none',
    transition: 'background .12s ease, color .12s ease',
    cursor: 'pointer',
  },
  navItemActive: {
    background: 'var(--neon)',
    color: 'var(--ink-900)',
    fontWeight: 700,
  },
  navCount: {
    fontSize: 11,
    fontWeight: 700,
    background: 'rgba(255,255,255,.15)',
    padding: '2px 8px',
    borderRadius: 'var(--r-pill)',
    lineHeight: 1.4,
  },
  sidebarFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '16px 18px',
    borderTop: '1px solid rgba(255,255,255,.08)',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'var(--ink-600)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
  },
  footerName: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  footerRole: {
    fontSize: 11,
    opacity: 0.45,
    lineHeight: 1.3,
  },
  logoutBtn: {
    padding: '4px 10px',
    borderRadius: 'var(--r-sm)',
    border: '1px solid rgba(255,255,255,.12)',
    background: 'transparent',
    color: 'rgba(255,255,255,.5)',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    transition: 'all .12s ease',
    flexShrink: 0,
  },
  main: {
    height: '100vh',
    overflowY: 'auto',
    background: 'var(--surface-2)',
  },
};
