import { boolean, index, integer, numeric, pgEnum, pgTable, serial, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

export const companyStatusEnum = pgEnum("company_status", ["active", "suspended"]);
export const storefrontTemplateEnum = pgEnum("storefront_template", ["classic", "modern"]);

/** One row per tenant restaurant/marmitaria on the platform. */
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 60 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  tagline: text("tagline"),
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 20 }),
  templateId: storefrontTemplateEnum("templateId").default("classic").notNull(),
  pickupAddress: text("pickupAddress"),
  status: companyStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const users = pgTable("users", {
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

export const menuCategories = pgTable("menu_categories", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ companyIdx: index("menu_categories_company_idx").on(table.companyId) }));

export const menuItems = pgTable("menu_items", {
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
}, (table) => ({ categoryIdx: index("menu_items_category_idx").on(table.categoryId), companyIdx: index("menu_items_company_idx").on(table.companyId) }));

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  address: text("address"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ companyPhoneUnique: unique("customers_company_phone_unique").on(table.companyId, table.phone) }));

export const orderStatusEnum = pgEnum("order_status", ["received", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "approved", "rejected", "refunded"]);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  customerId: integer("customerId").notNull(),
  status: orderStatusEnum("status").default("received").notNull(),
  paymentStatus: paymentStatusEnum("paymentStatus").default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 40 }),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: numeric("deliveryFee", { precision: 10, scale: 2 }).default("0").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  platformFeeAmount: numeric("platformFeeAmount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  trackingUrl: text("trackingUrl"),
  externalPaymentId: varchar("externalPaymentId", { length: 120 }),
  externalDeliveryId: varchar("externalDeliveryId", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ statusIdx: index("orders_status_idx").on(table.status), createdIdx: index("orders_created_idx").on(table.createdAt), companyIdx: index("orders_company_idx").on(table.companyId) }));

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  menuItemId: integer("menuItemId").notNull(),
  itemName: varchar("itemName", { length: 160 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unitPrice", { precision: 10, scale: 2 }).notNull(),
  observation: text("observation"),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  description: varchar("description", { length: 200 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  incurredAt: timestamp("incurredAt").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ companyIdx: index("expenses_company_idx").on(table.companyId) }));

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  currentQuantity: numeric("currentQuantity", { precision: 12, scale: 3 }).default("0").notNull(),
  minimumQuantity: numeric("minimumQuantity", { precision: 12, scale: 3 }).default("0").notNull(),
  costPerUnit: numeric("costPerUnit", { precision: 10, scale: 2 }).default("0").notNull(),
  active: boolean("active").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ companyIdx: index("inventory_items_company_idx").on(table.companyId) }));

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", ["in", "out", "adjustment"]);

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  inventoryItemId: integer("inventoryItemId").notNull(),
  type: inventoryMovementTypeEnum("type").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  reason: varchar("reason", { length: 160 }).notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
});

export const integrationProviderEnum = pgEnum("integration_provider", ["mercadopago", "uber_direct", "lalamove", "own_courier", "messaging"]);

/**
 * Persists integration state per company. `credentials` holds an AES-GCM
 * encrypted JSON blob (tokens/secrets); `metadata` holds non-secret display
 * info (e.g. connected seller email, public key). Never return `credentials`
 * to the client.
 */
export const integrationSettings = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  provider: integrationProviderEnum("provider").notNull(),
  connected: boolean("connected").default(false).notNull(),
  credentials: text("credentials"),
  metadata: text("metadata"),
  connectedAt: timestamp("connectedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ companyProviderUnique: unique("integration_settings_company_provider_unique").on(table.companyId, table.provider) }));

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MenuItem = typeof menuItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type IntegrationSettings = typeof integrationSettings.$inferSelect;
