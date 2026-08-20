CREATE TYPE "public"."integration_provider" AS ENUM('mercadopago', 'uber_direct', 'messaging');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_type" AS ENUM('in', 'out', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('received', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'approved', 'rejected', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"address" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" varchar(200) NOT NULL,
	"category" varchar(80) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"incurredAt" timestamp NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"credentials" text,
	"metadata" text,
	"connectedAt" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_settings_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"currentQuantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"minimumQuantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"costPerUnit" numeric(10, 2) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventoryItemId" integer NOT NULL,
	"type" "inventory_movement_type" NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"reason" varchar(160) NOT NULL,
	"occurredAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
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
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"menuItemId" integer NOT NULL,
	"itemName" varchar(160) NOT NULL,
	"quantity" integer NOT NULL,
	"unitPrice" numeric(10, 2) NOT NULL,
	"observation" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"customerId" integer NOT NULL,
	"status" "order_status" DEFAULT 'received' NOT NULL,
	"paymentStatus" "payment_status" DEFAULT 'pending' NOT NULL,
	"paymentMethod" varchar(40),
	"subtotal" numeric(10, 2) NOT NULL,
	"deliveryFee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"notes" text,
	"trackingUrl" text,
	"externalPaymentId" varchar(120),
	"externalDeliveryId" varchar(120),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"supabaseUserId" uuid NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_supabaseUserId_unique" UNIQUE("supabaseUserId")
);
--> statement-breakpoint
CREATE INDEX "menu_items_category_idx" ON "menu_items" USING btree ("categoryId");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("createdAt");