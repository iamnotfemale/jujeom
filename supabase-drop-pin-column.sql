-- ===============================================================
-- store_settings.pin 컬럼 제거
-- ===============================================================
-- 전제: admin_auth 테이블에 bcrypt 해시된 PIN이 이미 설정되어 있음
-- (관리자가 /api/admin/auth/set-pin 경유로 최소 1회 PIN 변경 완료)
--
-- 이 마이그레이션 실행 후:
--   - store_settings 테이블에서 pin 컬럼이 제거됨
--   - /api/admin/auth/login은 admin_auth만 참조 (fallback 제거됨)
--   - 모든 관리자는 새 PIN으로만 로그인 가능
--
-- 안전하게 실행하기:
--   1) admin_auth에 해시가 있는지 먼저 확인
--      SELECT count(*) FROM admin_auth;  -- >= 1 이어야 함
--   2) 새 PIN으로 로그인 가능한지 테스트
--   3) 그 다음 이 스크립트 실행
-- ===============================================================

-- 1. admin_auth에 적어도 1개 row가 있는지 확인 (없으면 에러로 중단)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_auth LIMIT 1) THEN
    RAISE EXCEPTION 'admin_auth is empty. Set PIN via /api/admin/auth/set-pin first.';
  END IF;
END $$;

-- 2. public_store_settings VIEW 재생성 (store_settings.pin 컬럼 참조 제거 후 DROP 가능하도록)
--    supabase-security-functions.sql의 VIEW 정의와 동일 (pin 제외)
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

-- 3. pin 컬럼 제거
ALTER TABLE store_settings DROP COLUMN IF EXISTS pin;

-- 완료
