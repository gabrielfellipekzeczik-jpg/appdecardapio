-- Repara bancos existentes que ainda não receberam as colunas destas versões.
ALTER TABLE "marmitaria"."orders" ADD COLUMN IF NOT EXISTS "paymentApprovedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "marmitaria"."orders" ADD COLUMN IF NOT EXISTS "deliveryQuoteId" varchar(160);
