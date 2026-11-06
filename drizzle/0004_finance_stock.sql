ALTER TABLE "marmitaria"."orders" ALTER COLUMN "trackingLatitude" SET DATA TYPE numeric(10, 7);--> statement-breakpoint
ALTER TABLE "marmitaria"."orders" ALTER COLUMN "trackingLongitude" SET DATA TYPE numeric(10, 7);--> statement-breakpoint
ALTER TABLE "marmitaria"."orders" ADD COLUMN "paymentApprovedAt" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "expenses_company_date_idx" ON "marmitaria"."expenses" USING btree ("companyId","incurredAt");--> statement-breakpoint
CREATE INDEX "inventory_movements_item_date_idx" ON "marmitaria"."inventory_movements" USING btree ("inventoryItemId","occurredAt");

--> statement-breakpoint
CREATE OR REPLACE FUNCTION marmitaria.record_inventory_movement(
  p_company_id integer,
  p_item_id integer,
  p_type marmitaria.inventory_movement_type,
  p_quantity numeric,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = marmitaria, pg_temp
AS $$
DECLARE
  item_row inventory_items%ROWTYPE;
  next_quantity numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 0 OR length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'invalid inventory movement';
  END IF;
  SELECT * INTO item_row
    FROM inventory_items
    WHERE id = p_item_id AND "companyId" = p_company_id AND active = true
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory item not found';
  END IF;
  IF p_type = 'in' THEN
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;
    next_quantity := item_row."currentQuantity" + p_quantity;
  ELSIF p_type = 'out' THEN
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;
    next_quantity := item_row."currentQuantity" - p_quantity;
    IF next_quantity < 0 THEN RAISE EXCEPTION 'insufficient inventory'; END IF;
  ELSIF p_type = 'adjustment' THEN
    next_quantity := p_quantity;
  ELSE
    RAISE EXCEPTION 'invalid inventory movement type';
  END IF;
  UPDATE inventory_items
    SET "currentQuantity" = next_quantity, "updatedAt" = now()
    WHERE id = p_item_id AND "companyId" = p_company_id
    RETURNING * INTO item_row;
  INSERT INTO inventory_movements ("inventoryItemId", type, quantity, reason, "occurredAt")
    VALUES (p_item_id, p_type, p_quantity, left(trim(p_reason), 160), now());
  RETURN to_jsonb(item_row);
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION marmitaria.record_inventory_movement(integer, integer, marmitaria.inventory_movement_type, numeric, text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION marmitaria.record_inventory_movement(integer, integer, marmitaria.inventory_movement_type, numeric, text) TO service_role;
