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
      <div style={s.inner}>
        <header style={s.header}>
          <div style={s.brandRow}>
            <div style={s.brandLogo}>주</div>
            <div>
              <div style={s.brandName}>내 가게</div>
              <div style={s.brandSub}>{userEmail}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/auth/logout" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
              로그아웃
            </Link>
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => setShowCreate(true)}
              className="btn btn-primary btn-sm"
              style={{ opacity: canCreate ? 1 : 0.4, cursor: canCreate ? 'pointer' : 'not-allowed' }}
            >
              + 새 가게
            </button>
          </div>
        </header>

        {loading ? (
          <div style={s.empty}>불러오는 중…</div>
        ) : stores.length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>🍻</div>
            <div style={s.emptyTitle}>아직 가게가 없어요</div>
            <div style={s.emptySub}>
              우측 상단의 <strong style={{ color: 'var(--ink-900)' }}>+ 새 가게</strong>를 눌러 첫 가게를 만들어 보세요.
            </div>
          </div>
        ) : (
          <div style={s.grid}>
            {stores.map(({ store, role }) => (
              <Link key={store.id} href={`/s/${store.slug}/admin/dashboard`} style={s.card}>
                <div style={s.cardHead}>
                  <div style={s.cardName}>{store.name}</div>
                  <span className={`badge ${roleBadgeClass(role)}`} style={{ fontSize: 11 }}>
                    {labelRole(role)}
                  </span>
                </div>

                <div style={s.cardSlug}>
                  <code style={s.slug}>/s/{store.slug}</code>
                </div>

                <div style={s.cardFoot}>
                  <span
                    className={`badge ${store.is_open ? 'badge-mint' : 'badge-neutral'}`}
                    style={{ fontSize: 11 }}
                  >
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
          유저당 최대 <strong style={{ color: 'var(--ink-900)' }}>{MAX_STORES}개</strong>의 가게를 소유할 수 있습니다
          (현재 <span className="numeric">{ownedCount}/{MAX_STORES}</span>).
        </div>
      </div>

      {showCreate && (
        <div style={s.modalBackdrop} onClick={() => !creating && setShowCreate(false)}>
          <form onSubmit={onCreate} style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={s.modalTitle}>새 가게 만들기</h2>
            <p style={s.modalSub}>축제용 주점 한 곳을 만들 거예요. 이름은 QR과 손님 화면에 그대로 표시됩니다.</p>

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

            <label style={s.label}>slug (URL) — 비우면 자동</label>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              style={s.input}
              placeholder="예: ku-festival"
              pattern="^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$"
            />
            <div style={s.hint}>영소문자·숫자·하이픈만 3~50자</div>

            {error && <div style={s.error}>{error}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={creating}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={creating}
                className="btn btn-accent"
                style={{ flex: 1 }}
              >
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

function roleBadgeClass(r: StoreCard['role']): string {
  if (r === 'owner') return 'badge-ink';
  if (r === 'manager') return 'badge-mint';
  return 'badge-amber';
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100dvh',
    background: 'var(--paper)',
    padding: '32px 20px 60px',
  },
  inner: { maxWidth: 1100, margin: '0 auto' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    gap: 16,
    flexWrap: 'wrap',
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 12 },
  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: 'var(--r-sm)',
    background: 'var(--ink-900)',
    color: 'var(--neon)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 18,
  },
  brandName: { fontSize: 18, fontWeight: 800, color: 'var(--ink-900)', letterSpacing: '-0.02em' },
  brandSub: { fontSize: 12, color: 'var(--text-3)', marginTop: 2 },
  grid: {
    display: 'grid',
    gap: 14,
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--r-lg)',
    padding: 18,
    textDecoration: 'none',
    color: 'inherit',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: 'var(--shadow-1)',
    transition: 'transform .1s ease, box-shadow .15s ease',
  },
  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardName: { fontSize: 17, fontWeight: 800, color: 'var(--ink-900)', letterSpacing: '-0.02em' },
  cardSlug: {},
  slug: {
    fontSize: 12,
    color: 'var(--ink-600)',
    background: 'var(--ink-050)',
    padding: '3px 8px',
    borderRadius: 'var(--r-sm)',
    fontFamily: 'var(--f-sans)',
  },
  cardFoot: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 },
  mode: { fontSize: 12, color: 'var(--text-3)', fontWeight: 500 },
  empty: {
    margin: '40px 0',
    padding: '48px 32px',
    textAlign: 'center',
    background: 'var(--surface)',
    borderRadius: 'var(--r-lg)',
    border: '1px dashed var(--ink-200)',
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: 800, color: 'var(--ink-900)', marginBottom: 6 },
  emptySub: { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 },
  footerHint: {
    marginTop: 28,
    fontSize: 13,
    color: 'var(--text-3)',
    textAlign: 'center',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(14,18,32,.45)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 100,
    animation: 'fadeIn .15s ease',
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--surface)',
    borderRadius: 'var(--r-xl)',
    padding: 28,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-3)',
    animation: 'pop .2s ease',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--ink-900)',
    letterSpacing: '-0.02em',
    marginBottom: 4,
  },
  modalSub: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginTop: 10 },
  input: {
    padding: '12px 14px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)',
    background: 'var(--surface-2)',
    color: 'var(--ink-900)',
    fontSize: 15,
    fontFamily: 'var(--f-sans)',
    outline: 'none',
  },
  hint: { fontSize: 11, color: 'var(--text-3)', marginTop: 4 },
  error: {
    marginTop: 12,
    padding: '10px 12px',
    background: 'color-mix(in oklab, var(--crim) 10%, white)',
    border: '1px solid color-mix(in oklab, var(--crim) 30%, white)',
    borderRadius: 'var(--r-sm)',
    fontSize: 13,
    color: '#8e0f0f',
  },
};
