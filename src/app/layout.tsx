import type { Metadata, Viewport } from 'next';
import './globals.css';
import DynamicTitle from '@/components/DynamicTitle';
import { ToastProvider } from '@/components/ToastProvider';
import { ConfirmProvider } from '@/components/ConfirmProvider';

export const metadata: Metadata = {
  title: { default: '주점', template: '%s | 주점' },
  description: '축제 주점 주문 시스템',
  icons: { icon: '/favicon.ico' },
  openGraph: { title: '주점', description: '축제 주점 주문 시스템', type: 'website' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0E1220',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <DynamicTitle />
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
