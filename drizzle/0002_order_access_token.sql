ALTER TABLE marmitaria.orders ADD COLUMN IF NOT EXISTS "customerAccessTokenHash" varchar(64);
ALTER TABLE marmitaria.orders ADD COLUMN IF NOT EXISTS "deliveryAddress" text;
