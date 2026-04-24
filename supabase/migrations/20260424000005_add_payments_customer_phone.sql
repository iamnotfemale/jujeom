-- payments 테이블에 customer_phone 컬럼 추가
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS customer_phone text;
