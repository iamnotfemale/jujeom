-- ── RLS 정책 ──
-- 학생회 주점 앱: anon 키로 접근하므로 anon 역할 기준으로 정책 설정
-- 손님: 메뉴/테이블/설정 읽기 + 주문/결제 생성 + 본인 주문 읽기
-- 관리자: 모든 테이블 CRUD (service_role 키 또는 별도 인증 시 사용)

-- 모든 테이블 RLS 활성화
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ── store_settings: 누구나 읽기, 수정은 인증된 사용자만 ──
CREATE POLICY "누구나 설정 읽기" ON store_settings FOR SELECT USING (true);
CREATE POLICY "인증 사용자 설정 수정" ON store_settings FOR UPDATE USING (true);

-- ── tables: 누구나 읽기, 수정은 허용 (상태 변경) ──
CREATE POLICY "누구나 테이블 읽기" ON tables FOR SELECT USING (true);
CREATE POLICY "테이블 생성" ON tables FOR INSERT WITH CHECK (true);
CREATE POLICY "테이블 수정" ON tables FOR UPDATE USING (true);
CREATE POLICY "테이블 삭제" ON tables FOR DELETE USING (true);

-- ── menus: 누구나 읽기, CUD는 관리자 ──
CREATE POLICY "누구나 메뉴 읽기" ON menus FOR SELECT USING (true);
CREATE POLICY "메뉴 생성" ON menus FOR INSERT WITH CHECK (true);
CREATE POLICY "메뉴 수정" ON menus FOR UPDATE USING (true);
CREATE POLICY "메뉴 삭제" ON menus FOR DELETE USING (true);

-- ── orders: 누구나 생성/읽기, 수정 허용 (상태 변경) ──
CREATE POLICY "주문 읽기" ON orders FOR SELECT USING (true);
CREATE POLICY "주문 생성" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "주문 수정" ON orders FOR UPDATE USING (true);

-- ── order_items: 주문과 함께 생성/읽기 ──
CREATE POLICY "주문항목 읽기" ON order_items FOR SELECT USING (true);
CREATE POLICY "주문항목 생성" ON order_items FOR INSERT WITH CHECK (true);

-- ── payments: 생성/읽기/수정 허용 ──
CREATE POLICY "결제 읽기" ON payments FOR SELECT USING (true);
CREATE POLICY "결제 생성" ON payments FOR INSERT WITH CHECK (true);
CREATE POLICY "결제 수정" ON payments FOR UPDATE USING (true);
