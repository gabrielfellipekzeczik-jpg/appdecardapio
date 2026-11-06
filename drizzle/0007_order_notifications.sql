-- Notificações de pedido (WhatsApp/e-mail) + consulta de pedidos pelo e-mail do cliente.
-- Rode no Supabase > SQL Editor (schema marmitaria). É seguro rodar mais de uma vez.
ALTER TABLE "marmitaria"."orders" ADD COLUMN IF NOT EXISTS "customerEmail" varchar(255);--> statement-breakpoint
ALTER TABLE "marmitaria"."orders" ADD COLUMN IF NOT EXISTS "customerTrackingTokenEnc" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_customer_email_idx" ON "marmitaria"."orders" (lower("customerEmail"));--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marmitaria"."order_notifications" (
  "id" serial PRIMARY KEY,
  "companyId" integer NOT NULL,
  "orderId" integer NOT NULL,
  "event" varchar(24) NOT NULL,
  "channel" varchar(12) NOT NULL,
  "recipient" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "status" varchar(12) NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "error" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "sentAt" timestamp with time zone,
  CONSTRAINT "order_notifications_unique" UNIQUE ("orderId", "event", "channel")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_notifications_pending_idx" ON "marmitaria"."order_notifications" ("companyId", "channel", "status");--> statement-breakpoint
GRANT ALL ON "marmitaria"."order_notifications" TO service_role;--> statement-breakpoint
GRANT ALL ON SEQUENCE "marmitaria"."order_notifications_id_seq" TO service_role;
