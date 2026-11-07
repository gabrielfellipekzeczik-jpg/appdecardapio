ALTER TABLE "marmitaria"."companies" ADD COLUMN IF NOT EXISTS "deliveryBaseFee" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "marmitaria"."companies" ADD COLUMN IF NOT EXISTS "deliveryIncludedKm" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "marmitaria"."companies" ADD COLUMN IF NOT EXISTS "deliveryPricePerKm" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "marmitaria"."companies" ADD COLUMN IF NOT EXISTS "deliveryMaxKm" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "marmitaria"."inventory_items" ADD COLUMN IF NOT EXISTS "lastSupplier" varchar(160);
