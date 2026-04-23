'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface StoreCard {
  role: 'owner' | 'manager' | 'kitchen';
  store: {
    id: string;
    slug: string;
    name: string;
    is_open: boolean;
    serving_mode: 'pickup' | 'table';
    created_at: string;
  };
}

const MAX_STORES = 5;

export default function DashboardClient({ userEmail }: { userEmail: string }) {
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stores');
      const json = (await res.json()) as { stores?: StoreCard[]; error?: string };
      if (res.ok) setStores(json.stores ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, slug: newSlug || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(mapError(json.error as string));
        return;
      }
      setShowCreate(false);
      setNewName('');
      setNewSlug('');
      await fetchStores();
    } finally {
      setCreating(false);
    }
  };

  const ownedCount = stores.filter((s) => s.role === 'owner').length;
  const canCreate = ownedCount < MAX_STORES;

  return (
    <div style={s.wrap}>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>내 가게</h1>
          <p style={s.sub}>{userEmail}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/auth/logout" style={s.logoutLink}>로그아웃</Link>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => setShowCreate(true)}
            style={{ ...s.btnPrimary, opacity: canCreate ? 1 : 0.5, cursor: canCreate ? 'pointer' : 'not-allowed' }}
          >
            + 새 가게
          </button>
        </div>
      </header>

      {loading ? (
        <div style={s.empty}>불러오는 중…</div>
      ) : stores.length === 0 ? (
        <div style={s.empty}>
          <p style={{ fontSize: 15, marginBottom: 8 }}>아직 가게가 없습니다.</p>
          <p style={{ fontSize: 13, color: 'var(--text-3, #9aa0b3)' }}>
            우측 상단의 &quot;+ 새 가게&quot;를 눌러 첫 가게를 만들어 보세요.
          </p>
        </div>
      ) : (
        <div style={s.grid}>
          {stores.map(({ store, role }) => (
            <Link key={store.id} href={`/s/${store.slug}/admin/dashboard`} style={s.card}>
              <div style={s.cardHead}>
                <div style={s.cardName}>{store.name}</div>
                <span style={{ ...s.badge, ...roleStyle(role) }}>{labelRole(role)}</span>
              </div>
              <div style={s.cardMeta}>
                <code style={s.slug}>/{store.slug}</code>
              </div>
              <div style={s.cardFoot}>
                <span style={store.is_open ? s.open : s.closed}>
                  {store.is_open ? '영업 중' : '영업 종료'}
                </span>
                <span style={s.mode}>
                  {store.serving_mode === 'table' ? '테이블 서빙' : '픽업'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={s.footerHint}>
        유저당 최대 <strong>{MAX_STORES}개</strong>의 가게를 소유할 수 있습니다 (현재 {ownedCount}/{MAX_STORES}).
      </div>

      {showCreate && (
        <div style={s.modalBackdrop} onClick={() => !creating && setShowCreate(false)}>
          <form onSubmit={onCreate} style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>새 가게 만들기</h2>
            <label style={s.label}>가게 이름</label>
            <input
              required
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={s.input}
              maxLength={60}
              placeholder="예: 고대 축제 주점"
            />
            <label style={s.label}>slug (URL용, 비우면 자동)</label>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              style={s.input}
              placeholder="예: ku-festival"
              pattern="^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$"
            />
            {error && <div style={s.error}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={creating}
                style={s.btnGhost}
              >
                취소
              </button>
              <button type="submit" disabled={creating} style={s.btnPrimary}>
                {creating ? '생성 중…' : '생성'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function mapError(code?: string): string {
  switch (code) {
    case 'max_stores_exceeded': return '가게는 최대 5개까지만 소유할 수 있습니다.';
    case 'invalid_name':        return '가게 이름을 확인해 주세요.';
    case 'invalid_slug':        return 'slug는 영소문자·숫자·하이픈만 3~50자입니다.';
    case 'unauthorized':        return '로그인이 필요합니다.';
    default:                    return `오류가 발생했습니다${code ? ` (${code})` : ''}.`;
  }
}

function labelRole(r: StoreCard['role']): string {
  return r === 'owner' ? '소유자' : r === 'manager' ? '매니저' : '주방';
}

function roleStyle(r: StoreCard['role']): React.CSSProperties {
  if (r === 'owner') return { background: 'rgba(59,130,246,.2)', color: '#93c5fd' };
  if (r === 'manager') return { background: 'rgba(34,197,94,.2)', color: '#86efac' };
  return { background: 'rgba(234,179,8,.2)', color: '#fde68a' };
}

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100dvh', padding: '32px 24px', background: 'var(--bg-1, #0E1220)', color: 'var(--text-1, #fff)' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    maxWidth: 1100, margin: '0 auto 28px', gap: 16, flexWrap: 'wrap',
  },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--text-3, #9aa0b3)' },
  logoutLink: { color: 'var(--text-3, #9aa0b3)', fontSize: 13, textDecoration: 'none' },
  btnPrimary: {
    padding: '10px 16px', borderRadius: 10, border: 'none',
    background: 'var(--accent, #3B82F6)', color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
  btnGhost: {
    padding: '10px 16px', borderRadius: 10,
    border: '1px solid var(--border, #2a3150)', background: 'transparent',
    color: 'var(--text-2, #c9ccd6)', fontSize: 14, cursor: 'pointer',
  },
  grid: {
    display: 'grid', gap: 14, maxWidth: 1100, margin: '0 auto',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  },
  card: {
    background: 'var(--bg-2, #141A2E)', borderRadius: 14, padding: 18,
    textDecoration: 'none', color: 'inherit',
    border: '1px solid var(--border, #2a3150)',
    display: 'flex', flexDirection: 'column', gap: 10,
    transition: 'transform .12s ease, border-color .12s ease',
  },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 16, fontWeight: 700 },
  cardMeta: {},
  slug: {
    fontSize: 12, color: 'var(--text-3, #9aa0b3)',
    background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 6,
  },
  cardFoot: { display: 'flex', gap: 10, fontSize: 12, alignItems: 'center', marginTop: 4 },
  open:   { color: '#86efac', fontWeight: 600 },
  closed: { color: '#9aa0b3' },
  mode:   { color: 'var(--text-3, #9aa0b3)' },
  badge: { fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600 },
  empty: {
    maxWidth: 1100, margin: '60px auto', padding: 40,
    textAlign: 'center', background: 'var(--bg-2, #141A2E)', borderRadius: 14,
    border: '1px dashed var(--border, #2a3150)',
  },
  footerHint: {
    maxWidth: 1100, margin: '28px auto 0',
    fontSize: 12, color: 'var(--text-3, #9aa0b3)', textAlign: 'center',
  },
  modalBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100,
  },
  modal: {
    width: '100%', maxWidth: 400, background: 'var(--bg-2, #141A2E)',
    borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 8,
    border: '1px solid var(--border, #2a3150)',
  },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  label: { fontSize: 12, color: 'var(--text-3, #9aa0b3)', marginTop: 8 },
  input: {
    padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border, #2a3150)',
    background: 'var(--bg-1, #0E1220)', color: 'var(--text-1, #fff)', fontSize: 14,
  },
  error: {
    fontSize: 13, color: '#ff9a9a',
    background: 'rgba(255,70,70,.15)', border: '1px solid rgba(255,70,70,.4)',
    padding: '8px 10px', borderRadius: 8, marginTop: 8,
  },
};
