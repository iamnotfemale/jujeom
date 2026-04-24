-- Phase 2d: orders.note 컬럼 추가 + create_order_atomic p_note 파라미터 추가
ALTER TABLE orders ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';

-- create_order_atomic에 p_note 파라미터 추가
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_store_id      uuid,
  p_table_id      bigint DEFAULT NULL,
  p_items         jsonb  DEFAULT '[]',
  p_customer_name text   DEFAULT NULL,
  p_method        text   DEFAULT 'transfer',
  p_note          text   DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store        public.stores%ROWTYPE;
  v_table        public.tables%ROWTYPE;
  v_order_id     bigint;
  v_order_number text;
  v_total        int := 0;
  v_item         jsonb;
  v_menu         public.menus%ROWTYPE;
  v_qty          int;
BEGIN
  IF p_method NOT IN ('toss', 'transfer') THEN
    RAISE EXCEPTION 'invalid_method' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_store FROM public.stores WHERE id = p_store_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'store_not_found' USING ERRCODE = '42704'; END IF;
  IF NOT v_store.is_open THEN RAISE EXCEPTION 'store_closed' USING ERRCODE = '42501'; END IF;
  IF v_store.is_paused THEN RAISE EXCEPTION 'store_paused' USING ERRCODE = '42501'; END IF;

  IF p_table_id IS NOT NULL THEN
    SELECT * INTO v_table FROM public.tables
    WHERE id = p_table_id AND store_id = p_store_id AND kind = 'table';
    IF NOT FOUND THEN RAISE EXCEPTION 'table_not_found' USING ERRCODE = '42704'; END IF;
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items_required' USING ERRCODE = '22023';
  END IF;

  -- 1차 검증 + 재고 차감 (FOR UPDATE 락)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = '22023'; END IF;

    SELECT * INTO v_menu FROM public.menus
    WHERE id = (v_item->>'menu_id')::bigint AND store_id = p_store_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'menu_not_found: %', v_item->>'menu_id' USING ERRCODE = '42704';
    END IF;
    IF NOT v_menu.is_active THEN
      RAISE EXCEPTION 'menu_inactive: %', v_menu.name USING ERRCODE = '42501';
    END IF;
    IF v_menu.is_sold_out THEN
      RAISE EXCEPTION 'menu_sold_out: %', v_menu.name USING ERRCODE = '42501';
    END IF;
    IF v_menu.stock < v_qty THEN
      RAISE EXCEPTION 'insufficient_stock: %', v_menu.name USING ERRCODE = '42501';
    END IF;

    UPDATE public.menus
    SET stock = stock - v_qty,
        is_sold_out = (stock - v_qty = 0)
    WHERE id = v_menu.id;

    v_total := v_total + v_menu.price * v_qty;
  END LOOP;

  v_order_number := to_char(now() AT TIME ZONE 'Asia/Seoul', 'HH24MISS')
                 || '-' || lpad(floor(random() * 1000)::int::text, 3, '0');

  INSERT INTO public.orders (
    store_id, table_id, table_number, order_number,
    status, final_amount, customer_name, note
  ) VALUES (
    p_store_id, p_table_id, v_table.number, v_order_number,
    'pending', v_total, p_customer_name, COALESCE(p_note, '')
  ) RETURNING id INTO v_order_id;

  -- order_items (DB 가격 사용, 클라이언트 가격 무시)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_menu FROM public.menus
    WHERE id = (v_item->>'menu_id')::bigint;
    INSERT INTO public.order_items (
      order_id, menu_id, menu_name, unit_price, quantity, options
    ) VALUES (
      v_order_id, v_menu.id, v_menu.name, v_menu.price,
      (v_item->>'quantity')::int, v_item->>'options'
    );
  END LOOP;

  INSERT INTO public.payments (
    order_id, store_id, status, method, amount, customer_name
  ) VALUES (
    v_order_id, p_store_id, 'waiting', p_method, v_total, p_customer_name
  );

  IF p_table_id IS NOT NULL THEN
    UPDATE public.tables SET status = 'occupied' WHERE id = p_table_id;
  END IF;

  INSERT INTO public.audit_log (store_id, actor, action, metadata)
  VALUES (p_store_id, 'anon', 'order.create',
          jsonb_build_object('order_id', v_order_id, 'amount', v_total));

  RETURN jsonb_build_object(
    'order_id',     v_order_id,
    'order_number', v_order_number,
    'total',        v_total
  );
END;
$function$;
