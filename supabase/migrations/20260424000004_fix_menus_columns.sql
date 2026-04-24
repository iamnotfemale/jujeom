-- max_stock 컬럼 추가
ALTER TABLE public.menus
  ADD COLUMN IF NOT EXISTS max_stock integer NOT NULL DEFAULT 100;

-- 기존 데이터: stock 값을 max_stock 초기값으로 설정
UPDATE public.menus SET max_stock = GREATEST(stock, 1) WHERE max_stock = 100;

-- nullable 허용 (코드가 null을 전송하므로)
ALTER TABLE public.menus
  ALTER COLUMN description DROP NOT NULL,
  ALTER COLUMN options     DROP NOT NULL,
  ALTER COLUMN image_url   DROP NOT NULL,
  ALTER COLUMN tag         DROP NOT NULL;

-- 빈문자열 기본값 제거 (null로 통일)
ALTER TABLE public.menus
  ALTER COLUMN description SET DEFAULT NULL,
  ALTER COLUMN options     SET DEFAULT NULL,
  ALTER COLUMN image_url   SET DEFAULT NULL,
  ALTER COLUMN tag         SET DEFAULT NULL;

-- 기존 빈문자열 → NULL 정규화
UPDATE public.menus SET description = NULL WHERE description = '';
UPDATE public.menus SET options     = NULL WHERE options     = '';
UPDATE public.menus SET image_url   = NULL WHERE image_url   = '';
UPDATE public.menus SET tag         = NULL WHERE tag         = '';
