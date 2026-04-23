import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStoreBySlug } from '@/lib/require-store-role';
import StoreProvider from './StoreProvider';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const name = store?.name ?? '주점';
  return {
    title: { default: name, template: `%s | ${name}` },
    description: `${name} 주문 시스템`,
  };
}

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  return <StoreProvider store={store}>{children}</StoreProvider>;
}
