ALTER TABLE "marmitaria"."companies" ADD COLUMN IF NOT EXISTS "openingHours" jsonb;--> statement-breakpoint
ALTER TABLE "marmitaria"."companies" ADD COLUMN IF NOT EXISTS "acceptsCashOnDelivery" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "marmitaria"."companies" ADD COLUMN IF NOT EXISTS "pickupEnabled" boolean DEFAULT false NOT NULL;
