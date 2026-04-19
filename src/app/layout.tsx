import type { Metadata, Viewport } from "next";
import { createClient } from "@supabase/supabase-js";
import "./globals.css";
import DynamicTitle from "@/components/DynamicTitle";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export async function generateMetadata(): Promise<Metadata> {
  let storeName = "주점";
  let storeDesc = "축제 주점 주문 시스템";
  let logoUrl: string | undefined;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from("store_settings")
      .select("store_name, store_description, toss_qr_url")
      .single();
    if (data?.store_name) storeName = data.store_name;
    if (data?.store_description) storeDesc = data.store_description;

    // 로고 이미지 — store-assets 버킷에서 고정 경로 시도
    const { data: logoData } = supabase.storage
      .from("store-assets")
      .getPublicUrl("logo/logo.png");
    if (logoData?.publicUrl) logoUrl = logoData.publicUrl;
  } catch {
    // fallback to defaults
  }

  const images = logoUrl ? [{ url: logoUrl, width: 512, height: 512, alt: storeName }] : [];

  return {
    title: {
      default: storeName,
      template: `%s | ${storeName}`,
    },
    description: storeDesc,
    icons: { icon: "/favicon.ico" },
    openGraph: {
      title: storeName,
      description: storeDesc,
      type: "website",
      siteName: storeName,
      images,
    },
    twitter: {
      card: logoUrl ? "summary_large_image" : "summary",
      title: storeName,
      description: storeDesc,
      images: logoUrl ? [logoUrl] : [],
    },
  };
}

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
      <body>
        <DynamicTitle />
        {children}
      </body>
    </html>
  );
}
