-- 기존 jujeom_ddj에서 옮겨온 메뉴 11개 seed 데이터
-- 사용법: 첫 가게가 만들어진 뒤 해당 store_id를 p_store_id에 넣고 실행
--   psql -v p_store_id='<uuid>' -f supabase-seed-menus.sql
-- 또는 Supabase SQL Editor에서 실행 시 :'p_store_id' 부분을 실제 uuid로 치환

INSERT INTO menus (store_id, name, description, price, category, is_sold_out, stock, options, image_url, tag) VALUES
  (:'p_store_id', '매콤 무뼈 닭발',  '불맛 · 마늘 · 청양고추',            14000, '안주', false, 14, '', '', '인기'),
  (:'p_store_id', '해물파전',        '오징어 · 새우 · 쪽파 듬뿍',          13000, '안주', false, 15, '', '', '추천'),
  (:'p_store_id', '먹태 + 청양마요', '구워낸 먹태 + 수제 청양마요',        12000, '안주', false,  5, '', '', ''),
  (:'p_store_id', '계란말이',        '모짜렐라 · 체다 2종',                10000, '안주', true,   0, '', '', ''),
  (:'p_store_id', '국물떡볶이',      '매콤 · 어묵 · 라면사리 무료 추가',   11000, '안주', false, 32, '', '', ''),
  (:'p_store_id', '김치전',          '바삭 + 매콤',                         9000, '안주', false, 20, '', '', ''),
  (:'p_store_id', '소주 · 참이슬',   '360ml',                               5000, '주류', false, 48, '', '', ''),
  (:'p_store_id', '막걸리',          '750ml · 경기 지평양조',               6000, '주류', false, 16, '', '', ''),
  (:'p_store_id', '생맥주 500cc',    '카스 · 시원',                         4500, '주류', false, 80, '', '', ''),
  (:'p_store_id', '콜라 캔',         '250ml',                               2500, '음료', false, 43, '', '', ''),
  (:'p_store_id', '사이다 캔',       '250ml',                               2500, '음료', false, 22, '', '', '');
