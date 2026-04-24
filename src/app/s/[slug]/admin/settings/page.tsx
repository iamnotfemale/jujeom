'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/admin-api';
import { useConfirm } from '@/components/ConfirmProvider';
import { useToast } from '@/components/ToastProvider';
import { BANK_OPTIONS } from '@/lib/banks';
import { useStore } from '../../StoreProvider';
import { supabase } from '@/lib/supabase';

type Editable = {
  name: string;
  bank_name: string;
  account_number: string;
  toss_qr_url: string;
  is_open: boolean;
  is_paused: boolean;
  serving_mode: 'pickup' | 'table';
  account_holder: string;
  closed_message: string;
  welcome_text: string;
  welcome_highlight: string;
  notice: string;
  auto_lock_kds: boolean;
  logo_url: string;
};

const SECTIONS = [
  { id: 'store-info', label: '가게 정보' },
  { id: 'operations', label: '운영 설정' },
  { id: 'payment', label: '결제 정보' },
  { id: 'kitchen', label: '주방 설정' },
  { id: 'reset', label: '데이터 초기화' },
] as const;

function isDirty(a: Editable, b: Editable): boolean {
  return (Object.keys(a) as (keyof Editable)[]).some((k) => a[k] !== b[k]);
}

export default function SettingsPage() {
  const store = useStore();
  const router = useRouter();
  const { showToast } = useToast();
  const { confirm: showConfirm } = useConfirm();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('store_members')
        .select('role')
        .eq('store_id', store.id)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          const r = (data as { role?: string } | null)?.role;
          if (r === 'kitchen') router.replace(`/s/${store.slug}/admin/dashboard`);
        });
    });
  }, [store.id, store.slug, router]);

  const makeInitial = useCallback(
    (): Editable => ({
      name: store.name,
      bank_name: store.bank_name,
      account_number: store.account_number,
      toss_qr_url: store.toss_qr_url,
      is_open: store.is_open,
      is_paused: store.is_paused,
      serving_mode: store.serving_mode,
      account_holder: store.account_holder ?? '',
      closed_message: store.closed_message ?? '',
      welcome_text: store.welcome_text ?? '',
      welcome_highlight: store.welcome_highlight ?? '',
      notice: store.notice ?? '',
      auto_lock_kds: store.auto_lock_kds ?? false,
      logo_url: store.logo_url ?? '',
    }),
    [store],
  );

  const [initial, setInitial] = useState<Editable>(makeInitial);
  const [form, setForm] = useState<Editable>(makeInitial);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const dirty = isDirty(form, initial);

  const update = <K extends keyof Editable>(k: K, v: Editable[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/admin/${store.slug}/logo`, {
      method: 'POST',
      body: fd,
    });
    const json = (await res.json()) as { logo_url?: string; error?: string };
    setLogoUploading(false);
    if (!res.ok) {
      showToast(
        json.error === 'file_too_large'
          ? '2MB 이하 이미지만 가능합니다'
          : json.error === 'invalid_type'
            ? '이미지 파일(JPG, PNG, WEBP, GIF)만 가능합니다'
            : '업로드 실패',
        'error',
      );
      return;
    }
    const newUrl = json.logo_url ?? '';
    update('logo_url', newUrl);
    // 로고는 별도 API — initial도 동기화해 dirty 상태 오염 방지
    setInitial((prev) => ({ ...prev, logo_url: newUrl }));
    showToast('로고가 업데이트됐습니다', 'success');
  };

  const handleLogoDelete = async () => {
    const ok = await showConfirm({
      title: '로고 삭제',
      message: '로고를 삭제할까요?',
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/${store.slug}/logo`, { method: 'DELETE' });
    update('logo_url', '');
    setInitial((prev) => ({ ...prev, logo_url: '' }));
    showToast('로고가 삭제됐습니다', 'success');
  };

  const handleSave = async () => {
    setSaving(true);
    const { logo_url: _logoUrl, ...rest } = form;
    const { error } = await adminApi(`/api/stores/${store.slug}`, {
      method: 'PATCH',
      body: rest,
    });
    setSaving(false);
    if (error) {
      showToast(`저장 실패: ${error}`, 'error');
      return;
    }
    showToast('저장되었습니다.', 'success');
    // reload 없이 initial을 현재 form 값으로 업데이트 + 라우터 캐시 무효화
    setInitial({ ...form });
    router.refresh();
  };

  const handleRevert = () => {
    setForm({ ...initial });
  };

  const resetData = async (type: 'payments' | 'tables' | 'all') => {
    const label = type === 'all' ? '전체 데이터' : type === 'tables' ? '테이블' : '결제·주문';
    const ok = await showConfirm({
      title: `${label} 초기화`,
      message: '되돌릴 수 없습니다. 정말 초기화하시겠어요?',
      confirmText: '초기화',
      danger: true,
    });
    if (!ok) return;
    const { error } = await adminApi(`/api/admin/${store.slug}/reset`, {
      method: 'POST',
      body: { type },
    });
    if (error) showToast(`초기화 실패: ${error}`, 'error');
    else showToast(`${label} 초기화 완료`, 'success');
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={s.page}>
      {/* TOC sidebar — hidden on mobile */}
      <aside style={s.toc} className="hidden lg:block">
        <div style={s.tocInner}>
          <div style={s.tocTitle}>목차</div>
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => scrollTo(sec.id)}
              style={s.tocBtn}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <div style={s.content}>
        <header style={s.header}>
          <h1 style={s.h1}>설정</h1>
          <p style={s.sub}>이 가게의 기본 정보와 영업 상태를 관리합니다.</p>
        </header>

        {/* 가게 정보 */}
        <SectionCard id="store-info" title="가게 정보">
          <SettingRow label="로고">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="로고" style={s.logoImg} />
              ) : (
                <div style={s.logoPlaceholder}>酒</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="btn btn-ghost btn-sm"
                >
                  {logoUploading ? '업로드 중…' : '변경'}
                </button>
                {form.logo_url && (
                  <button
                    type="button"
                    onClick={handleLogoDelete}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--crim)' }}
                  >
                    삭제
                  </button>
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleLogoUpload(f);
                  e.target.value = '';
                }}
              />
            </div>
          </SettingRow>
          <SettingRow label="가게 이름">
            <input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              style={s.input}
            />
          </SettingRow>
          <SettingRow label="slug (URL)">
            <input
              value={store.slug}
              disabled
              style={{ ...s.input, ...s.inputDisabled }}
            />
          </SettingRow>
          <SettingRow label="가게 소개" hint="손님 주문 화면에 표시됩니다">
            <input
              value={form.welcome_text}
              onChange={(e) => update('welcome_text', e.target.value)}
              placeholder="예: 어서 오세요, 즐거운 한 잔 되세요."
              style={s.input}
            />
          </SettingRow>
          <SettingRow label="강조 문구">
            <input
              value={form.welcome_highlight}
              onChange={(e) => update('welcome_highlight', e.target.value)}
              placeholder="예: 오늘도 맛있게!"
              style={s.input}
            />
          </SettingRow>
          <SettingRow label="공지사항" hint="손님 주문 화면 하단에 표시됩니다">
            <textarea
              value={form.notice}
              onChange={(e) => update('notice', e.target.value)}
              rows={3}
              style={{ ...s.input, ...s.textarea }}
            />
          </SettingRow>
          <SettingRow label="마감 메시지">
            <input
              value={form.closed_message}
              onChange={(e) => update('closed_message', e.target.value)}
              placeholder="예: 오늘 영업은 종료되었습니다."
              style={s.input}
            />
          </SettingRow>
        </SectionCard>

        {/* 운영 설정 */}
        <SectionCard id="operations" title="운영 설정">
          <SettingRow label="영업 중">
            <Toggle checked={form.is_open} onChange={(v) => update('is_open', v)} />
          </SettingRow>
          <SettingRow label="주문 일시 중단">
            <Toggle checked={form.is_paused} onChange={(v) => update('is_paused', v)} />
          </SettingRow>
          <SettingRow label="서빙 방식">
            <div style={{ display: 'flex', gap: 8 }}>
              {(
                [
                  { key: 'pickup' as const, label: '픽업', hint: '손님이 픽업대에서 가져감' },
                  { key: 'table' as const, label: '테이블 서빙', hint: '직원이 테이블로 가져다줌' },
                ]
              ).map((m) => {
                const active = form.serving_mode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    title={m.hint}
                    onClick={() => update('serving_mode', m.key)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 'var(--r-md)',
                      border: active ? '2px solid var(--ink-900)' : '1px solid var(--border)',
                      background: active ? 'var(--neon)' : 'var(--surface)',
                      color: active ? 'var(--neon-ink)' : 'var(--ink-700)',
                      cursor: 'pointer',
                      fontWeight: active ? 800 : 600,
                      fontSize: 14,
                      fontFamily: 'var(--f-sans)',
                      transition: 'all .1s ease',
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </SettingRow>
        </SectionCard>

        {/* 결제 정보 */}
        <SectionCard id="payment" title="결제 정보">
          <SettingRow label="은행">
            <select
              value={form.bank_name}
              onChange={(e) => update('bank_name', e.target.value)}
              style={s.input}
            >
              <option value="">선택하세요</option>
              {BANK_OPTIONS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.label}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow label="계좌번호">
            <input
              value={form.account_number}
              onChange={(e) => update('account_number', e.target.value)}
              placeholder="예: 123-456-789012"
              style={s.input}
            />
          </SettingRow>
          <SettingRow label="예금주">
            <input
              value={form.account_holder}
              onChange={(e) => update('account_holder', e.target.value)}
              placeholder="예금주 이름 (없으면 가게 이름으로 표시)"
              style={s.input}
            />
          </SettingRow>
          <SettingRow label="토스 QR URL">
            <input
              value={form.toss_qr_url}
              onChange={(e) => update('toss_qr_url', e.target.value)}
              placeholder="https://toss.me/..."
              style={s.input}
            />
          </SettingRow>
        </SectionCard>

        {/* 주방 설정 */}
        <SectionCard id="kitchen" title="주방 설정">
          <SettingRow label="KDS 자동 잠금">
            <Toggle checked={form.auto_lock_kds} onChange={(v) => update('auto_lock_kds', v)} />
          </SettingRow>
        </SectionCard>

        {/* 데이터 초기화 */}
        <SectionCard id="reset" title="데이터 초기화">
          <div style={{ padding: '16px 20px 20px' }}>
            <p style={s.resetDesc}>
              축제 전 연습·테스트 데이터를 지울 때 사용하세요.{' '}
              <strong style={{ color: 'var(--crim)' }}>되돌릴 수 없습니다.</strong>
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => resetData('payments')} className="btn btn-ghost btn-sm">
                결제·주문 초기화
              </button>
              <button type="button" onClick={() => resetData('tables')} className="btn btn-ghost btn-sm">
                테이블 초기화
              </button>
              <button type="button" onClick={() => resetData('all')} className="btn btn-danger btn-sm">
                전체 초기화
              </button>
            </div>
          </div>
        </SectionCard>

        {/* bottom padding */}
        <div style={{ height: 120 }} />
      </div>

      {/* Floating save pill — shown only when there are unsaved changes */}
      {dirty && (
        <div style={s.saveBar}>
          <span style={s.saveBarMsg}>저장하지 않은 변경사항</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleRevert}
              disabled={saving}
              style={s.revertBtn}
            >
              되돌리기
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={s.saveBtn}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={sect.wrap}>
      <h2 style={sect.title}>{title}</h2>
      <div style={sect.body}>{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={row.wrap}>
      <div style={row.labelCol}>
        <span style={row.label}>{label}</span>
        {hint && <span style={row.hint}>{hint}</span>}
      </div>
      <div style={row.field}>{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 'var(--r-pill)',
        border: 'none',
        background: checked ? 'var(--ink-900)' : 'var(--ink-200)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background .15s',
      }}
      aria-pressed={checked}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: checked ? 'var(--neon)' : '#fff',
          boxShadow: '0 1px 3px rgba(14,18,32,.2)',
          transition: 'left .15s',
        }}
      />
    </button>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    minHeight: '100%',
    background: '#F5F5F7',
    position: 'relative',
  },
  toc: {
    // hidden on mobile via media query not available in inline styles;
    // we use a fixed-width sidebar that's just invisible at narrow widths
    width: 180,
    flexShrink: 0,
    // hide at narrow viewport via CSS display none via a wrapper trick
    // (see tocInner below for the sticky positioning)
  },
  tocInner: {
    position: 'sticky',
    top: 32,
    padding: '32px 16px 32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  tocTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
  },
  tocBtn: {
    background: 'none',
    border: 'none',
    textAlign: 'left',
    padding: '6px 10px',
    borderRadius: 'var(--r-sm)',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-2)',
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    transition: 'background .1s, color .1s',
  },
  content: {
    flex: 1,
    padding: '24px 16px 0',
    maxWidth: 700,
    minWidth: 0,
  },
  header: {
    marginBottom: 24,
  },
  h1: {
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--ink-900)',
    letterSpacing: '-0.02em',
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    color: 'var(--text-2)',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)',
    background: '#fff',
    color: 'var(--ink-900)',
    fontSize: 14,
    fontFamily: 'var(--f-sans)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  inputDisabled: {
    background: 'var(--ink-050)',
    color: 'var(--text-3)',
    cursor: 'not-allowed',
  },
  textarea: {
    resize: 'vertical',
    minHeight: 80,
  },
  logoImg: {
    width: 56,
    height: 56,
    borderRadius: 12,
    objectFit: 'cover',
    border: '1px solid var(--border)',
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    background: 'var(--ink-100)',
    display: 'grid',
    placeItems: 'center',
    fontSize: 22,
    border: '1px solid var(--border)',
  },
  resetDesc: {
    fontSize: 13,
    color: 'var(--text-2)',
    marginBottom: 12,
    lineHeight: 1.6,
  },
  saveBar: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '10px 12px 10px 20px',
    borderRadius: 999,
    background: 'var(--ink-900)',
    boxShadow: '0 8px 32px rgba(14,18,32,.35)',
    zIndex: 100,
    whiteSpace: 'nowrap',
  },
  saveBarMsg: {
    fontSize: 13,
    fontWeight: 600,
    color: 'rgba(255,255,255,.75)',
  },
  revertBtn: {
    height: 34,
    padding: '0 14px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,.2)',
    background: 'transparent',
    color: 'rgba(255,255,255,.7)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
  },
  saveBtn: {
    height: 34,
    padding: '0 18px',
    borderRadius: 999,
    border: 'none',
    background: 'var(--neon)',
    color: 'var(--neon-ink)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
  },
};

const sect: Record<string, React.CSSProperties> = {
  wrap: {
    background: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-2)',
    padding: '14px 20px 12px',
    borderBottom: '1px solid var(--border)',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
  },
};

const row: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr',
    alignItems: 'center',
    gap: 16,
    padding: '14px 20px',
    borderBottom: '1px solid var(--ink-050)',
  },
  labelCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink-800)',
  },
  hint: {
    fontSize: 11,
    color: 'var(--text-3)',
    lineHeight: 1.4,
  },
  field: {},
};
