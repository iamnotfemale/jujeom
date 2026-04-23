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
    <div style={{ padding: '32px 40px', maxWidth: 780, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>설정</h1>

      <Section title="01 · 가게 정보">
        <Row label="가게 이름">
          <input value={form.name} onChange={(e) => update('name', e.target.value)} style={s.input} />
        </Row>
        <Row label="slug (URL)">
          <input value={store.slug} disabled style={{ ...s.input, opacity: 0.6 }} />
        </Row>
      </Section>

      <Section title="02 · 결제 정보">
        <Row label="은행">
          <select value={form.bank_name} onChange={(e) => update('bank_name', e.target.value)} style={s.input}>
            <option value="">선택</option>
            {BANK_OPTIONS.map((b) => (
              <option key={b.code} value={b.code}>{b.label}</option>
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

      <Section title="03 · 영업 설정">
        <Row label="영업 중">
          <Toggle checked={form.is_open} onChange={(v) => update('is_open', v)} />
        </Row>
        <Row label="주문 일시 중지">
          <Toggle checked={form.is_paused} onChange={(v) => update('is_paused', v)} />
        </Row>
        <Row label="서빙 방식">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['pickup', 'table'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => update('serving_mode', m)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #2a3150)',
                  background: form.serving_mode === m ? 'var(--accent, #3B82F6)' : 'transparent',
                  color: form.serving_mode === m ? '#fff' : 'var(--text-2)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {m === 'pickup' ? '픽업' : '테이블 서빙'}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title="04 · 데이터 초기화">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => resetData('payments')} style={s.btnGhost}>
            결제·주문 초기화
          </button>
          <button type="button" onClick={() => resetData('tables')} style={s.btnGhost}>
            테이블 초기화
          </button>
          <button type="button" onClick={() => resetData('all')} style={s.btnDanger}>
            전체 초기화
          </button>
        </div>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 32 }}>
        <button type="button" onClick={handleSave} disabled={saving} style={s.btnPrimary}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        marginBottom: 28,
        padding: 20,
        background: 'var(--bg-2, #fff)',
        borderRadius: 12,
        border: '1px solid var(--border, #e5e7eb)',
      }}
    >
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)', marginBottom: 14 }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{label}</span>
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
        width: 42,
        height: 24,
        borderRadius: 999,
        border: 'none',
        background: checked ? 'var(--accent, #3B82F6)' : '#c9ccd6',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background .15s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 20 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          transition: 'left .15s',
        }}
      />
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  input: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border, #d1d5db)',
    fontSize: 14,
    width: '100%',
  },
  btnPrimary: {
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent, #3B82F6)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnGhost: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--border, #d1d5db)',
    background: 'transparent',
    fontSize: 13,
    cursor: 'pointer',
  },
  btnDanger: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--crim, #dc2626)',
    background: 'var(--crim, #dc2626)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
