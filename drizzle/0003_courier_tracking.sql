ALTER TABLE marmitaria.orders ADD COLUMN IF NOT EXISTS "customerTrackingTokenHash" varchar(64);
ALTER TABLE marmitaria.orders ADD COLUMN IF NOT EXISTS "driverTrackingTokenHash" varchar(64);
ALTER TABLE marmitaria.orders ADD COLUMN IF NOT EXISTS "trackingLatitude" numeric(10, 7);
ALTER TABLE marmitaria.orders ADD COLUMN IF NOT EXISTS "trackingLongitude" numeric(10, 7);
ALTER TABLE marmitaria.orders ADD COLUMN IF NOT EXISTS "trackingUpdatedAt" timestamptz;
CREATE INDEX IF NOT EXISTS orders_customer_tracking_token_idx ON marmitaria.orders ("customerTrackingTokenHash");
CREATE INDEX IF NOT EXISTS orders_driver_tracking_token_idx ON marmitaria.orders ("driverTrackingTokenHash");
