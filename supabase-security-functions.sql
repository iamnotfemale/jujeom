-- =====================================================================
-- supabase-security-functions.sql
-- ---------------------------------------------------------------------
-- 보안 아키텍처 마이그레이션 1/2 — 함수/테이블/시퀀스/뷰
--
-- 실행 순서:
--   1) 이 파일(supabase-security-functions.sql) 먼저 실행
--   2) supabase-security-rls.sql 실행 (정책 교체)
--
-- admin_auth 초기 PIN은 Next.js 서버(Node.js)에서 bcrypt 해시를 생성한 뒤
-- service_role 키로 아래처럼 INSERT 합니다. SQL 파일에 평문/해시를 박아두지 않습니다.
--
--   -- (예시, 실제 해시는 서버에서 생성 후 치환)
--   -- INSERT INTO admin_auth (id, pin_hash) VALUES (1, '$2b$10$....');
--
-- 이 스크립트는 IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE 로
-- 재실행해도 안전하도록 작성되어 있습니다.
-- =====================================================================

-- =====================================================================
-- 1-1. 주문번호 시퀀스
-- =====================================================================
CREATE SEQUENCE IF NOT EXISTS order_number_seq;


-- =====================================================================
-- 1-2. admin_auth 테이블 (PIN bcrypt 해시 저장)
--
-- RLS를 활성화하되 "아무 정책도 만들지 않음" → anon/authenticated는
-- 일체 접근 불가. service_role은 RLS를 우회하므로 Next.js API route(서버
-- 전용)에서만 읽고 쓸 수 있다.
-- =====================================================================
CREATE TABLE IF NOT EXISTS admin_auth (
  id         INT PRIMARY KEY,
  pin_hash   TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_auth ENABLE ROW LEVEL SECURITY;

-- 방어적 권한 회수(anon/authenticated가 실수로라도 직접 읽지 못하도록)
REVOKE ALL ON admin_auth FROM anon;
REVOKE ALL ON admin_auth FROM authenticated;

-- 초기 PIN INSERT 안내 (실제 실행은 서버에서 bcrypt 해시 생성 후):
--
--   INSERT INTO admin_auth (id, pin_hash) VALUES (1, '<bcrypt_hash>')
--   ON CONFLICT (id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash,
--                                  updated_at = now();


-- =====================================================================
-- 1-3. public_store_settings VIEW
--
-- store_settings.pin(평문) 컬럼은 당장은 삭제하지 않고, RLS(파일 2)에서
-- anon의 직접 SELECT/UPDATE를 차단할 예정. 이 VIEW는 pin 컬럼을 제외한
-- 안전한 읽기용 뷰로, 추후 프론트엔드가 store_settings 대신 이 VIEW를
-- 쓰도록 전환할 때 사용한다.
-- =====================================================================
CREATE OR REPLACE VIEW public_store_settings AS
SELECT
  id,
  store_name,
  store_description,
  notice,
  welcome_text,
  welcome_highlight,
  bank_name,
  account_number,
  account_holder,
  toss_qr_url,
  transfer_guide,
  is_open,
  is_paused,
  closed_message,
  auto_lock_kds
FROM store_settings;

GRANT SELECT ON public_store_settings TO anon, authenticated;


-- =====================================================================
-- 1-4. audit_log 테이블
-- =====================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  actor       TEXT NOT NULL,       -- 'anon' | 'admin' | 'system'
  action      TEXT NOT NULL,       -- 'order.create' | 'payment.confirm' | ...
  entity_type TEXT,
  entity_id   INT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity     ON audit_log(entity_type, entity_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있으면 제거 (재실행 안전)
DROP POLICY IF EXISTS "audit_service_insert" ON audit_log;
DROP POLICY IF EXISTS "audit_service_read"   ON audit_log;

-- service_role은 RLS를 우회하므로 실질적으로 정책이 없어도 동작하지만,
-- 의도를 명시적으로 남긴다. anon/authenticated용 정책은 만들지 않음 → 차단.
CREATE POLICY "audit_service_insert" ON audit_log
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "audit_service_read" ON audit_log
  FOR SELECT TO service_role USING (true);

REVOKE ALL ON audit_log FROM anon;
REVOKE ALL ON audit_log FROM authenticated;


-- =====================================================================
-- 1-5. 핵심 RPC: create_order_atomic
--
-- 손님 주문 생성의 모든 검증/계산을 DB에서 수행.
-- - 영업 상태 / 일시정지 체크
-- - 테이블 존재 + kind='table' 체크
-- - 장바구니 비어있음 / customer_name 비어있음 검증
-- - 메뉴를 FOR UPDATE 락 → 품절/재고 부족 검증
-- - 가격은 DB 값을 사용 (파라미터의 price 무시)
-- - orders / order_items / payments INSERT 를 단일 트랜잭션
-- - 주문번호: HH24MISS-XXX (시퀀스 % 1000)
-- - audit_log 기록
-- - 예외 시 자동 롤백
--
-- SECURITY DEFINER + search_path=public 고정 → RLS 우회하면서 검색 경로
-- 탈취를 방지.
-- =====================================================================
DROP FUNCTION IF EXISTS create_order_atomic(INT, TEXT, JSONB, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_order_atomic(
  p_table_number   INT,
  p_note           TEXT,
  p_items          JSONB,
  p_customer_name  TEXT,
  p_customer_phone TEXT,
  p_method         TEXT
)
RETURNS TABLE (order_id INT, order_number TEXT, total INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings      store_settings%ROWTYPE;
  v_table         tables%ROWTYPE;
  v_menu          menus%ROWTYPE;
  v_item          JSONB;
  v_menu_id       INT;
  v_qty           INT;
  v_options       TEXT;
  v_total         INT := 0;
  v_order_id      INT;
  v_order_number  TEXT;
  v_item_count    INT;
BEGIN
  -- ── 입력값 정규화/기본 검증 ──
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'invalid_items' USING HINT = '장바구니 형식이 올바르지 않습니다.';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'empty_cart' USING HINT = '장바구니가 비어있습니다.';
  END IF;

  IF p_customer_name IS NULL OR length(btrim(p_customer_name)) = 0 THEN
    RAISE EXCEPTION 'empty_customer_name' USING HINT = '주문자 이름이 필요합니다.';
  END IF;

  IF p_method IS NULL OR p_method NOT IN ('toss', 'transfer') THEN
    RAISE EXCEPTION 'invalid_method' USING HINT = '결제 수단이 올바르지 않습니다.';
  END IF;

  -- ── 영업 상태 체크 ──
  SELECT * INTO v_settings FROM store_settings ORDER BY id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'store_not_configured';
  END IF;

  IF NOT v_settings.is_open THEN
    RAISE EXCEPTION 'store_closed' USING HINT = '영업이 종료되었습니다.';
  END IF;

  IF v_settings.is_paused THEN
    RAISE EXCEPTION 'store_paused' USING HINT = '현재 주문을 일시 중단 중입니다.';
  END IF;

  -- ── 테이블 조회 + kind 체크 ──
  SELECT * INTO v_table
  FROM tables
  WHERE number = p_table_number
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'table_not_found' USING HINT = '존재하지 않는 테이블입니다.';
  END IF;

  IF v_table.kind <> 'table' THEN
    RAISE EXCEPTION 'invalid_table_kind' USING HINT = '주문 가능한 테이블이 아닙니다.';
  END IF;

  -- ── 주문번호 생성 ──
  v_order_number := to_char(now(), 'HH24MISS') || '-' ||
                    lpad((nextval('order_number_seq') % 1000)::TEXT, 3, '0');

  -- ── orders INSERT (총액은 아이템 루프 후 UPDATE) ──
  INSERT INTO orders (
    order_number, table_id, table_number, status, note,
    total_amount, final_amount
  )
  VALUES (
    v_order_number, v_table.id, v_table.number, 'pending', COALESCE(p_note, ''),
    0, 0
  )
  RETURNING id INTO v_order_id;

  -- ── 아이템별 처리: 메뉴 FOR UPDATE 락 → 검증 → 재고 차감 → order_items INSERT ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_id := NULLIF(v_item->>'menu_id', '')::INT;
    v_qty     := COALESCE(NULLIF(v_item->>'quantity', '')::INT, 0);
    v_options := COALESCE(v_item->>'options', '');

    IF v_menu_id IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_item' USING HINT = '잘못된 주문 항목이 있습니다.';
    END IF;

    -- 동시 주문 경합 방지를 위해 행 잠금
    SELECT * INTO v_menu
    FROM menus
    WHERE id = v_menu_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'menu_not_found'
        USING HINT = format('메뉴(%s)를 찾을 수 없습니다.', v_menu_id);
    END IF;

    IF v_menu.is_sold_out THEN
      RAISE EXCEPTION 'menu_sold_out'
        USING HINT = format('%s 는(은) 품절입니다.', v_menu.name);
    END IF;

    IF v_menu.stock < v_qty THEN
      RAISE EXCEPTION 'insufficient_stock'
        USING HINT = format('%s 재고가 부족합니다. (남은 수량: %s)', v_menu.name, v_menu.stock);
    END IF;

    -- 재고 차감 (stock이 0이 되면 자동 품절 처리)
    UPDATE menus
    SET
      stock       = stock - v_qty,
      is_sold_out = CASE WHEN (stock - v_qty) <= 0 THEN true ELSE is_sold_out END
    WHERE id = v_menu.id;

    -- 주문 항목 기록 (가격은 DB 값 사용)
    INSERT INTO order_items (order_id, menu_id, menu_name, quantity, unit_price, options)
    VALUES (v_order_id, v_menu.id, v_menu.name, v_qty, v_menu.price, v_options);

    v_total := v_total + (v_menu.price * v_qty);
  END LOOP;

  -- ── orders 금액 업데이트 ──
  UPDATE orders
  SET total_amount = v_total,
      final_amount = v_total,
      updated_at   = now()
  WHERE id = v_order_id;

  -- ── payments INSERT ──
  INSERT INTO payments (order_id, amount, status, method, customer_name, customer_phone)
  VALUES (
    v_order_id, v_total, 'waiting', p_method,
    btrim(p_customer_name), COALESCE(p_customer_phone, '')
  );

  -- ── 테이블 상태: 빈 자리였다면 occupied 로 전환 ──
  UPDATE tables
  SET status = 'occupied'
  WHERE id = v_table.id
    AND status = 'empty';

  -- ── 감사 로그 ──
  INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
  VALUES (
    'anon', 'order.create', 'order', v_order_id,
    jsonb_build_object(
      'order_number',  v_order_number,
      'table_number',  v_table.number,
      'total',         v_total,
      'item_count',    v_item_count,
      'method',        p_method,
      'customer_name', btrim(p_customer_name)
    )
  );

  RETURN QUERY SELECT v_order_id, v_order_number, v_total;
END;
$$;

REVOKE ALL ON FUNCTION create_order_atomic(INT, TEXT, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION create_order_atomic(INT, TEXT, JSONB, TEXT, TEXT, TEXT) TO anon, authenticated;


-- =====================================================================
-- 1-6. 관리자 RPC 함수들
--
-- 이 함수들은 SECURITY DEFINER 로 정의하되 GRANT EXECUTE 는 service_role
-- 에만 부여 → Next.js API route(서버 전용)에서만 호출 가능. anon에서
-- 직접 호출해도 권한 부족으로 실패한다.
-- =====================================================================

-- ── 내부 helper: order_items 순회하여 재고 원복 ──
DROP FUNCTION IF EXISTS _restore_stock_for_order(INT);

CREATE OR REPLACE FUNCTION _restore_stock_for_order(p_order_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT menu_id, quantity FROM order_items WHERE order_id = p_order_id
  LOOP
    UPDATE menus
    SET
      stock       = stock + r.quantity,
      is_sold_out = CASE WHEN (stock + r.quantity) > 0 THEN false ELSE is_sold_out END
    WHERE id = r.menu_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION _restore_stock_for_order(INT) FROM PUBLIC;
-- (내부 helper) service_role만 호출 가능하도록 별도 GRANT 없음 (SECURITY
-- DEFINER이므로 service_role은 소유자 권한으로 호출 가능)


-- ── admin_set_payment_status ──
-- payments/orders 상태 동기화
--   waiting    → pending
--   confirmed  → accepted  (+ tables.status='occupied' if empty)
--   completed  → served
--   cancelled  → cancelled (+ 재고 원복)
DROP FUNCTION IF EXISTS admin_set_payment_status(INT, TEXT);

CREATE OR REPLACE FUNCTION admin_set_payment_status(
  p_order_id   INT,
  p_new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order       orders%ROWTYPE;
  v_order_stat  TEXT;
BEGIN
  IF p_new_status NOT IN ('waiting', 'confirmed', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_payment_status';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  -- payments 상태 변경
  UPDATE payments
  SET status       = p_new_status,
      confirmed_at = CASE WHEN p_new_status = 'confirmed' THEN now() ELSE confirmed_at END
  WHERE order_id = p_order_id;

  -- orders 상태 매핑
  v_order_stat := CASE p_new_status
    WHEN 'waiting'   THEN 'pending'
    WHEN 'confirmed' THEN 'accepted'
    WHEN 'completed' THEN 'served'
    WHEN 'cancelled' THEN 'cancelled'
  END;

  UPDATE orders
  SET status     = v_order_stat,
      updated_at = now()
  WHERE id = p_order_id;

  -- confirmed: 테이블 점유 처리
  IF p_new_status = 'confirmed' THEN
    UPDATE tables
    SET status = 'occupied'
    WHERE id = v_order.table_id
      AND status = 'empty';
  END IF;

  -- cancelled: 재고 원복
  IF p_new_status = 'cancelled' THEN
    PERFORM _restore_stock_for_order(p_order_id);
  END IF;

  -- audit
  INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
  VALUES (
    'admin', 'payment.set_status', 'order', p_order_id,
    jsonb_build_object('new_status', p_new_status, 'order_status', v_order_stat)
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_set_payment_status(INT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION admin_set_payment_status(INT, TEXT) TO service_role;


-- ── admin_cancel_order ──
DROP FUNCTION IF EXISTS admin_cancel_order(INT);

CREATE OR REPLACE FUNCTION admin_cancel_order(p_order_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM orders WHERE id = p_order_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  UPDATE orders
  SET status     = 'cancelled',
      updated_at = now()
  WHERE id = p_order_id;

  UPDATE payments
  SET status = 'cancelled'
  WHERE order_id = p_order_id;

  PERFORM _restore_stock_for_order(p_order_id);

  INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
  VALUES ('admin', 'order.cancel', 'order', p_order_id, NULL);
END;
$$;

REVOKE ALL ON FUNCTION admin_cancel_order(INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION admin_cancel_order(INT) TO service_role;


-- ── admin_update_order_status (KDS 용) ──
DROP FUNCTION IF EXISTS admin_update_order_status(INT, TEXT);

CREATE OR REPLACE FUNCTION admin_update_order_status(
  p_order_id INT,
  p_status   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('pending', 'accepted', 'cooking', 'ready', 'served', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_order_status';
  END IF;

  UPDATE orders
  SET status     = p_status,
      updated_at = now()
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
  VALUES ('admin', 'order.update_status', 'order', p_order_id,
          jsonb_build_object('status', p_status));
END;
$$;

REVOKE ALL ON FUNCTION admin_update_order_status(INT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION admin_update_order_status(INT, TEXT) TO service_role;


-- ── admin_reset_all (전체 초기화) ──
DROP FUNCTION IF EXISTS admin_reset_all();

CREATE OR REPLACE FUNCTION admin_reset_all()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 순서 주의: payments → order_items → orders
  DELETE FROM payments;
  DELETE FROM order_items;
  DELETE FROM orders;

  UPDATE tables
  SET status = 'empty';

  UPDATE menus
  SET stock       = max_stock,
      is_sold_out = false;

  INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
  VALUES ('admin', 'system.reset_all', NULL, NULL, NULL);
END;
$$;

REVOKE ALL ON FUNCTION admin_reset_all() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION admin_reset_all() TO service_role;


-- =====================================================================
-- 끝. 다음 단계: supabase-security-rls.sql 실행
-- =====================================================================
