'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';

type ToastType = 'default' | 'success' | 'error' | 'warn';
interface ToastItem { id: number; message: string; type: ToastType; }

const ToastContext = createContext<{
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
}>({ showToast: () => {} });

export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'default', durationMs = 3200) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), durationMs);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        zIndex: 10000,
        pointerEvents: 'none',
        maxWidth: '90vw',
      }}>
        {toasts.map((t) => {
          const style = typeStyles[t.type];
          return (
            <div
              key={t.id}
              style={{
                background: style.bg,
                color: style.color,
                padding: '12px 20px',
                borderRadius: 'var(--r-pill)',
                fontSize: 14,
                fontWeight: 600,
                boxShadow: 'var(--shadow-2)',
                fontFamily: 'var(--f-sans)',
                animation: 'toastIn .2s ease',
                maxWidth: 420,
                lineHeight: 1.5,
              }}
            >
              {style.icon && <span style={{ marginRight: 8 }}>{style.icon}</span>}
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

const typeStyles: Record<ToastType, { bg: string; color: string; icon?: string }> = {
  default: { bg: 'var(--ink-900)', color: '#fff' },
  success: { bg: 'var(--mint)', color: '#fff', icon: '✓' },
  error:   { bg: 'var(--crim)', color: '#fff', icon: '⚠' },
  warn:    { bg: 'var(--amber)', color: '#fff', icon: '!' },
};
