-- =====================================================================
-- supabase-security-rls.sql
-- ---------------------------------------------------------------------
-- 보안 아키텍처 마이그레이션 2/2 — RLS 정책 전면 교체
--
-- 실행 순서:
--   1) supabase-security-functions.sql 먼저 실행 (함수/테이블/뷰/시퀀스)
--   2) 이 파일 실행 (RLS 정책 교체)
--
-- 원칙:
--   - anon / authenticated:
--       * SELECT: menus, tables, store_settings, orders, order_items,
--                 payments, public_store_settings(VIEW) 허용
--       * INSERT: 어디에도 허용하지 않음 (주문 생성은 create_order_atomic RPC 경유)
--       * UPDATE / DELETE: 전부 차단
--   - service_role: RLS를 우회하므로 정책 없이도 전부 허용됨 (Next.js API
--     route에서 service_role 키로 수행)
--   - admin_auth, audit_log 의 RLS/정책은 파일 1에서 설정됨
--
-- ⚠️  이 마이그레이션을 실행한 뒤에는 기존 관리자 페이지들이 직접 테이블을
--     UPDATE/DELETE/INSERT 하는 경로는 전부 실패한다. 관리자 동작은 반드시
--     Next.js API route를 경유해서 service_role 로 수행해야 한다.
--     (see: supabase-security-functions.sql — admin_* RPC들)
-- =====================================================================


-- =====================================================================
-- 0. 기존 정책 전부 제거 (supabase-rls.sql에서 만든 정책들 + 방어용 흔한 이름들)
--    DROP POLICY IF EXISTS ... → 존재하지 않아도 no-op
-- =====================================================================

-- store_settings
DROP POLICY IF EXISTS "누구나 설정 읽기"          ON store_settings;
DROP POLICY IF EXISTS "인증 사용자 설정 수정"     ON store_settings;
DROP POLICY IF EXISTS "store_settings_read"       ON store_settings;
DROP POLICY IF EXISTS "store_settings_update"     ON store_settings;
DROP POLICY IF EXISTS "anon_read"                 ON store_settings;

-- tables
DROP POLICY IF EXISTS "누구나 테이블 읽기"        ON tables;
DROP POLICY IF EXISTS "테이블 생성"               ON tables;
DROP POLICY IF EXISTS "테이블 수정"               ON tables;
DROP POLICY IF EXISTS "테이블 삭제"               ON tables;
DROP POLICY IF EXISTS "anon_read"                 ON tables;

-- menus
DROP POLICY IF EXISTS "누구나 메뉴 읽기"          ON menus;
DROP POLICY IF EXISTS "메뉴 생성"                 ON menus;
DROP POLICY IF EXISTS "메뉴 수정"                 ON menus;
DROP POLICY IF EXISTS "메뉴 삭제"                 ON menus;
DROP POLICY IF EXISTS "anon_read"                 ON menus;

-- orders
DROP POLICY IF EXISTS "주문 읽기"                 ON orders;
DROP POLICY IF EXISTS "주문 생성"                 ON orders;
DROP POLICY IF EXISTS "주문 수정"                 ON orders;
DROP POLICY IF EXISTS "anon_read"                 ON orders;

-- order_items
DROP POLICY IF EXISTS "주문항목 읽기"             ON order_items;
DROP POLICY IF EXISTS "주문항목 생성"             ON order_items;
DROP POLICY IF EXISTS "anon_read"                 ON order_items;

-- payments
DROP POLICY IF EXISTS "결제 읽기"                 ON payments;
DROP POLICY IF EXISTS "결제 생성"                 ON payments;
DROP POLICY IF EXISTS "결제 수정"                 ON payments;
DROP POLICY IF EXISTS "anon_read"                 ON payments;


-- =====================================================================
-- 1. RLS 활성화 보장 (기존 스키마에서 이미 켰겠지만 재실행 안전용)
-- =====================================================================
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables         ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;


-- =====================================================================
-- 2. SELECT 정책 (anon / authenticated 모두 읽기 허용)
--
-- 참고: 프론트엔드 여러 곳(src/app/layout.tsx, PinLogin, DynamicTitle,
--      ClosedGate, order 페이지 등)이 현재 store_settings 를 직접 조회
--      하고 있다. 따라서 당장은 store_settings SELECT 를 허용한다.
--      단, pin 컬럼을 노출하지 않으려면 프론트에서
--      public_store_settings VIEW 로 전환할 것.
--      TODO(보안 2차): 프론트가 VIEW 로 이전된 후 여기서 store_settings
--      SELECT 를 제거하고 admin_auth 처럼 정책 없음(차단) 으로 돌릴 것.
-- =====================================================================

CREATE POLICY "anon_read" ON store_settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_read" ON tables
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_read" ON menus
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_read" ON orders
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_read" ON order_items
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "anon_read" ON payments
  FOR SELECT TO anon, authenticated USING (true);


-- =====================================================================
-- 3. INSERT / UPDATE / DELETE 정책
--
-- 의도적으로 "아무것도 만들지 않음". anon/authenticated 에 대해서는
-- 모든 쓰기가 차단되고, 오직 service_role(RLS 우회) 또는 SECURITY
-- DEFINER 함수(create_order_atomic, admin_*)를 통해서만 쓰기가 가능.
--
-- 손님 주문 생성:
--   프론트는 INSERT 대신 supabase.rpc('create_order_atomic', {...}) 호출.
-- 관리자 쓰기 전체:
--   Next.js API route(server) 에서 service_role 키로 admin_* RPC 호출.
-- =====================================================================

-- (해당 없음 — 정책 없음 = 차단)


-- =====================================================================
-- 4. 스태프 호출(staff_calls) 관련
--
-- 현재 스키마에는 staff_calls 테이블이 존재하지 않는다. 설계 시 언급이
-- 있었으므로 향후 추가된다면 아래처럼 정책을 열어두면 된다(주석으로만
-- 남김 — 테이블이 없는 상태에서 아래를 실행하면 에러):
--
--   ALTER TABLE staff_calls ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "anon_read"   ON staff_calls
--     FOR SELECT TO anon, authenticated USING (true);
--   CREATE POLICY "anon_insert" ON staff_calls
--     FOR INSERT TO anon, authenticated WITH CHECK (true);
-- =====================================================================


-- =====================================================================
-- 5. 실행 후 주의사항 / 체크리스트
-- ---------------------------------------------------------------------
-- 이 마이그레이션 실행 후:
--
--   1) 손님 주문 플로우: 프론트에서 orders/order_items/payments 를 직접
--      INSERT 하는 코드는 전부 깨진다. supabase.rpc('create_order_atomic',
--      { p_table_number, p_note, p_items, p_customer_name,
--        p_customer_phone, p_method }) 로 교체 필요.
--
--   2) 관리자 페이지(메뉴 CRUD, 테이블 CRUD, 설정 수정, 주문 상태 변경,
--      결제 승인/취소, 전체 초기화)는 전부 실패한다. 각 동작을 Next.js
--      API route(예: app/api/admin/.../route.ts) 로 옮기고 서버에서
--      service_role 키로 Supabase에 접근하도록 수정해야 한다.
--      주문 상태/결제/취소/초기화 는 admin_* RPC 를 호출할 수 있다.
--      메뉴/테이블 CRUD 는 service_role 키로 직접 테이블 수정.
--
--   3) store_settings.pin 은 테이블에 그대로 남아있지만 anon 에서 UPDATE
--      가 불가능하다. 초기 관리자 PIN은 Next.js 서버에서 bcrypt 해시로
--      admin_auth 테이블에 INSERT 한다 (supabase-security-functions.sql
--      상단 안내 참고).
--
--   4) 추후 store_settings SELECT 도 막고 싶다면 프론트를
--      public_store_settings VIEW 로 전환 후, 위 섹션 2의 store_settings
--      SELECT 정책을 제거하면 된다.
-- =====================================================================
