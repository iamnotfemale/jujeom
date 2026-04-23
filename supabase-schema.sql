-- 주점 주문 앱 Supabase 스키마
-- tables / menus / orders / order_items / payments / store_settings
--
-- NOTE: 관리자 PIN은 이 스키마가 아닌 admin_auth 테이블(bcrypt 해시)에서 관리됨.
--       admin_auth 테이블은 supabase-security-functions.sql에서 생성된다.
--       신규 설치 시 Next.js 서버(/api/admin/auth/set-pin)를 통해 초기 PIN을 설정할 것.

-- ── 주점 설정 ──
CREATE TABLE store_settings (
  id SERIAL PRIMARY KEY,
  store_name TEXT NOT NULL DEFAULT '컴공 주점',
  store_description TEXT DEFAULT '',
  notice TEXT DEFAULT '',
  welcome_text TEXT DEFAULT '어서 오세요, 즐거운 한 잔 되세요.',
  welcome_highlight TEXT DEFAULT '즐거운 한 잔',
  bank_name TEXT NOT NULL DEFAULT '카카오뱅크',
  account_number TEXT NOT NULL DEFAULT '',
  account_holder TEXT NOT NULL DEFAULT '',
  toss_qr_url TEXT DEFAULT '',
  transfer_guide TEXT DEFAULT '',
  is_open BOOLEAN NOT NULL DEFAULT false,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  closed_message TEXT DEFAULT '오늘 영업은 종료되었습니다.',
  auto_lock_kds BOOLEAN NOT NULL DEFAULT true,
  serving_mode TEXT NOT NULL DEFAULT 'pickup' CHECK (serving_mode IN ('pickup', 'table'))
);

-- 기본 설정 삽입 (계좌번호/예금주는 배포 후 관리자 설정 화면에서 입력)
INSERT INTO store_settings (store_name, store_description, bank_name, account_number, account_holder)
VALUES ('주점', '', '카카오뱅크', '', '');

-- ── 테이블 ──
-- shape 컬럼은 역호환을 위해 남겨둠 (deprecated). 실제 치수/인원은 width/height/capacity 사용.
CREATE TABLE tables (
  id SERIAL PRIMARY KEY,
  number INT NOT NULL UNIQUE,
  shape TEXT NOT NULL DEFAULT 'square-4' CHECK (shape IN ('square-2', 'square-4')),
  kind TEXT NOT NULL DEFAULT 'table' CHECK (kind IN ('table', 'restroom', 'kitchen')),
  width INT NOT NULL DEFAULT 140,
  height INT NOT NULL DEFAULT 76,
  capacity INT NOT NULL DEFAULT 4,
  position_x INT NOT NULL DEFAULT 0,
  position_y INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'empty' CHECK (status IN ('empty', 'occupied', 'payment_pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 메뉴 ──
CREATE TABLE menus (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INT NOT NULL,
  category TEXT NOT NULL DEFAULT '안주',
  image_url TEXT DEFAULT '',
  is_sold_out BOOLEAN NOT NULL DEFAULT false,
  stock INT NOT NULL DEFAULT 30,
  max_stock INT NOT NULL DEFAULT 30,
  sort_order INT NOT NULL DEFAULT 0,
  options TEXT DEFAULT '',
  tag TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 주문 ──
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  table_id INT NOT NULL REFERENCES tables(id),
  table_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'cooking', 'ready', 'served', 'cancelled')),
  note TEXT DEFAULT '',
  total_amount INT NOT NULL DEFAULT 0,
  final_amount INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 주문 항목 ──
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_id INT NOT NULL REFERENCES menus(id),
  menu_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price INT NOT NULL,
  options TEXT DEFAULT ''
);

-- ── 결제 ──
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'confirmed', 'completed', 'cancelled')),
  method TEXT NOT NULL DEFAULT 'toss'
    CHECK (method IN ('toss', 'transfer')),
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 인덱스 ──
CREATE INDEX idx_orders_table_id ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ── Realtime 활성화 ──
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
ALTER PUBLICATION supabase_realtime ADD TABLE menus;

-- ── 샘플 데이터: 테이블 (초기 상태는 빈 캔버스. 관리자가 직접 추가) ──
-- 필요 시 아래 주석을 해제하여 샘플 추가
-- INSERT INTO tables (number, kind, width, height, capacity, position_x, position_y) VALUES
--   (1, 'table', 140, 76, 4, 60, 80),
--   (2, 'table', 140, 76, 4, 240, 80);

-- ── 샘플 데이터: 메뉴 ──
INSERT INTO menus (name, description, price, category, is_sold_out, stock, max_stock, sort_order, tag) VALUES
  ('매콤 무뼈 닭발', '불맛 · 마늘 · 청양고추', 14000, '안주', false, 18, 30, 1, '인기'),
  ('컴공 해물파전', '오징어 · 새우 · 쪽파 듬뿍', 13000, '안주', false, 24, 40, 2, '추천'),
  ('먹태 + 청양마요', '구워낸 먹태 + 수제 청양마요', 12000, '안주', false, 5, 20, 3, ''),
  ('치즈 계란말이', '모짜렐라 · 체다 2종', 10000, '안주', true, 0, 25, 4, ''),
  ('컴공 국물떡볶이', '매콤 · 어묵 · 라면사리 무료 추가', 11000, '안주', false, 32, 35, 5, ''),
  ('김치전 세트', '김치전 1장 + 막걸리 1병', 15000, '안주', false, 12, 30, 6, '세트'),
  ('김치전', '바삭 + 매콤', 9000, '안주', false, 20, 30, 7, ''),
  ('소주 · 참이슬', '360ml', 5000, '주류', false, 48, 80, 8, ''),
  ('소주 · 처음처럼', '360ml', 5000, '주류', false, 3, 60, 9, ''),
  ('지평 막걸리', '750ml · 경기 지평양조', 6000, '주류', false, 16, 40, 10, ''),
  ('생맥주 500cc', '카스 · 시원', 4500, '주류', true, 0, 100, 11, ''),
  ('콜라 캔', '250ml', 2500, '음료', false, 44, 60, 12, ''),
  ('사이다 캔', '250ml', 2500, '음료', false, 22, 60, 13, '');

-- ── Supabase Storage 버킷 (대시보드에서 생성) ──
-- Bucket: menu-images (public) — 메뉴 사진
-- Bucket: store-assets (public) — 로고, QR 이미지
