'use client';
import { createContext, useContext, useState, useCallback } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

const ConfirmContext = createContext<{
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}>({ confirm: async () => false });

export function useConfirm() { return useContext(ConfirmContext); }

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  }, []);

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(14,18,32,.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10001, animation: 'fadeIn .15s ease', padding: 24 }}
          onClick={() => close(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 'var(--r-lg)', padding: '24px 28px',
              maxWidth: 380, width: '100%', boxShadow: 'var(--shadow-3)',
              animation: 'pop .2s ease' }}
            onClick={(e) => e.stopPropagation()}
          >
            {state.title && (
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--ink-900)' }}>
                {state.title}
              </div>
            )}
            <div style={{ fontSize: 14, color: 'var(--ink-700)', marginBottom: 20, lineHeight: 1.55 }}>
              {state.message}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => close(false)}
                style={{ padding: '8px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
                  background: '#fff', color: 'var(--ink-700)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                {state.cancelText ?? '취소'}
              </button>
              <button onClick={() => close(true)}
                style={{ padding: '8px 16px', borderRadius: 'var(--r-md)', border: 0,
                  background: state.danger ? 'var(--crim)' : 'var(--ink-900)',
                  color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                {state.confirmText ?? '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
