'use client';

import { useState, useRef } from 'react';
import { adminApi } from '@/lib/admin-api';
import { useConfirm } from '@/components/ConfirmProvider';
import { useToast } from '@/components/ToastProvider';
import { BANK_OPTIONS } from '@/lib/banks';
import { useStore } from '../../StoreProvider';

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

export default function SettingsPage() {
  const store = useStore();
  const { showToast } = useToast();
  const { confirm: showConfirm } = useConfirm();

  const initial: Editable = {
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
  };
  const [form, setForm] = useState<Editable>(initial);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
    update('logo_url', json.logo_url ?? '');
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
    showToast('로고가 삭제됐습니다', 'success');
  };

  const handleSave = async () => {
    setSaving(true);
    // logo_url은 별도 API로만 처리 — PATCH body에서 제외
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
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => {
      window.location.reload();
    }, 600);
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

  return (
    <div className="min-h-full bg-[var(--bg)] px-8 pt-8 pb-20">
      <div className="max-w-[780px] mx-auto">
        <header className="mb-7">
          <h1 className="text-[26px] font-extrabold text-[var(--ink-900)] tracking-[-0.02em] mb-[6px]">설정</h1>
          <p className="text-sm text-[var(--text-2)]">이 가게의 기본 정보와 영업 상태를 관리합니다.</p>
        </header>

        <Section num="01" title="가게 정보">
          <Row label="가게 이름">
            <input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full px-3 py-[10px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-900)] text-sm font-[var(--f-sans)] outline-none"
            />
          </Row>
          <Row label="slug (URL)">
            <input
              value={store.slug}
              disabled
              className="w-full px-3 py-[10px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--ink-050)] text-[var(--text-3)] text-sm font-[var(--f-sans)] outline-none cursor-not-allowed"
            />
          </Row>
          <Row label="계좌주명">
            <input
              value={form.account_holder}
              onChange={(e) => update('account_holder', e.target.value)}
              placeholder="예금주 이름 (없으면 가게 이름으로 표시)"
              className="w-full px-3 py-[10px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-900)] text-sm font-[var(--f-sans)] outline-none"
            />
          </Row>
          <Row label="로고">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt="로고"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    objectFit: 'cover',
                    border: '1px solid var(--border)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: 'var(--ink-100)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 22,
                    border: '1px solid var(--border)',
                  }}
                >
                  酒
                </div>
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
          </Row>
        </Section>

        <Section num="02" title="가게 소개">
          <Row label="환영 문구">
            <input
              value={form.welcome_text}
              onChange={(e) => update('welcome_text', e.target.value)}
              placeholder="예: 어서 오세요, 즐거운 한 잔 되세요."
              className="w-full px-3 py-[10px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-900)] text-sm font-[var(--f-sans)] outline-none"
            />
          </Row>
          <Row label="강조 텍스트">
            <input
              value={form.welcome_highlight}
              onChange={(e) => update('welcome_highlight', e.target.value)}
              placeholder="예: 오늘도 맛있게!"
              className="w-full px-3 py-[10px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-900)] text-sm font-[var(--f-sans)] outline-none"
            />
          </Row>
          <Row label="공지사항">
            <textarea
              value={form.notice}
              onChange={(e) => update('notice', e.target.value)}
              rows={3}
              className="w-full px-3 py-[10px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-900)] text-sm font-[var(--f-sans)] outline-none resize-none"
            />
          </Row>
          <Row label="영업 종료 메시지">
            <input
              value={form.closed_message}
              onChange={(e) => update('closed_message', e.target.value)}
              placeholder="예: 오늘 영업은 종료되었습니다."
              className="w-full px-3 py-[10px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-900)] text-sm font-[var(--f-sans)] outline-none"
            />
          </Row>
        </Section>

        <Section num="03" title="결제 정보">
          <Row label="은행">
            <select
              value={form.bank_name}
              onChange={(e) => update('bank_name', e.target.value)}
              className="w-full px-3 py-[10px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-900)] text-sm font-[var(--f-sans)] outline-none"
            >
              <option value="">선택하세요</option>
              {BANK_OPTIONS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="계좌번호">
            <input
              value={form.account_number}
              onChange={(e) => update('account_number', e.target.value)}
              placeholder="예: 123-456-789012"
              className="w-full px-3 py-[10px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-900)] text-sm font-[var(--f-sans)] outline-none"
            />
          </Row>
          <Row label="토스 QR 링크 (선택)">
            <input
              value={form.toss_qr_url}
              onChange={(e) => update('toss_qr_url', e.target.value)}
              placeholder="https://toss.me/..."
              className="w-full px-3 py-[10px] rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-900)] text-sm font-[var(--f-sans)] outline-none"
            />
          </Row>
        </Section>

        <Section num="04" title="영업 설정">
          <Row label="영업 중">
            <Toggle checked={form.is_open} onChange={(v) => update('is_open', v)} />
          </Row>
          <Row label="주문 일시 중지">
            <Toggle checked={form.is_paused} onChange={(v) => update('is_paused', v)} />
          </Row>
          <Row label="서빙 방식">
            <div className="flex gap-2">
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
          </Row>
        </Section>

        <Section num="05" title="KDS 설정">
          <Row label="자동 잠금">
            <Toggle checked={form.auto_lock_kds} onChange={(v) => update('auto_lock_kds', v)} />
          </Row>
        </Section>

        <Section num="06" title="데이터 초기화">
          <p className="text-[13px] text-[var(--text-2)] mb-3 leading-relaxed">
            축제 전 연습·테스트 데이터를 지울 때 사용하세요. <strong className="text-[var(--crim)]">되돌릴 수 없습니다.</strong>
          </p>
          <div className="flex gap-2 flex-wrap">
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
        </Section>

        <div className="flex justify-end mt-7 pt-5 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-accent min-w-[140px]"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-6 mb-5 shadow-[var(--shadow-1)]">
      <header className="flex items-center gap-[10px] mb-[18px]">
        <span className="text-xs font-bold text-[var(--text-3)] [font-variant-numeric:tabular-nums] px-2 py-[3px] bg-[var(--ink-050)] rounded-[var(--r-sm)]">
          {num}
        </span>
        <h2 className="text-base font-extrabold text-[var(--ink-900)] tracking-[-0.01em]">{title}</h2>
      </header>
      <div className="flex flex-col gap-[14px]">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-4 items-center" style={{ gridTemplateColumns: '160px 1fr' }}>
      <span className="text-[13px] font-semibold text-[var(--text-2)]">{label}</span>
      <div>{children}</div>
    </label>
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
