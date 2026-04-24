'use client';

import { createContext, useContext } from 'react';

export interface StoreInfo {
  id: string;
  slug: string;
  name: string;
  is_open: boolean;
  is_paused: boolean;
  serving_mode: 'pickup' | 'table';
  bank_name: string;
  account_number: string;
  toss_qr_url: string;
  account_holder: string | null;
  closed_message: string | null;
  welcome_text: string | null;
  welcome_highlight: string | null;
  notice: string | null;
  auto_lock_kds: boolean;
  logo_url: string | null;
}

const StoreContext = createContext<StoreInfo | null>(null);

export function useStore(): StoreInfo {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside /s/[slug] subtree');
  return v;
}

export default function StoreProvider({
  store,
  children,
}: {
  store: StoreInfo;
  children: React.ReactNode;
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
