export type OrderStatus = 'pending' | 'accepted' | 'cooking' | 'ready' | 'served' | 'cancelled';
export type PaymentStatus = 'waiting' | 'confirmed' | 'completed';
export type TableStatus = 'empty' | 'occupied' | 'payment_pending';

export type TableKind = 'table' | 'restroom' | 'kitchen';

export interface Table {
  id: number;
  number: number;
  shape: 'square-2' | 'square-4';
  kind: TableKind;
  width: number;
  height: number;
  capacity: number;
  position_x: number;
  position_y: number;
  status: TableStatus;
  created_at: string;
}

export interface MenuCategory {
  id: number;
  name: string;
  sort_order: number;
}

export interface Menu {
  id: number;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  is_sold_out: boolean;
  stock: number;
  max_stock: number;
  sort_order: number;
  options: string | null;
  tag: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  table_id: number;
  table_number: number;
  status: OrderStatus;
  note: string | null;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  menu_id: number;
  menu_name: string;
  quantity: number;
  unit_price: number;
  options: string | null;
}

export interface Payment {
  id: number;
  order_id: number;
  amount: number;
  status: PaymentStatus;
  method: 'toss' | 'transfer';
  customer_name: string | null;
  customer_phone: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface StoreSettings {
  id: number;
  store_name: string;
  store_description: string | null;
  notice: string | null;
  welcome_text: string | null;
  welcome_highlight: string | null;
  bank_name: string;
  account_number: string;
  account_holder: string;
  toss_qr_url: string | null;
  transfer_guide: string | null;
  is_open: boolean;
  is_paused: boolean;
  closed_message: string | null;
  pin: string;
  auto_lock_kds: boolean;
}

export interface Database {
  public: {
    Tables: {
      tables: { Row: Table; Insert: Omit<Table, 'id' | 'created_at'>; Update: Partial<Omit<Table, 'id' | 'created_at'>>; };
      menus: { Row: Menu; Insert: Omit<Menu, 'id' | 'created_at'>; Update: Partial<Omit<Menu, 'id' | 'created_at'>>; };
      orders: { Row: Order; Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Order, 'id' | 'created_at'>>; };
      order_items: { Row: OrderItem; Insert: Omit<OrderItem, 'id'>; Update: Partial<Omit<OrderItem, 'id'>>; };
      payments: { Row: Payment; Insert: Omit<Payment, 'id' | 'created_at'>; Update: Partial<Omit<Payment, 'id' | 'created_at'>>; };
      store_settings: { Row: StoreSettings; Insert: Omit<StoreSettings, 'id'>; Update: Partial<Omit<StoreSettings, 'id'>>; };
    };
  };
}
