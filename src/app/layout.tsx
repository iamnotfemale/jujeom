import type { Metadata, Viewport } from 'next';
import './globals.css';
import DynamicTitle from '@/components/DynamicTitle';
import { ToastProvider } from '@/components/ToastProvider';
import { ConfirmProvider } from '@/components/ConfirmProvider';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://charim.vercel.app'
  ),
  title: { default: '차림', template: '%s | 차림' },
  description: '대학 축제 주점 운영 서비스',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: '차림',
    description: '대학 축제 주점 운영 서비스',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '차림' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '차림',
    description: '대학 축제 주점 운영 서비스',
    images: ['/og.png'],
  },
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
