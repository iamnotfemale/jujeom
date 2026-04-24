export type StoreRole = 'owner' | 'manager' | 'kitchen';

export interface Store {
  id: string;
  slug: string;
  name: string;
  owner_id: string;
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

/** Alias kept for backwards compatibility */
export type StoreContext = Store;
