'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useConfirm } from '@/components/ConfirmProvider';

export interface StoreCard {
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

export default function DashboardClient({
  userEmail,
  initialStores,
}: {
  userEmail: string;
  initialStores: StoreCard[];
}) {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [stores, setStores] = useState<StoreCard[]>(initialStores);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stores');
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const json = (await res.json()) as { stores?: StoreCard[]; error?: string };
      if (res.ok) setStores(json.stores ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

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
      const slug: string = json.store?.slug ?? json.slug ?? newSlug;
      router.push(`/s/${slug}/admin/dashboard`);
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (card: StoreCard) => {
    const ok = await confirm({
      title: '주점 삭제',
      message: `"${card.store.name}"을 삭제하면 모든 메뉴·주문·결제 데이터가 함께 삭제됩니다. 되돌릴 수 없습니다.`,
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    setDeleting(card.store.id);
    try {
      const res = await fetch(`/api/stores/${card.store.slug}`, { method: 'DELETE' });
      if (res.ok) setStores((prev) => prev.filter((s) => s.store.id !== card.store.id));
    } finally {
      setDeleting(null);
    }
  };

  const ownedCount = stores.filter((s) => s.role === 'owner').length;
  const canCreate = ownedCount < MAX_STORES;

  return (
    <div className="min-h-[100dvh] bg-[var(--paper)] px-5 pt-8 pb-[60px]">
      <div className="max-w-[1100px] mx-auto">
        <header className="flex justify-between items-center mb-7 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-[42px] h-[42px] rounded-[var(--r-sm)] bg-[var(--ink-900)] text-[var(--neon)] flex items-center justify-center font-extrabold text-lg">주</div>
            <div>
              <div className="text-lg font-extrabold text-[var(--ink-900)] tracking-[-0.02em]">내 가게</div>
              <div className="text-xs text-[var(--text-3)] mt-[2px]">{userEmail}</div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
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
          <div className="my-10 py-12 px-8 text-center bg-[var(--surface)] rounded-[var(--r-lg)] border border-dashed border-[var(--ink-200)]">불러오는 중…</div>
        ) : stores.length === 0 ? (
          <div className="my-10 py-12 px-8 text-center bg-[var(--surface)] rounded-[var(--r-lg)] border border-dashed border-[var(--ink-200)]">
            <div className="text-[40px] mb-3">🍻</div>
            <div className="text-[17px] font-extrabold text-[var(--ink-900)] mb-[6px]">아직 가게가 없어요</div>
            <div className="text-sm text-[var(--text-2)] leading-relaxed">
              우측 상단의 <strong className="text-[var(--ink-900)]">+ 새 가게</strong>를 눌러 첫 가게를 만들어 보세요.
            </div>
          </div>
        ) : (
          <div className="grid gap-[14px] grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            {stores.map((card) => {
              const { store, role } = card;
              return (
              <div key={store.id} className="relative group">
                <Link
                  href={`/s/${store.slug}/admin/dashboard`}
                  className="bg-[var(--surface)] rounded-[var(--r-lg)] p-[18px] no-underline text-inherit border border-[var(--border)] flex flex-col gap-[10px] shadow-[var(--shadow-1)] transition-[transform_box-shadow] duration-[100ms,150ms] ease block"
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="text-[17px] font-extrabold text-[var(--ink-900)] tracking-[-0.02em]">{store.name}</div>
                    <span className={`badge ${roleBadgeClass(role)}`} style={{ fontSize: 11 }}>
                      {labelRole(role)}
                    </span>
                  </div>

                  <div>
                    <code className="text-xs text-[var(--ink-600)] bg-[var(--ink-050)] py-[3px] px-2 rounded-[var(--r-sm)] font-[var(--f-sans)]">/s/{store.slug}</code>
                  </div>

                  <div className="flex gap-2 items-center mt-1">
                    <span
                      className={`badge ${store.is_open ? 'badge-mint' : 'badge-neutral'}`}
                      style={{ fontSize: 11 }}
                    >
                      {store.is_open ? '영업 중' : '영업 종료'}
                    </span>
                    <span className="text-xs text-[var(--text-3)] font-medium">
                      {store.serving_mode === 'table' ? '테이블 서빙' : '픽업'}
                    </span>
                  </div>
                </Link>
                {role === 'owner' && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); void onDelete(card); }}
                    disabled={deleting === store.id}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full border-0 flex items-center justify-center text-[13px] cursor-pointer transition-opacity"
                    style={{ background: 'color-mix(in oklab, var(--crim) 12%, white)', color: 'var(--crim)' }}
                    title="주점 삭제"
                  >
                    {deleting === store.id ? '…' : '×'}
                  </button>
                )}
              </div>
              );
            })}
          </div>
        )}

        <div className="mt-7 text-[13px] text-[var(--text-3)] text-center">
          유저당 최대 <strong className="text-[var(--ink-900)]">{MAX_STORES}개</strong>의 가게를 소유할 수 있습니다
          (현재 <span className="numeric">{ownedCount}/{MAX_STORES}</span>).
        </div>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 bg-[rgba(14,18,32,.45)] backdrop-blur-[4px] flex items-center justify-center p-5 z-[100] [animation:fadeIn_.15s_ease]"
          onClick={() => !creating && setShowCreate(false)}
        >
          <form
            onSubmit={onCreate}
            className="w-full max-w-[420px] bg-[var(--surface)] rounded-[var(--r-xl)] p-7 flex flex-col gap-[6px] border border-[var(--border)] shadow-[var(--shadow-3)] [animation:pop_.2s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-extrabold text-[var(--ink-900)] tracking-[-0.02em] mb-1">새 가게 만들기</h2>
            <p className="text-[13px] text-[var(--text-2)] leading-relaxed mb-3">축제용 주점 한 곳을 만들 거예요. 이름은 QR과 손님 화면에 그대로 표시됩니다.</p>

            <label className="text-xs font-semibold text-[var(--text-2)] mt-[10px]">가게 이름</label>
            <input
              required
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="py-3 px-[14px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-900)] text-[15px] font-[var(--f-sans)] outline-none"
              maxLength={60}
              placeholder="예: 고대 축제 주점"
            />

            <label className="text-xs font-semibold text-[var(--text-2)] mt-[10px]">slug (URL) — 비우면 자동</label>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="py-3 px-[14px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-900)] text-[15px] font-[var(--f-sans)] outline-none"
              placeholder="예: ku-festival"
              pattern="^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$"
            />
            <div className="text-[11px] text-[var(--text-3)] mt-1">영소문자·숫자·하이픈만 3~50자</div>

            {error && (
              <div className="mt-3 py-[10px] px-3 bg-[color-mix(in_oklab,var(--crim)_10%,white)] border border-[color-mix(in_oklab,var(--crim)_30%,white)] rounded-[var(--r-sm)] text-[13px] text-[#8e0f0f]">
                {error}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={creating}
                className="btn btn-ghost flex-1"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={creating}
                className="btn btn-accent flex-1"
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
