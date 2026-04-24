'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useConfirm } from '@/components/ConfirmProvider';
import { createClient } from '@/lib/supabase/client';

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

  // 새 주점 생성
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 설정 팝업
  const [settingsCard, setSettingsCard] = useState<StoreCard | null>(null);

  // 이름 변경
  const [renameCard, setRenameCard] = useState<StoreCard | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // 삭제
  const [deleting, setDeleting] = useState<string | null>(null);

  // 세션 만료 감지 → 로그인 리다이렉트
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const handleUnauthorized = useCallback(() => {
    router.replace('/login?next=/dashboard');
  }, [router]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, slug: newSlug || undefined }),
      });
      if (res.status === 401) { setShowCreate(false); handleUnauthorized(); return; }
      const json = await res.json();
      if (!res.ok) { setCreateError(mapError(json.error as string)); return; }
      setShowCreate(false);
      setNewName('');
      setNewSlug('');
      const slug: string = json.store?.slug ?? json.slug ?? newSlug;
      router.push(`/s/${slug}/admin/dashboard`);
    } finally {
      setCreating(false);
    }
  };

  const openSettings = (card: StoreCard) => setSettingsCard(card);
  const closeSettings = () => setSettingsCard(null);

  const openRename = (card: StoreCard) => {
    setSettingsCard(null);
    setRenameCard(card);
    setRenameName(card.store.name);
    setRenameError(null);
  };
  const closeRename = () => { setRenameCard(null); setRenameName(''); setRenameError(null); };

  const onRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameCard) return;
    const trimmed = renameName.trim();
    if (!trimmed || trimmed === renameCard.store.name) { closeRename(); return; }
    setRenaming(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/stores/${renameCard.store.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.status === 401) { closeRename(); handleUnauthorized(); return; }
      const json = await res.json();
      if (!res.ok) { setRenameError(json.error ?? '오류가 발생했습니다.'); return; }
      setStores((prev) =>
        prev.map((s) =>
          s.store.id === renameCard.store.id
            ? { ...s, store: { ...s.store, name: trimmed } }
            : s,
        ),
      );
      closeRename();
    } finally {
      setRenaming(false);
    }
  };

  const onDelete = async (card: StoreCard) => {
    setSettingsCard(null);
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
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setStores((prev) => prev.filter((s) => s.store.id !== card.store.id));
    } finally {
      setDeleting(null);
    }
  };

  const ownerStores   = stores.filter((s) => s.role === 'owner');
  const managerStores = stores.filter((s) => s.role === 'manager');
  const kitchenStores = stores.filter((s) => s.role === 'kitchen');
  const ownedCount    = ownerStores.length;
  const canCreate     = ownedCount < MAX_STORES;

  return (
    <div className="min-h-[100dvh] bg-[var(--paper)] px-5 pt-8 pb-[60px]">
      <div className="max-w-[1100px] mx-auto">

        {/* ── 헤더 ── */}
        <header className="flex justify-between items-center mb-8 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-[42px] h-[42px] rounded-[var(--r-sm)] bg-[var(--ink-900)] text-[var(--neon)] flex items-center justify-center font-extrabold text-lg">주</div>
            <div>
              <div className="text-lg font-extrabold text-[var(--ink-900)] tracking-[-0.02em]">내 주점</div>
              <div className="text-xs text-[var(--text-3)] mt-[2px]">{userEmail}</div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Link href="/auth/logout" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>로그아웃</Link>
            <button
              type="button"
              disabled={!canCreate}
              onClick={() => setShowCreate(true)}
              className="btn btn-primary btn-sm"
              style={{ opacity: canCreate ? 1 : 0.4, cursor: canCreate ? 'pointer' : 'not-allowed' }}
            >
              + 새 주점
            </button>
          </div>
        </header>

        {stores.length === 0 ? (
          <div className="my-10 py-12 px-8 text-center bg-[var(--surface)] rounded-[var(--r-lg)] border border-dashed border-[var(--ink-200)]">
            <div className="text-[40px] mb-3">🍻</div>
            <div className="text-[17px] font-extrabold text-[var(--ink-900)] mb-[6px]">아직 주점이 없어요</div>
            <div className="text-sm text-[var(--text-2)] leading-relaxed">
              우측 상단의 <strong className="text-[var(--ink-900)]">+ 새 주점</strong>을 눌러 첫 주점을 만들어 보세요.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* 소유자 섹션 */}
            {ownerStores.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[13px] font-bold text-[var(--text-3)] uppercase tracking-widest">소유자</span>
                  <span className="text-[12px] font-semibold text-[var(--text-3)]">{ownedCount}/{MAX_STORES}</span>
                </div>
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                  {ownerStores.map((card) => <StoreBoothCard key={card.store.id} card={card} deleting={deleting} onSettings={openSettings} />)}
                </div>
              </section>
            )}

            {/* 매니저 섹션 */}
            {managerStores.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[13px] font-bold text-[var(--text-3)] uppercase tracking-widest">매니저로 참여 중</span>
                </div>
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                  {managerStores.map((card) => <StoreBoothCard key={card.store.id} card={card} deleting={deleting} onSettings={null} />)}
                </div>
              </section>
            )}

            {/* 주방 섹션 */}
            {kitchenStores.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[13px] font-bold text-[var(--text-3)] uppercase tracking-widest">주방 접근</span>
                </div>
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                  {kitchenStores.map((card) => <StoreBoothCard key={card.store.id} card={card} deleting={deleting} onSettings={null} />)}
                </div>
              </section>
            )}
          </div>
        )}

        <div className="mt-7 text-[13px] text-[var(--text-3)] text-center">
          유저당 최대 <strong className="text-[var(--ink-900)]">{MAX_STORES}개</strong>의 주점을 소유할 수 있습니다.
        </div>
      </div>

      {/* ── 새 주점 생성 모달 ── */}
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
            <h2 className="text-xl font-extrabold text-[var(--ink-900)] tracking-[-0.02em] mb-1">새 주점 만들기</h2>
            <p className="text-[13px] text-[var(--text-2)] leading-relaxed mb-3">이름은 QR과 손님 화면에 그대로 표시됩니다.</p>

            <label className="text-xs font-semibold text-[var(--text-2)] mt-[10px]">주점 이름</label>
            <input
              required autoFocus
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

            {createError && (
              <div className="mt-3 py-[10px] px-3 bg-[color-mix(in_oklab,var(--crim)_10%,white)] border border-[color-mix(in_oklab,var(--crim)_30%,white)] rounded-[var(--r-sm)] text-[13px] text-[#8e0f0f]">
                {createError}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShowCreate(false)} disabled={creating} className="btn btn-ghost flex-1">취소</button>
              <button type="submit" disabled={creating} className="btn btn-accent flex-1">{creating ? '생성 중…' : '생성'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── 설정 팝업 ── */}
      {settingsCard && (
        <div
          className="fixed inset-0 bg-[rgba(14,18,32,.45)] backdrop-blur-[4px] flex items-center justify-center p-5 z-[100] [animation:fadeIn_.15s_ease]"
          onClick={closeSettings}
        >
          <div
            className="w-full max-w-[340px] bg-[var(--surface)] rounded-[var(--r-xl)] overflow-hidden border border-[var(--border)] shadow-[var(--shadow-3)] [animation:pop_.2s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4">
              <div className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-widest mb-1">주점 설정</div>
              <div className="text-[17px] font-extrabold text-[var(--ink-900)] tracking-[-0.02em] truncate">{settingsCard.store.name}</div>
            </div>
            <div className="border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => openRename(settingsCard)}
                className="w-full text-left px-6 py-[14px] text-[15px] font-semibold text-[var(--ink-900)] hover:bg-[var(--ink-050)] transition-colors cursor-pointer border-0 bg-transparent"
              >
                이름 변경
              </button>
              <div className="border-t border-[var(--border)]" />
              <button
                type="button"
                onClick={() => void onDelete(settingsCard)}
                className="w-full text-left px-6 py-[14px] text-[15px] font-semibold transition-colors cursor-pointer border-0 bg-transparent"
                style={{ color: 'var(--crim)' }}
              >
                주점 삭제
              </button>
            </div>
            <div className="border-t border-[var(--border)] px-6 py-[12px]">
              <button type="button" onClick={closeSettings} className="btn btn-ghost w-full">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 이름 변경 모달 ── */}
      {renameCard && (
        <div
          className="fixed inset-0 bg-[rgba(14,18,32,.45)] backdrop-blur-[4px] flex items-center justify-center p-5 z-[100] [animation:fadeIn_.15s_ease]"
          onClick={() => !renaming && closeRename()}
        >
          <form
            onSubmit={onRename}
            className="w-full max-w-[400px] bg-[var(--surface)] rounded-[var(--r-xl)] p-7 flex flex-col gap-[6px] border border-[var(--border)] shadow-[var(--shadow-3)] [animation:pop_.2s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-extrabold text-[var(--ink-900)] tracking-[-0.02em] mb-1">이름 변경</h2>
            <p className="text-[13px] text-[var(--text-2)] leading-relaxed mb-3">변경된 이름은 QR과 손님 화면에 바로 반영됩니다.</p>

            <label className="text-xs font-semibold text-[var(--text-2)] mt-[10px]">주점 이름</label>
            <input
              required autoFocus
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              className="py-3 px-[14px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--ink-900)] text-[15px] font-[var(--f-sans)] outline-none"
              maxLength={60}
            />

            {renameError && (
              <div className="mt-2 py-[10px] px-3 bg-[color-mix(in_oklab,var(--crim)_10%,white)] border border-[color-mix(in_oklab,var(--crim)_30%,white)] rounded-[var(--r-sm)] text-[13px] text-[#8e0f0f]">
                {renameError}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button type="button" onClick={closeRename} disabled={renaming} className="btn btn-ghost flex-1">취소</button>
              <button type="submit" disabled={renaming} className="btn btn-accent flex-1">{renaming ? '저장 중…' : '저장'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StoreBoothCard({
  card,
  deleting,
  onSettings,
}: {
  card: StoreCard;
  deleting: string | null;
  onSettings: ((card: StoreCard) => void) | null;
}) {
  const { store, role } = card;
  return (
    <div className="bg-white rounded-[18px] border border-[var(--border)] flex flex-col overflow-hidden shadow-[var(--shadow-1)]">
      <Link
        href={`/s/${store.slug}/admin/dashboard`}
        className="p-[18px] flex flex-col gap-[10px] flex-1 no-underline text-inherit"
      >
        {/* 이름 + 역할 */}
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="text-[15px] font-extrabold text-[var(--ink-900)] tracking-[-0.02em] leading-[1.2]">{store.name}</div>
            <div className="text-[11px] text-[var(--text-2)] font-semibold mt-[3px]">/s/{store.slug}</div>
          </div>
          <span className={`badge ${roleBadgeClass(role)} shrink-0`} style={{ fontSize: 11 }}>{labelRole(role)}</span>
        </div>

        {/* 상태 */}
        <div className="flex gap-[6px] items-center text-[11px] text-[var(--text-2)] font-semibold mt-auto">
          <span
            className="w-[6px] h-[6px] rounded-full shrink-0"
            style={{ background: store.is_open ? 'var(--mint)' : 'var(--ink-300)' }}
          />
          {store.is_open ? '영업 중' : '영업 종료'}
          <span className="text-[var(--ink-300)]">·</span>
          {store.serving_mode === 'table' ? '테이블 서빙' : '픽업'}
        </div>
      </Link>

      {/* 설정 버튼 (소유자만) */}
      {onSettings && (
        <div className="border-t border-[var(--border)] px-[14px] py-[9px] flex justify-end">
          <button
            type="button"
            onClick={() => onSettings(card)}
            disabled={deleting === store.id}
            className="text-xs font-semibold text-[var(--text-2)] hover:text-[var(--ink-900)] px-2 py-1 rounded-[var(--r-sm)] hover:bg-[var(--ink-050)] transition-colors cursor-pointer border-0 bg-transparent"
          >
            {deleting === store.id ? '삭제 중…' : '설정'}
          </button>
        </div>
      )}
    </div>
  );
}

function mapError(code?: string): string {
  switch (code) {
    case 'max_stores_exceeded': return '주점은 최대 5개까지만 소유할 수 있습니다.';
    case 'invalid_name':        return '주점 이름을 확인해 주세요.';
    case 'invalid_slug':        return 'slug는 영소문자·숫자·하이픈만 3~50자입니다.';
    case 'unauthorized':        return '세션이 만료되었습니다. 다시 로그인해 주세요.';
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
