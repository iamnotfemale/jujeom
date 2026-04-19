'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import PinLogin from '@/components/PinLogin';
import { supabase } from '@/lib/supabase';

interface NavItem {
  icon: string;
  label: string;
  href: string;
  count?: number | null;
  external?: boolean;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [menuCount, setMenuCount] = useState<number | null>(null);
  const [paymentPendingCount, setPaymentPendingCount] = useState<number | null>(null);
  const [storeName, setStoreName] = useState<string>('주점');

  useEffect(() => {
    setAuthed(sessionStorage.getItem('admin_auth') === 'true');
    setAuthChecked(true);
  }, []);

  /* Fetch dynamic counts */
  useEffect(() => {
    const fetchCounts = async () => {
      const [menuRes, paymentRes] = await Promise.all([
        supabase.from('menus').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'waiting'),
      ]);
      setMenuCount(menuRes.count ?? null);
      setPaymentPendingCount(paymentRes.count ?? null);
    };
    fetchCounts();

    /* Realtime subscription on payments to keep pending count fresh */
    const channel = supabase
      .channel('admin-payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'waiting')
          .then(({ count }) => setPaymentPendingCount(count ?? null));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  /* Fetch store name */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('store_settings').select('store_name').limit(1).single();
      if (data?.store_name) setStoreName(data.store_name);
    })();
  }, []);

  const navSections: { label: string; items: NavItem[] }[] = useMemo(() => [
    {
      label: '운영',
      items: [
        { icon: '◆', label: '대시보드', href: '/admin/dashboard' },
        { icon: '▦', label: '테이블 관리', href: '/admin/tables' },
        { icon: '☰', label: '메뉴 관리', href: '/admin/menu', count: menuCount },
        { icon: '₩', label: '결제 내역', href: '/admin/payments', count: paymentPendingCount },
      ],
    },
    {
      label: '참고',
      items: [
        { icon: '▤', label: '주방 KDS', href: '/kitchen', external: true },
        { icon: '☐', label: '손님 화면', href: '/order', external: true },
        { icon: '⚙', label: '설정', href: '/admin/settings' },
      ],
    },
  ], [menuCount, paymentPendingCount]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px), (orientation: portrait)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setCollapsed(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth');
    setAuthed(false);
  };

  if (!authChecked) return null;
  if (!authed) return <PinLogin onSuccess={() => setAuthed(true)} />;

  return (
    <div style={styles.frame}>
      <div style={{ ...styles.grid, gridTemplateColumns: collapsed ? '72px 1fr' : '220px 1fr' }}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          {/* Brand */}
          <div style={styles.brand}>
            <div style={styles.logo}>{storeName.charAt(0)}</div>
            {!collapsed && (
              <div>
                <div style={styles.brandName}>{storeName}</div>
                <div style={styles.brandSub}>관리자 콘솔</div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav style={styles.nav}>
            {navSections.map((section) => (
              <div key={section.label} style={styles.navSection}>
                {!collapsed && <div style={styles.navSectionLabel}>{section.label}</div>}
                {section.items.map((item) => {
                  const isActive = !item.external && (pathname === item.href || pathname?.startsWith(item.href + '/'));
                  const linkStyle = {
                    ...styles.navItem,
                    ...(isActive ? styles.navItemActive : {}),
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '10px 0' : '10px 14px',
                  };
                  const linkContent = (
                    <>
                      <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                      {!collapsed && (
                        <>
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {item.count != null && (
                            <span style={styles.navCount}>{item.count}</span>
                          )}
                        </>
                      )}
                    </>
                  );

                  if (item.external) {
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={linkStyle}
                      >
                        {linkContent}
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={linkStyle}
                    >
                      {linkContent}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div style={styles.sidebarFooter}>
            <div style={styles.avatar}>김</div>
            {!collapsed && (
              <div style={{ flex: 1 }}>
                <div style={styles.footerName}>김학생회장</div>
                <div style={styles.footerRole}>운영 총괄</div>
              </div>
            )}
            <button onClick={handleLogout} style={styles.logoutBtn} title="로그아웃">
              {collapsed ? '↩' : '로그아웃'}
            </button>
          </div>
        </aside>

        {/* Main */}
        <main style={styles.main}>
          {children}
        </main>
      </div>
    </div>
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
