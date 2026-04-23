'use client';

import { useState, useRef } from 'react';
import { adminApi } from '@/lib/admin-api';
import { useConfirm } from '@/components/ConfirmProvider';
import { useToast } from '@/components/ToastProvider';
import { BANK_OPTIONS } from '@/lib/banks';
import { useStore } from '../../StoreProvider';

/**
 * Phase 2bc 임시 버전 — `store_settings` 제거로 필드 폭이 축소됨.
 * closed_message / welcome_text / welcome_highlight / notice / account_holder
 * / auto_lock_kds / logo 업로드 기능은 Phase 2d에서 stores 테이블 컬럼 확장 후 복구 예정.
 */

type Editable = {
  name: string;
  bank_name: string;
  account_number: string;
  toss_qr_url: string;
  is_open: boolean;
  is_paused: boolean;
  serving_mode: 'pickup' | 'table';
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
  };
  const [form, setForm] = useState<Editable>(initial);
  const [saving, setSaving] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const update = <K extends keyof Editable>(k: K, v: Editable[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await adminApi(`/api/stores/${store.slug}`, {
      method: 'PATCH',
      body: form,
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
    <div style={s.wrap}>
      <div style={s.inner}>
        <header style={s.header}>
          <h1 style={s.h1}>설정</h1>
          <p style={s.sub}>이 가게의 기본 정보와 영업 상태를 관리합니다.</p>
        </header>

        <Section num="01" title="가게 정보">
          <Row label="가게 이름">
            <input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              style={s.input}
            />
          </Row>
          <Row label="slug (URL)">
            <input value={store.slug} disabled style={{ ...s.input, ...s.inputDisabled }} />
          </Row>
        </Section>

        <Section num="02" title="결제 정보">
          <Row label="은행">
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
          </Row>
          <Row label="계좌번호">
            <input
              value={form.account_number}
              onChange={(e) => update('account_number', e.target.value)}
              placeholder="예: 123-456-789012"
              style={s.input}
            />
          </Row>
          <Row label="토스 QR 링크 (선택)">
            <input
              value={form.toss_qr_url}
              onChange={(e) => update('toss_qr_url', e.target.value)}
              placeholder="https://toss.me/..."
              style={s.input}
            />
          </Row>
        </Section>

        <Section num="03" title="영업 설정">
          <Row label="영업 중">
            <Toggle checked={form.is_open} onChange={(v) => update('is_open', v)} />
          </Row>
          <Row label="주문 일시 중지">
            <Toggle checked={form.is_paused} onChange={(v) => update('is_paused', v)} />
          </Row>
          <Row label="서빙 방식">
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

        <Section num="04" title="데이터 초기화">
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
            축제 전 연습·테스트 데이터를 지울 때 사용하세요. <strong style={{ color: 'var(--crim)' }}>되돌릴 수 없습니다.</strong>
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
        </Section>

        <div style={s.saveBar}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn btn-accent"
            style={{ minWidth: 140 }}
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
    <section style={sect.wrap}>
      <header style={sect.head}>
        <span style={sect.num}>{num}</span>
        <h2 style={sect.title}>{title}</h2>
      </header>
      <div style={sect.body}>{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={row.wrap}>
      <span style={row.label}>{label}</span>
      <div style={row.field}>{children}</div>
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

const s: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100%', background: 'var(--bg)', padding: '32px 32px 80px' },
  inner: { maxWidth: 780, margin: '0 auto' },
  header: { marginBottom: 28 },
  h1: {
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--ink-900)',
    letterSpacing: '-0.02em',
    marginBottom: 6,
  },
  sub: { fontSize: 14, color: 'var(--text-2)' },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--ink-900)',
    fontSize: 14,
    fontFamily: 'var(--f-sans)',
    outline: 'none',
  },
  inputDisabled: {
    background: 'var(--ink-050)',
    color: 'var(--text-3)',
    cursor: 'not-allowed',
  },
  saveBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 28,
    paddingTop: 20,
    borderTop: '1px solid var(--border)',
  },
};

const sect: Record<string, React.CSSProperties> = {
  wrap: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: 24,
    marginBottom: 20,
    boxShadow: 'var(--shadow-1)',
  },
  head: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 },
  num: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-3)',
    fontVariantNumeric: 'tabular-nums',
    padding: '3px 8px',
    background: 'var(--ink-050)',
    borderRadius: 'var(--r-sm)',
  },
  title: { fontSize: 16, fontWeight: 800, color: 'var(--ink-900)', letterSpacing: '-0.01em' },
  body: { display: 'flex', flexDirection: 'column', gap: 14 },
};

const row: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr',
    alignItems: 'center',
    gap: 16,
  },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--text-2)' },
  field: {},
};
