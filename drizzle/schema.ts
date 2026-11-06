import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSchema,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import type { OpeningHours } from "../shared/store-rules";

export const marmitaria = pgSchema("marmitaria");

export const companyStatusEnum = marmitaria.enum("company_status", [
  "active",
  "suspended",
]);
export const storefrontTemplateEnum = marmitaria.enum("storefront_template", [
  "classic",
  "modern",
  "cover",
  "premium",
]);

/** One row per tenant restaurant/marmitaria on the platform. */
export const companies = marmitaria.table("companies", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  tagline: text("tagline"),
  logoUrl: text("logoUrl"),
  heroImageUrl: text("heroImageUrl"),
  primaryColor: varchar("primaryColor", { length: 20 }),
  templateId: storefrontTemplateEnum("templateId").default("classic").notNull(),
  pickupAddress: text("pickupAddress"),
  openingHours: jsonb("openingHours").$type<OpeningHours>(),
  acceptsCashOnDelivery: boolean("acceptsCashOnDelivery")
    .default(false)
    .notNull(),
  pickupEnabled: boolean("pickupEnabled").default(false).notNull(),
  status: companyStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const userRoleEnum = marmitaria.enum("user_role", ["user", "admin"]);

export const users = marmitaria.table("users", {
  id: serial("id").primaryKey(),
  supabaseUserId: uuid("supabaseUserId").notNull().unique(),
  companyId: integer("companyId"),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const menuCategories = marmitaria.table(
  "menu_categories",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    sortOrder: integer("sortOrder").default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    companyIdx: index("menu_categories_company_idx").on(table.companyId),
  })
);

export const menuItems = marmitaria.table(
  "menu_items",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    categoryId: integer("categoryId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    imageUrl: text("imageUrl"),
    active: boolean("active").default(true).notNull(),
    featured: boolean("featured").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    categoryIdx: index("menu_items_category_idx").on(table.categoryId),
    companyIdx: index("menu_items_company_idx").on(table.companyId),
  })
);

export const customers = marmitaria.table(
  "customers",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    address: text("address"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    companyPhoneUnique: unique("customers_company_phone_unique").on(
      table.companyId,
      table.phone
    ),
  })
);

export const orderStatusEnum = marmitaria.enum("order_status", [
  "received",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);
export const paymentStatusEnum = marmitaria.enum("payment_status", [
  "pending",
  "approved",
  "rejected",
  "refunded",
]);

export const orders = marmitaria.table(
  "orders",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    customerId: integer("customerId").notNull(),
    status: orderStatusEnum("status").default("received").notNull(),
    paymentStatus: paymentStatusEnum("paymentStatus")
      .default("pending")
      .notNull(),
    paymentMethod: varchar("paymentMethod", { length: 40 }),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    deliveryFee: numeric("deliveryFee", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    deliveryAddress: text("deliveryAddress"),
    platformFeeAmount: numeric("platformFeeAmount", {
      precision: 10,
      scale: 2,
    }),
    notes: text("notes"),
    trackingUrl: text("trackingUrl"),
    externalPaymentId: varchar("externalPaymentId", { length: 120 }),
    paymentApprovedAt: timestamp("paymentApprovedAt", { withTimezone: true }),
    externalDeliveryId: varchar("externalDeliveryId", { length: 120 }),
    deliveryQuoteId: varchar("deliveryQuoteId", { length: 160 }),
    customerAccessTokenHash: varchar("customerAccessTokenHash", { length: 64 }),
    customerTrackingTokenHash: varchar("customerTrackingTokenHash", {
      length: 64,
    }),
    driverTrackingTokenHash: varchar("driverTrackingTokenHash", { length: 64 }),
    trackingLatitude: numeric("trackingLatitude", { precision: 10, scale: 7 }),
    trackingLongitude: numeric("trackingLongitude", {
      precision: 10,
      scale: 7,
    }),
    trackingUpdatedAt: timestamp("trackingUpdatedAt", { withTimezone: true }),
    customerEmail: varchar("customerEmail", { length: 255 }),
    customerTrackingTokenEnc: text("customerTrackingTokenEnc"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    statusIdx: index("orders_status_idx").on(table.status),
    createdIdx: index("orders_created_idx").on(table.createdAt),
    companyIdx: index("orders_company_idx").on(table.companyId),
    customerTrackingIdx: index("orders_customer_tracking_token_idx").on(
      table.customerTrackingTokenHash
    ),
    driverTrackingIdx: index("orders_driver_tracking_token_idx").on(
      table.driverTrackingTokenHash
    ),
  })
);

export const orderItems = marmitaria.table("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  menuItemId: integer("menuItemId").notNull(),
  itemName: varchar("itemName", { length: 160 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unitPrice", { precision: 10, scale: 2 }).notNull(),
  observation: text("observation"),
});

export const expenses = marmitaria.table(
  "expenses",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    description: varchar("description", { length: 200 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    incurredAt: timestamp("incurredAt").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    companyIdx: index("expenses_company_idx").on(table.companyId),
    companyDateIdx: index("expenses_company_date_idx").on(
      table.companyId,
      table.incurredAt
    ),
  })
);

export const inventoryItems = marmitaria.table(
  "inventory_items",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    unit: varchar("unit", { length: 20 }).notNull(),
    currentQuantity: numeric("currentQuantity", { precision: 12, scale: 3 })
      .default("0")
      .notNull(),
    minimumQuantity: numeric("minimumQuantity", { precision: 12, scale: 3 })
      .default("0")
      .notNull(),
    costPerUnit: numeric("costPerUnit", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    active: boolean("active").default(true).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    companyIdx: index("inventory_items_company_idx").on(table.companyId),
  })
);

/** Ficha técnica: quanto de cada insumo vai em uma porção pronta de um prato. */
export const recipeIngredients = marmitaria.table(
  "recipe_ingredients",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    menuItemId: integer("menuItemId").notNull(),
    inventoryItemId: integer("inventoryItemId").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unit: varchar("unit", { length: 20 }).notNull(),
    lossPercent: numeric("lossPercent", { precision: 5, scale: 2 }),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    itemUnique: unique("recipe_ingredients_item_unique").on(
      table.menuItemId,
      table.inventoryItemId
    ),
    companyIdx: index("recipe_ingredients_company_idx").on(table.companyId),
  })
);

export const inventoryMovementTypeEnum = marmitaria.enum(
  "inventory_movement_type",
  ["in", "out", "adjustment"]
);

export const inventoryMovements = marmitaria.table(
  "inventory_movements",
  {
    id: serial("id").primaryKey(),
    inventoryItemId: integer("inventoryItemId").notNull(),
    type: inventoryMovementTypeEnum("type").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    reason: varchar("reason", { length: 160 }).notNull(),
    occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  },
  table => ({
    itemDateIdx: index("inventory_movements_item_date_idx").on(
      table.inventoryItemId,
      table.occurredAt
    ),
  })
);

export const integrationProviderEnum = marmitaria.enum("integration_provider", [
  "mercadopago",
  "uber_direct",
  "lalamove",
  "own_courier",
  "messaging",
]);

/**
 * Persists integration state per company. `credentials` holds an AES-GCM
 * encrypted JSON blob (tokens/secrets); `metadata` holds non-secret display
 * info (e.g. connected seller email, public key). Never return `credentials`
 * to the client.
 */
export const integrationSettings = marmitaria.table(
  "integration_settings",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    provider: integrationProviderEnum("provider").notNull(),
    connected: boolean("connected").default(false).notNull(),
    credentials: text("credentials"),
    metadata: text("metadata"),
    connectedAt: timestamp("connectedAt"),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => ({
    companyProviderUnique: unique(
      "integration_settings_company_provider_unique"
    ).on(table.companyId, table.provider),
  })
);

/**
 * Estado do bot de atendimento no WhatsApp (uma linha por empresa).
 * O app (Vercel) grava `desired`/`aiEnabled`/`instructions`; o serviço do bot (pasta /bot) grava
 * `status`/`qr`/`phone`/`error`/`heartbeatAt`. Assim os dois conversam só pelo banco.
 */
export const whatsappBots = marmitaria.table("whatsapp_bots", {
  companyId: integer("companyId").primaryKey(),
  desired: varchar("desired", { length: 16 }).default("disconnected").notNull(),
  status: varchar("status", { length: 16 }).default("idle").notNull(),
  qr: text("qr"),
  phone: varchar("phone", { length: 32 }),
  error: text("error"),
  aiEnabled: boolean("aiEnabled").default(true).notNull(),
  instructions: text("instructions"),
  heartbeatAt: timestamp("heartbeatAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/** Fila/registro de avisos ao cliente (WhatsApp é enviado pelo serviço /bot; e-mail pelo servidor). */
export const orderNotifications = marmitaria.table("order_notifications", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  orderId: integer("orderId").notNull(),
  event: varchar("event", { length: 24 }).notNull(),
  channel: varchar("channel", { length: 12 }).notNull(),
  recipient: varchar("recipient", { length: 255 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 12 }).default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  error: text("error"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sentAt", { withTimezone: true }),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MenuItem = typeof menuItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type IntegrationSettings = typeof integrationSettings.$inferSelect;
export type WhatsappBot = typeof whatsappBots.$inferSelect;
