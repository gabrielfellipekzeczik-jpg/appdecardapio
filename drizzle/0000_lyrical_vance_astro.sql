CREATE SCHEMA IF NOT EXISTS "marmitaria";--> statement-breakpoint
CREATE TYPE "marmitaria"."company_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "marmitaria"."integration_provider" AS ENUM('mercadopago', 'uber_direct', 'lalamove', 'own_courier', 'messaging');--> statement-breakpoint
CREATE TYPE "marmitaria"."inventory_movement_type" AS ENUM('in', 'out', 'adjustment');--> statement-breakpoint
CREATE TYPE "marmitaria"."order_status" AS ENUM('received', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "marmitaria"."payment_status" AS ENUM('pending', 'approved', 'rejected', 'refunded');--> statement-breakpoint
CREATE TYPE "marmitaria"."storefront_template" AS ENUM('classic', 'modern', 'cover', 'premium');--> statement-breakpoint
CREATE TYPE "marmitaria"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "marmitaria"."companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(60) NOT NULL,
	"name" varchar(160) NOT NULL,
	"tagline" text,
	"logoUrl" text,
	"heroImageUrl" text,
	"primaryColor" varchar(20),
	"templateId" "marmitaria"."storefront_template" DEFAULT 'classic' NOT NULL,
	"pickupAddress" text,
	"status" "marmitaria"."company_status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "marmitaria"."customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"address" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_company_phone_unique" UNIQUE("companyId","phone")
);
--> statement-breakpoint
CREATE TABLE "marmitaria"."expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"description" varchar(200) NOT NULL,
	"category" varchar(80) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"incurredAt" timestamp NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marmitaria"."integration_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"provider" "marmitaria"."integration_provider" NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"credentials" text,
	"metadata" text,
	"connectedAt" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_settings_company_provider_unique" UNIQUE("companyId","provider")
);
--> statement-breakpoint
CREATE TABLE "marmitaria"."inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"currentQuantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"minimumQuantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"costPerUnit" numeric(10, 2) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marmitaria"."inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventoryItemId" integer NOT NULL,
	"type" "marmitaria"."inventory_movement_type" NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"reason" varchar(160) NOT NULL,
	"occurredAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marmitaria"."menu_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marmitaria"."menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"categoryId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"imageUrl" text,
	"active" boolean DEFAULT true NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marmitaria"."order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"menuItemId" integer NOT NULL,
	"itemName" varchar(160) NOT NULL,
	"quantity" integer NOT NULL,
	"unitPrice" numeric(10, 2) NOT NULL,
	"observation" text
);
--> statement-breakpoint
CREATE TABLE "marmitaria"."orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"customerId" integer NOT NULL,
	"status" "marmitaria"."order_status" DEFAULT 'received' NOT NULL,
	"paymentStatus" "marmitaria"."payment_status" DEFAULT 'pending' NOT NULL,
	"paymentMethod" varchar(40),
	"subtotal" numeric(10, 2) NOT NULL,
	"deliveryFee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"platformFeeAmount" numeric(10, 2),
	"notes" text,
	"trackingUrl" text,
	"externalPaymentId" varchar(120),
	"externalDeliveryId" varchar(120),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marmitaria"."users" (
	"id" serial PRIMARY KEY NOT NULL,
	"supabaseUserId" uuid NOT NULL,
	"companyId" integer,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "marmitaria"."user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_supabaseUserId_unique" UNIQUE("supabaseUserId")
);
--> statement-breakpoint
CREATE INDEX "marmitaria"."expenses_company_idx" ON "marmitaria"."expenses" USING btree ("companyId");--> statement-breakpoint
CREATE INDEX "marmitaria"."inventory_items_company_idx" ON "marmitaria"."inventory_items" USING btree ("companyId");--> statement-breakpoint
CREATE INDEX "marmitaria"."menu_categories_company_idx" ON "marmitaria"."menu_categories" USING btree ("companyId");--> statement-breakpoint
CREATE INDEX "marmitaria"."menu_items_category_idx" ON "marmitaria"."menu_items" USING btree ("categoryId");--> statement-breakpoint
CREATE INDEX "marmitaria"."menu_items_company_idx" ON "marmitaria"."menu_items" USING btree ("companyId");--> statement-breakpoint
CREATE INDEX "marmitaria"."orders_status_idx" ON "marmitaria"."orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marmitaria"."orders_created_idx" ON "marmitaria"."orders" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "marmitaria"."orders_company_idx" ON "marmitaria"."orders" USING btree ("companyId");