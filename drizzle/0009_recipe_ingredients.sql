CREATE TABLE IF NOT EXISTS "marmitaria"."recipe_ingredients" (
  "id" serial PRIMARY KEY NOT NULL,
  "companyId" integer NOT NULL,
  "menuItemId" integer NOT NULL,
  "inventoryItemId" integer NOT NULL,
  "quantity" numeric(12, 3) NOT NULL,
  "unit" varchar(20) NOT NULL,
  "lossPercent" numeric(5, 2),
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "recipe_ingredients_item_unique" UNIQUE ("menuItemId", "inventoryItemId")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_ingredients_company_idx" ON "marmitaria"."recipe_ingredients" USING btree ("companyId");
