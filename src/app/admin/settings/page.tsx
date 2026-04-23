'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { adminApi } from '@/lib/admin-api';
import { uploadImage, getAssetPublicUrl } from '@/lib/storage';
import { BANK_OPTIONS, normalizeBankName } from '@/lib/banks';
import type { StoreSettings } from '@/lib/database.types';

const TOC_ITEMS = [
  { id: 'store', num: '01', label: '주점 정보' },
  { id: 'payment', num: '02', label: '결제 정보' },
  { id: 'operation', num: '03', label: '영업 설정' },
  { id: 'account', num: '04', label: '관리자 계정' },
  { id: 'reset', num: '05', label: '데이터 초기화' },
];

const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  store_name: '',
  store_description: null,
  notice: null,
  welcome_text: null,
  welcome_highlight: null,
  bank_name: '',
  account_number: '',
  account_holder: '',
  toss_qr_url: null,
  transfer_guide: null,
  is_open: false,
  is_paused: false,
  closed_message: null,
  auto_lock_kds: false,
  serving_mode: 'pickup',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [original, setOriginal] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('store');

  // PIN fields

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState<{ type: string; message: string; onConfirm: () => Promise<void> } | null>(null);

  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sectionsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const logoInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(original);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('store_settings')
        .select('*')
        .single() as { data: StoreSettings | null };
      if (data) {
        setSettings(data);
        setOriginal(data);
      }
    } catch (err) {
      console.error('Settings fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // Try to load existing logo from the predictable storage path
  useEffect(() => {
    const url = getAssetPublicUrl('store-assets', 'logo/logo', 'png');
    // Probe whether the image actually exists by attempting to load it
    const img = new Image();
    img.onload = () => setLogoUrl(url);
    img.onerror = () => {
      // Also try jpg
      const jpgUrl = getAssetPublicUrl('store-assets', 'logo/logo', 'jpg');
      const img2 = new Image();
      img2.onload = () => setLogoUrl(jpgUrl);
      img2.onerror = () => setLogoUrl(null);
      img2.src = jpgUrl;
    };
    img.src = url;
  }, []);

  // Scroll spy
  useEffect(() => {
    const handleScroll = () => {
      const mainEl = document.querySelector('main');
      if (!mainEl) return;
      const scrollTop = mainEl.scrollTop + 120;
      for (const item of TOC_ITEMS) {
        const el = sectionsRef.current[item.id];
        if (el && el.offsetTop <= scrollTop) {
          setActiveSection(item.id);
        }
      }
    };
    const mainEl = document.querySelector('main');
    mainEl?.addEventListener('scroll', handleScroll);
    return () => mainEl?.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    sectionsRef.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const update = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id: _id, ...rest } = settings;
      void _id;
      const { error } = await adminApi('/api/admin/settings', {
        method: 'PATCH',
        body: rest,
      });
      if (error) {
        console.error('Save error:', error);
        setSaving(false);
        return;
      }
      setSettings(settings);
      setOriginal(settings);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSettings(original);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setUploadError(null);
    const result = await uploadImage('store-assets', file, 'logo/logo', { uniqueName: false });
    if (result.error) {
      setUploadError(result.error);
    } else if (result.url) {
      // Append cache-buster so the browser shows the new image immediately
      setLogoUrl(result.url + '?t=' + Date.now());
    }
    setLogoUploading(false);
    e.target.value = '';
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrUploading(true);
    setUploadError(null);
    const result = await uploadImage('store-assets', file, 'qr/qr', { uniqueName: false });
    if (result.error) {
      setUploadError(result.error);
    } else if (result.url) {
      update('toss_qr_url', result.url + '?t=' + Date.now());
    }
    setQrUploading(false);
    e.target.value = '';
  };

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const broadcastReset = async () => {
    try {
      const ch = supabase.channel('data-reset');
      await new Promise<void>((resolve) => {
        ch.subscribe((status) => { if (status === 'SUBSCRIBED') resolve(); });
        setTimeout(() => resolve(), 2000);
      });
      await ch.send({ type: 'broadcast', event: 'reset', payload: {} });
      supabase.removeChannel(ch);
    } catch (e) { console.error('broadcast error:', e); }
  };

  const resetPayments = async () => {
    await adminApi('/api/admin/reset', { method: 'POST', body: { type: 'payments' } });
    await broadcastReset();
  };

  const resetTableStatus = async () => {
    await adminApi('/api/admin/reset', { method: 'POST', body: { type: 'tables' } });
    await broadcastReset();
  };

  const resetAll = async () => {
    await adminApi('/api/admin/reset', { method: 'POST', body: { type: 'all' } });
    await broadcastReset();
  };

  if (loading) {
    return (
      <div style={s.page}>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-400)' }}>불러오는 중...</div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>설정</h1>
        <p style={s.sub}>주점 운영에 필요한 기본 정보를 관리합니다</p>
      </div>

      <div style={s.layout}>
        {/* Left TOC */}
        <nav style={s.toc}>
          {TOC_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              style={{
                ...s.tocItem,
                ...(activeSection === item.id ? s.tocItemActive : {}),
              }}
            >
              <span style={{
                ...s.tocNum,
                ...(activeSection === item.id ? { color: 'var(--ink-900)' } : {}),
              }}>
                {item.num}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right content */}
        <div style={s.content}>
          {/* Section 1: Store Info */}
          <div ref={(el) => { sectionsRef.current['store'] = el; }} style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionNum}>01</span>
              <h2 style={s.sectionTitle}>주점 기본 정보</h2>
            </div>
            <div style={s.card}>
              <div style={s.field}>
                <label style={s.label}>주점 이름</label>
                <div style={s.inputWrap}>
                  <input
                    style={s.input}
                    value={settings.store_name}
                    onChange={(e) => update('store_name', e.target.value)}
                    maxLength={30}
                    placeholder="예: 컴공 주점"
                  />
                  <span style={s.charCount}>{settings.store_name.length}/30</span>
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>주점 설명</label>
                <div style={s.inputWrap}>
                  <input
                    style={s.input}
                    value={settings.store_description ?? ''}
                    onChange={(e) => update('store_description', e.target.value || null)}
                    maxLength={80}
                    placeholder="한 줄 소개를 입력하세요"
                  />
                  <span style={s.charCount}>{(settings.store_description ?? '').length}/80</span>
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>로고 이미지</label>
                <input
                  type="file"
                  accept="image/*"
                  ref={logoInputRef}
                  onChange={handleLogoUpload}
                  style={{ display: 'none' }}
                />
                <div style={s.uploadArea} onClick={() => logoInputRef.current?.click()}>
                  {logoUploading ? (
                    <div style={{ fontSize: 13, color: 'var(--ink-400)' }}>업로드 중...</div>
                  ) : logoUrl ? (
                    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8 }}>
                      <img src={logoUrl} alt="로고" style={{ maxWidth: 120, maxHeight: 60, objectFit: 'contain', borderRadius: 'var(--r-sm)' }} />
                      <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>클릭하여 변경</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>+</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>클릭하여 업로드</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-300)' }}>PNG, JPG (최대 5MB)</div>
                    </>
                  )}
                </div>
                {uploadError && (
                  <div style={{
                    marginTop: 8,
                    padding: '10px 14px',
                    borderRadius: 'var(--r-sm)',
                    background: 'color-mix(in oklab, var(--crim) 8%, white)',
                    border: '1px solid color-mix(in oklab, var(--crim) 20%, white)',
                    fontSize: 12,
                    color: 'var(--crim)',
                    fontWeight: 500,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span>{uploadError}</span>
                    <button
                      onClick={() => setUploadError(null)}
                      style={{
                        border: 0,
                        background: 'transparent',
                        color: 'var(--crim)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 0,
                        flexShrink: 0,
                      }}
                    >
                      &times;
                    </button>
                  </div>
                )}
              </div>
              <div style={s.field}>
                <label style={s.label}>
                  환영 메시지
                  <span style={{ fontWeight: 400, color: 'var(--ink-300)', marginLeft: 6 }}>손님 첫 화면에 표시</span>
                </label>
                <input
                  style={s.input}
                  value={settings.welcome_text ?? ''}
                  onChange={(e) => update('welcome_text', e.target.value || null)}
                  maxLength={60}
                  placeholder="어서 오세요, 즐거운 한 잔 되세요."
                />
                <div style={{ fontSize: 11, color: 'var(--ink-300)', marginTop: 4 }}>
                  예: &quot;어서 오세요, 즐거운 한 잔 되세요.&quot;
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>
                  강조 텍스트
                  <span style={{ fontWeight: 400, color: 'var(--ink-300)', marginLeft: 6 }}>노란색으로 강조할 부분</span>
                </label>
                <input
                  style={s.input}
                  value={settings.welcome_highlight ?? ''}
                  onChange={(e) => update('welcome_highlight', e.target.value || null)}
                  maxLength={20}
                  placeholder="즐거운 한 잔"
                />
                {/* 미리보기 */}
                {(settings.welcome_text ?? '어서 오세요, 즐거운 한 잔 되세요.') && (
                  <div style={{
                    marginTop: 10, padding: '16px 20px', borderRadius: 'var(--r-md)',
                    background: 'var(--ink-900)', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-400)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em' }}>미리보기</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.4 }}>
                      {(() => {
                        const text = settings.welcome_text || '어서 오세요, 즐거운 한 잔 되세요.';
                        const hl = settings.welcome_highlight || '';
                        if (!hl || !text.includes(hl)) return text;
                        const parts = text.split(hl);
                        return (
                          <>
                            {parts[0]}
                            <span style={{ background: 'linear-gradient(transparent 60%, var(--neon) 60%)', color: 'var(--neon-ink)', padding: '0 2px' }}>
                              {hl}
                            </span>
                            {parts.slice(1).join(hl)}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Payment Info */}
          <div ref={(el) => { sectionsRef.current['payment'] = el; }} style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionNum}>02</span>
              <h2 style={s.sectionTitle}>결제 정보</h2>
            </div>
            <div style={s.card}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
                <div style={s.field}>
                  <label style={s.label}>은행</label>
                  {(() => {
                    const normalized = normalizeBankName(settings.bank_name);
                    const inList = BANK_OPTIONS.some((b) => b.code === normalized);
                    return (
                      <select
                        style={{ ...s.input, appearance: 'auto' as const, paddingRight: 30 }}
                        value={inList ? normalized : ''}
                        onChange={(e) => update('bank_name', e.target.value)}
                      >
                        <option value="" disabled>은행 선택</option>
                        {BANK_OPTIONS.map((b) => (
                          <option key={b.code} value={b.code}>{b.label}</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
                <div style={s.field}>
                  <label style={s.label}>계좌번호</label>
                  <input
                    style={s.input}
                    value={settings.account_number}
                    onChange={(e) => update('account_number', e.target.value)}
                    placeholder="3333-12-3456789"
                  />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>예금주</label>
                <input
                  style={s.input}
                  value={settings.account_holder}
                  onChange={(e) => update('account_holder', e.target.value)}
                  placeholder="김학생회장"
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>QR 코드 이미지</label>
                <input
                  type="file"
                  accept="image/*"
                  ref={qrInputRef}
                  onChange={handleQrUpload}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ ...s.uploadArea, width: 120, height: 120 }} onClick={() => qrInputRef.current?.click()}>
                    {qrUploading ? (
                      <div style={{ fontSize: 12, color: 'var(--ink-400)' }}>업로드 중...</div>
                    ) : settings.toss_qr_url ? (
                      <img src={settings.toss_qr_url} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'var(--r-sm)' }} />
                    ) : (
                      <>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>+</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>QR 업로드</div>
                      </>
                    )}
                  </div>
                  {settings.toss_qr_url && (
                    <div style={{ fontSize: 11, color: 'var(--ink-400)', alignSelf: 'center' }}>
                      클릭하여 변경
                    </div>
                  )}
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>입금 안내 문구</label>
                <textarea
                  style={s.textarea}
                  value={settings.transfer_guide ?? ''}
                  onChange={(e) => update('transfer_guide', e.target.value || null)}
                  rows={3}
                  placeholder="송금 시 주문번호를 메모에 적어주세요"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Operation */}
          <div ref={(el) => { sectionsRef.current['operation'] = el; }} style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionNum}>03</span>
              <h2 style={s.sectionTitle}>영업 설정</h2>
            </div>
            <div style={s.card}>
              {/* Open/Close toggle */}
              <div style={s.toggleRow}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>영업 상태</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>
                    {settings.is_open ? '현재 영업 중입니다' : '현재 영업이 종료되었습니다'}
                  </div>
                </div>
                <button
                  onClick={() => update('is_open', !settings.is_open)}
                  style={{
                    ...s.bigToggle,
                    background: settings.is_open ? 'var(--mint)' : 'var(--ink-800)',
                  }}
                >
                  <span style={{
                    ...s.bigToggleKnob,
                    transform: settings.is_open ? 'translateX(32px)' : 'translateX(0)',
                  }} />
                  <span style={{
                    position: 'absolute',
                    left: settings.is_open ? 12 : 'auto',
                    right: settings.is_open ? 'auto' : 12,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                  }}>
                    {settings.is_open ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              <div style={s.field}>
                <label style={s.label}>영업 종료 메시지</label>
                <input
                  style={s.input}
                  value={settings.closed_message ?? ''}
                  onChange={(e) => update('closed_message', e.target.value || null)}
                  placeholder="오늘 영업은 종료되었습니다. 내일 봐요!"
                />
              </div>

              {/* Pause switch */}
              <div style={{
                ...s.toggleRow,
                background: settings.is_paused ? 'color-mix(in oklab, var(--crim) 6%, white)' : 'transparent',
                border: settings.is_paused ? '1px solid color-mix(in oklab, var(--crim) 20%, white)' : '1px solid transparent',
                borderRadius: 'var(--r-md)',
                padding: '14px 16px',
                marginTop: 8,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: settings.is_paused ? 'var(--crim)' : 'var(--text)' }}>
                    주문 일시정지
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>
                    켜면 신규 주문이 차단됩니다
                  </div>
                </div>
                <button
                  onClick={() => update('is_paused', !settings.is_paused)}
                  style={{
                    ...s.smallToggle,
                    background: settings.is_paused ? 'var(--crim)' : 'var(--ink-300)',
                  }}
                >
                  <span style={{
                    ...s.smallToggleKnob,
                    transform: settings.is_paused ? 'translateX(18px)' : 'translateX(0)',
                  }} />
                </button>
              </div>

              {/* Serving mode */}
              <div style={s.field}>
                <label style={s.label}>
                  조리 완료 시 수령 방식
                  <span style={{ fontWeight: 400, color: 'var(--ink-300)', marginLeft: 6 }}>고객 알림 / 주방 버튼 라벨 반영</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => update('serving_mode', 'pickup')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--r-md)',
                      border: settings.serving_mode === 'pickup' ? '2px solid var(--ink-900)' : '1px solid var(--border)',
                      background: settings.serving_mode === 'pickup' ? 'var(--ink-900)' : 'var(--white)',
                      color: settings.serving_mode === 'pickup' ? '#fff' : 'var(--ink-600)',
                      cursor: 'pointer',
                      fontFamily: 'var(--f-sans)',
                      textAlign: 'left',
                      transition: 'all .12s ease',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                      🏃 픽업 수령
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>
                      고객이 픽업대에서 직접 가져갑니다
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => update('serving_mode', 'table')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--r-md)',
                      border: settings.serving_mode === 'table' ? '2px solid var(--ink-900)' : '1px solid var(--border)',
                      background: settings.serving_mode === 'table' ? 'var(--ink-900)' : 'var(--white)',
                      color: settings.serving_mode === 'table' ? '#fff' : 'var(--ink-600)',
                      cursor: 'pointer',
                      fontFamily: 'var(--f-sans)',
                      textAlign: 'left',
                      transition: 'all .12s ease',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                      🍽️ 테이블 서빙
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>
                      직원이 테이블로 가져다드립니다
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Account */}
          <div ref={(el) => { sectionsRef.current['account'] = el; }} style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionNum}>04</span>
              <h2 style={s.sectionTitle}>관리자 계정</h2>
            </div>
            <div style={s.card}>
              {/* 관리자 계정 안내 — Phase 2a 이후 Supabase Auth로 전환됨 */}
              <div style={s.pinHint}>
                <span style={{ fontWeight: 600 }}>계정 관리</span>
                <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                  비밀번호 변경은 Supabase Auth 기본 플로우(이메일 링크)를 사용합니다.
                  Phase 2c에서 이 화면에 비밀번호 변경 UI가 추가될 예정입니다.
                </span>
              </div>

              {/* KDS auto-lock */}
              <div style={{ ...s.toggleRow, marginTop: 20 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>KDS 자동 잠금</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>
                    일정 시간 미조작 시 KDS 화면을 잠급니다
                  </div>
                </div>
                <button
                  onClick={() => update('auto_lock_kds', !settings.auto_lock_kds)}
                  style={{
                    ...s.smallToggle,
                    background: settings.auto_lock_kds ? 'var(--mint)' : 'var(--ink-300)',
                  }}
                >
                  <span style={{
                    ...s.smallToggleKnob,
                    transform: settings.auto_lock_kds ? 'translateX(18px)' : 'translateX(0)',
                  }} />
                </button>
              </div>

              {/* Logout */}
              <div style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--ink-100)' }}>
                <button className="btn btn-ghost btn-sm">이 기기에서 로그아웃</button>
                <button className="btn btn-sm" style={{ background: 'var(--crim)', color: '#fff', border: 0 }}>
                  모든 기기에서 로그아웃
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Reset */}
          <div ref={(el) => { sectionsRef.current['reset'] = el; }} style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionNum}>05</span>
              <div>
                <h2 style={s.sectionTitle}>데이터 초기화</h2>
                <p style={{ fontSize: 12, color: 'var(--ink-400)', margin: '2px 0 0' }}>운영 데이터를 초기화합니다. 메뉴는 유지됩니다.</p>
              </div>
            </div>
            <div style={s.card}>
              {/* Reset payments */}
              <div style={s.resetRow}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>결제 내역 초기화</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>모든 주문, 결제, 주문 항목을 삭제합니다</div>
                </div>
                <button
                  onClick={() => setResetConfirm({
                    type: '결제 내역 초기화',
                    message: '모든 주문, 결제, 주문 항목 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
                    onConfirm: async () => { await resetPayments(); showToast('초기화 완료'); },
                  })}
                  style={s.dangerBtn}
                >
                  초기화
                </button>
              </div>

              <div style={{ height: 1, background: 'var(--ink-100)' }} />

              {/* Reset table status */}
              <div style={s.resetRow}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>테이블 상태 초기화</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>모든 테이블의 상태를 빈 테이블로 초기화합니다</div>
                </div>
                <button
                  onClick={() => setResetConfirm({
                    type: '테이블 상태 초기화',
                    message: '모든 테이블의 상태가 빈 테이블로 초기화됩니다. 이 작업은 되돌릴 수 없습니다.',
                    onConfirm: async () => { await resetTableStatus(); showToast('초기화 완료'); },
                  })}
                  style={s.dangerBtn}
                >
                  초기화
                </button>
              </div>

              <div style={{ height: 1, background: 'var(--ink-100)' }} />

              {/* Reset all */}
              <div style={s.resetRow}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>전체 초기화</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>결제 내역 삭제 + 테이블 상태 초기화를 한 번에 수행합니다</div>
                </div>
                <button
                  onClick={() => setResetConfirm({
                    type: '전체 초기화',
                    message: '모든 주문, 결제, 주문 항목이 삭제되고 테이블 상태가 초기화됩니다. 이 작업은 되돌릴 수 없습니다.',
                    onConfirm: async () => { await resetAll(); showToast('초기화 완료'); },
                  })}
                  style={s.dangerBtn}
                >
                  초기화
                </button>
              </div>
            </div>
          </div>

          {/* Spacer for save bar */}
          <div style={{ height: 80 }} />
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div style={{
        ...s.saveBar,
        ...(isDirty ? { borderTop: '2px solid var(--neon)', background: 'var(--white)' } : {}),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          {isDirty && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)' }}>
              저장되지 않은 변경사항이 있습니다
            </span>
          )}
          {saved && (
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--mint)', animation: 'fadeIn .2s ease' }}>
              &#10003; 저장되었습니다
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCancel} className="btn btn-ghost btn-sm" disabled={!isDirty}>
            취소
          </button>
          <button
            onClick={handleSave}
            className="btn btn-sm"
            style={{ background: 'var(--ink-900)', color: '#fff', border: 0, opacity: isDirty ? 1 : 0.4 }}
            disabled={!isDirty || saving}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Reset Confirm Modal */}
      {resetConfirm && (
        <div style={s.overlay} onClick={() => setResetConfirm(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{resetConfirm.type}</h3>
            <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.6 }}>{resetConfirm.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setResetConfirm(null)}
                className="btn btn-ghost btn-sm"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  await resetConfirm.onConfirm();
                  setResetConfirm(null);
                }}
                className="btn btn-sm"
                style={{ background: 'var(--crim)', color: '#fff', border: 0 }}
              >
                초기화 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={s.toast}>{toast}</div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '24px 28px 0',
    maxWidth: 1060,
    position: 'relative',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
    lineHeight: 1.3,
  },
  sub: {
    fontSize: 13,
    color: 'var(--ink-400)',
    margin: '2px 0 0',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '200px 1fr',
    gap: 28,
    alignItems: 'start',
  },
  toc: {
    position: 'sticky',
    top: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  tocItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 'var(--r-sm)',
    border: 0,
    background: 'transparent',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--ink-400)',
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    textAlign: 'left',
    transition: 'all .12s ease',
  },
  tocItemActive: {
    background: 'var(--white)',
    color: 'var(--ink-900)',
    fontWeight: 700,
    boxShadow: 'var(--shadow-1)',
  },
  tocNum: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--ink-300)',
    fontVariantNumeric: 'tabular-nums',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },
  section: {},
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionNum: {
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--ink-300)',
    fontVariantNumeric: 'tabular-nums',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 700,
    margin: 0,
  },
  card: {
    background: 'var(--white)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ink-500)',
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    width: '100%',
    height: 40,
    padding: '0 14px',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--border)',
    fontSize: 14,
    fontFamily: 'var(--f-sans)',
    outline: 'none',
    background: 'var(--white)',
    transition: 'border-color .12s ease',
    boxSizing: 'border-box' as const,
  },
  charCount: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 11,
    color: 'var(--ink-300)',
    fontVariantNumeric: 'tabular-nums',
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--border)',
    fontSize: 14,
    fontFamily: 'var(--f-sans)',
    outline: 'none',
    resize: 'vertical' as const,
    background: 'var(--white)',
    lineHeight: 1.5,
    boxSizing: 'border-box' as const,
  },
  uploadArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px dashed var(--ink-200)',
    borderRadius: 'var(--r-md)',
    padding: '20px',
    cursor: 'pointer',
    transition: 'border-color .12s ease',
    background: 'var(--ink-050)',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  bigToggle: {
    position: 'relative',
    width: 68,
    height: 36,
    borderRadius: 'var(--r-pill)',
    border: 0,
    cursor: 'pointer',
    transition: 'background .2s ease',
    flexShrink: 0,
  },
  bigToggleKnob: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,.15)',
    transition: 'transform .2s ease',
  },
  smallToggle: {
    position: 'relative',
    width: 42,
    height: 24,
    borderRadius: 'var(--r-pill)',
    border: 0,
    cursor: 'pointer',
    transition: 'background .2s ease',
    flexShrink: 0,
  },
  smallToggleKnob: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 2px rgba(0,0,0,.12)',
    transition: 'transform .2s ease',
  },
  pinHint: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '12px 16px',
    borderRadius: 'var(--r-sm)',
    background: 'var(--ink-050)',
    border: '1px solid var(--ink-100)',
    fontSize: 13,
  },
  saveBar: {
    position: 'sticky',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 22px',
    background: 'var(--ink-050)',
    borderTop: '2px solid var(--border)',
    zIndex: 10,
    transition: 'all .15s ease',
  },
  resetRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  dangerBtn: {
    padding: '8px 18px',
    borderRadius: 'var(--r-sm)',
    border: 0,
    background: 'var(--crim)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--f-sans)',
    flexShrink: 0,
    transition: 'opacity .12s ease',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--white)',
    borderRadius: 'var(--r-lg)',
    padding: '24px 28px',
    maxWidth: 420,
    width: '90%',
    boxShadow: 'var(--shadow-3)',
  },
  toast: {
    position: 'fixed',
    bottom: 32,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--ink-900)',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: 'var(--r-md)',
    fontSize: 14,
    fontWeight: 600,
    boxShadow: 'var(--shadow-3)',
    animation: 'toastIn .2s ease',
    zIndex: 200,
  },
};
