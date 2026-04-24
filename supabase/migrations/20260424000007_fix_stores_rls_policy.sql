-- stores_select: qual=true(계좌번호 등 전체 공개) → 멤버 전용으로 변경
-- 앱의 모든 서버 쿼리는 service_role을 사용하므로 기능 영향 없음
DROP POLICY IF EXISTS stores_select ON public.stores;

CREATE POLICY stores_select ON public.stores
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id IN (
      SELECT store_id FROM public.store_members WHERE user_id = auth.uid()
    )
  );
