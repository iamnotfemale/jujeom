import type { Metadata, Viewport } from "next";
import "./globals.css";
import DynamicTitle from "@/components/DynamicTitle";

export const metadata: Metadata = {
  title: "컴공 주점",
  description: "컴퓨터공학과 축제 주점 주문 시스템",
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0E1220",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body><DynamicTitle />{children}</body>
    </html>
  );
}
