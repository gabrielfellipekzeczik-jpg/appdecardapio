import { boolean, index, integer, numeric, pgEnum, pgTable, serial, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  supabaseUserId: uuid("supabaseUserId").notNull().unique(),
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
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  categoryId: integer("categoryId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("imageUrl"),
  active: boolean("active").default(true).notNull(),
  featured: boolean("featured").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ categoryIdx: index("menu_items_category_idx").on(table.categoryId) }));

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull().unique(),
  address: text("address"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const orderStatusEnum = pgEnum("order_status", ["received", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "approved", "rejected", "refunded"]);

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customerId").notNull(),
  status: orderStatusEnum("status").default("received").notNull(),
  paymentStatus: paymentStatusEnum("paymentStatus").default("pending").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 40 }),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: numeric("deliveryFee", { precision: 10, scale: 2 }).default("0").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  trackingUrl: text("trackingUrl"),
  externalPaymentId: varchar("externalPaymentId", { length: 120 }),
  externalDeliveryId: varchar("externalDeliveryId", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({ statusIdx: index("orders_status_idx").on(table.status), createdIdx: index("orders_created_idx").on(table.createdAt) }));

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
  description: varchar("description", { length: 200 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  incurredAt: timestamp("incurredAt").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  currentQuantity: numeric("currentQuantity", { precision: 12, scale: 3 }).default("0").notNull(),
  minimumQuantity: numeric("minimumQuantity", { precision: 12, scale: 3 }).default("0").notNull(),
  costPerUnit: numeric("costPerUnit", { precision: 10, scale: 2 }).default("0").notNull(),
  active: boolean("active").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", ["in", "out", "adjustment"]);

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  inventoryItemId: integer("inventoryItemId").notNull(),
  type: inventoryMovementTypeEnum("type").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  reason: varchar("reason", { length: 160 }).notNull(),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
});

export const integrationProviderEnum = pgEnum("integration_provider", ["mercadopago", "uber_direct", "messaging"]);

/**
 * Persists integration state for Super Admin. `credentials` holds an
 * AES-GCM encrypted JSON blob (tokens/secrets); `metadata` holds non-secret
 * display info (e.g. connected seller email, public key). Never return
 * `credentials` to the client.
 */
export const integrationSettings = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  provider: integrationProviderEnum("provider").notNull().unique(),
  connected: boolean("connected").default(false).notNull(),
  credentials: text("credentials"),
  metadata: text("metadata"),
  connectedAt: timestamp("connectedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MenuItem = typeof menuItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type IntegrationSettings = typeof integrationSettings.$inferSelect;
