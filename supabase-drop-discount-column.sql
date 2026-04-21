-- ===============================================================
-- orders.discount_amount 컬럼 제거
-- ===============================================================
-- 이유: 할인 기능 미사용, 코드에서 전부 제거됨
-- 안전성: final_amount는 그대로 유지 (실제 결제 금액)
--
-- 이 마이그레이션 실행 후:
--   1. orders 테이블에서 discount_amount 컬럼 제거
--   2. supabase-security-functions.sql에서 create_order_atomic 재배포 필요
--      (함수 본문에서 discount_amount 참조 제거됨)
-- ===============================================================

ALTER TABLE orders DROP COLUMN IF EXISTS discount_amount;
