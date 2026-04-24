-- Phase 2d: stores 테이블 컬럼 추가
-- store_settings에 있던 필드들을 stores 테이블로 이전
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS account_holder TEXT,
  ADD COLUMN IF NOT EXISTS closed_message TEXT,
  ADD COLUMN IF NOT EXISTS welcome_text TEXT,
  ADD COLUMN IF NOT EXISTS welcome_highlight TEXT,
  ADD COLUMN IF NOT EXISTS notice TEXT,
  ADD COLUMN IF NOT EXISTS auto_lock_kds BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
