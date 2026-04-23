-- store_settings에 serving_mode 컬럼 추가
-- 'pickup': 고객이 픽업대에서 수령 (기본값, 기존 동작 유지)
-- 'table' : 직원이 테이블로 서빙

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS serving_mode TEXT NOT NULL DEFAULT 'pickup'
    CHECK (serving_mode IN ('pickup', 'table'));

-- public_store_settings 뷰 재생성 (serving_mode 포함, 기존 컬럼 구성 유지)
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
  auto_lock_kds,
  serving_mode
FROM store_settings;

GRANT SELECT ON public_store_settings TO anon, authenticated;
