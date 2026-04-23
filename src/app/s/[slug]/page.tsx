import { redirect } from 'next/navigation';

export default async function StoreHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // 가게 루트 → 주문 페이지로
  redirect(`/s/${slug}/order`);
}
