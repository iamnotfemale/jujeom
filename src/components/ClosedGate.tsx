'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  children: React.ReactNode;
}

export default function ClosedGate({ children }: Props) {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [closedMessage, setClosedMessage] = useState<string>('오늘 영업은 종료되었습니다.');
  const [storeName, setStoreName] = useState<string>('주점');

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('store_settings')
        .select('is_open, closed_message, store_name')
        .limit(1)
        .single();
      if (data) {
        setIsOpen(data.is_open ?? null);
        if (data.closed_message) setClosedMessage(data.closed_message);
        if (data.store_name) setStoreName(data.store_name);
      }
    };
    fetchSettings();

    // Realtime 구독: 영업 상태 변화 즉시 반영
    const channel = supabase
      .channel('store-open-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'store_settings' },
        (payload: { new: { is_open?: boolean; closed_message?: string; store_name?: string } }) => {
          if (typeof payload.new.is_open === 'boolean') setIsOpen(payload.new.is_open);
          if (payload.new.closed_message) setClosedMessage(payload.new.closed_message);
          if (payload.new.store_name) setStoreName(payload.new.store_name);
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // 로딩 중에는 children 그대로 (깜빡임 방지)
  if (isOpen === null) return <>{children}</>;

  // 영업 중 → 그냥 통과
  if (isOpen) return <>{children}</>;

  // 영업 종료 → 화면 전체 차단
  return (
    <>
      {children}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(14, 18, 32, 0.75)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 'var(--r-xl)',
            padding: '40px 32px 32px',
            maxWidth: 360,
            width: '100%',
            boxShadow: 'var(--shadow-3)',
            textAlign: 'center',
            border: '2px solid var(--coral)',
            animation: 'pop .25s ease',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'color-mix(in oklab, var(--coral) 12%, white)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 36,
            }}
          >
            🔒
          </div>
          <div style={{
            fontSize: 20,
            fontWeight: 800,
            color: 'var(--ink-900)',
            marginBottom: 8,
            letterSpacing: '-0.02em',
          }}>
            영업 종료
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-400)', fontWeight: 600, marginBottom: 16 }}>
            {storeName}
          </div>
          <div style={{
            fontSize: 14,
            color: 'var(--ink-600)',
            lineHeight: 1.6,
            background: 'var(--ink-050)',
            padding: '14px 18px',
            borderRadius: 'var(--r-md)',
          }}>
            {closedMessage}
          </div>
        </div>
      </div>
    </>
  );
}
