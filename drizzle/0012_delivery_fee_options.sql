ALTER TABLE "marmitaria"."companies" ADD COLUMN IF NOT EXISTS "deliveryFeeMode" varchar(16) DEFAULT 'calculated';--> statement-breakpoint
ALTER TABLE "marmitaria"."companies" ADD COLUMN IF NOT EXISTS "deliveryFixedFee" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "marmitaria"."companies" ADD COLUMN IF NOT EXISTS "deliveryFreeKm" numeric(6, 2);
