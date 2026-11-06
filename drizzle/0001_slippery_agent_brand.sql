CREATE TABLE IF NOT EXISTS "marmitaria"."whatsapp_bots" (
	"companyId" integer PRIMARY KEY NOT NULL,
	"desired" varchar(16) DEFAULT 'disconnected' NOT NULL,
	"status" varchar(16) DEFAULT 'idle' NOT NULL,
	"qr" text,
	"phone" varchar(32),
	"error" text,
	"aiEnabled" boolean DEFAULT true NOT NULL,
	"instructions" text,
	"heartbeatAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
GRANT ALL ON "marmitaria"."whatsapp_bots" TO service_role;
