-- x → position_x, y → position_y 컬럼명 변경
ALTER TABLE public.tables RENAME COLUMN x TO position_x;
ALTER TABLE public.tables RENAME COLUMN y TO position_y;

-- 누락 컬럼 추가
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS shape     text    NOT NULL DEFAULT 'square-4',
  ADD COLUMN IF NOT EXISTS capacity  integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS width     integer NOT NULL DEFAULT 140,
  ADD COLUMN IF NOT EXISTS height    integer NOT NULL DEFAULT 76;

-- created_at이 없으면 추가
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
