import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  InsertUser, IntegrationSettings, menuCategories, menuItems, orders, users, customers, orderItems,
  inventoryItems, expenses, integrationSettings,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { decryptJson, encryptJson } from "./_core/crypto";

let _db: ReturnType<typeof drizzle> | null = null;
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL, { max: 1 });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.supabaseUserId) throw new Error("User supabaseUserId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { supabaseUserId: user.supabaseUserId };
  const updateSet: Record<string, unknown> = {};
  (["name", "email", "loginMethod"] as const).forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  const email = (values.email ?? undefined) as string | undefined;
  if (user.role !== undefined || (email && email.toLowerCase() === ENV.ownerEmail)) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.supabaseUserId, set: updateSet });
}

export async function getUserBySupabaseId(supabaseUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.supabaseUserId, supabaseUserId)).limit(1);
  return result[0];
}

export async function listActiveMenu() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ item: menuItems, category: menuCategories }).from(menuItems).leftJoin(menuCategories, eq(menuItems.categoryId, menuCategories.id)).where(and(eq(menuItems.active, true), eq(menuCategories.active, true))).orderBy(menuCategories.sortOrder, menuItems.name);
}

export async function listRecentOrders(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ order: orders, customer: customers }).from(orders).leftJoin(customers, eq(orders.customerId, customers.id)).orderBy(desc(orders.createdAt)).limit(limit);
}

export async function createCustomerOrder(input: { name: string; phone: string; address: string; paymentMethod?: string; subtotal: number; deliveryFee: number; total: number; notes?: string; items: Array<{ menuItemId: number; itemName: string; quantity: number; unitPrice: number; observation?: string }> }) {
  const db = await getDb();
  if (!db) return { orderId: null, persisted: false as const };
  return db.transaction(async (tx) => {
    await tx.insert(customers).values({ name: input.name, phone: input.phone, address: input.address })
      .onConflictDoUpdate({ target: customers.phone, set: { name: input.name, address: input.address, updatedAt: new Date() } });
    const [customer] = await tx.select().from(customers).where(eq(customers.phone, input.phone)).limit(1);
    if (!customer) throw new Error("Customer could not be created");
    const [insertedOrder] = await tx.insert(orders).values({
      customerId: customer.id,
      subtotal: input.subtotal.toFixed(2),
      deliveryFee: input.deliveryFee.toFixed(2),
      total: input.total.toFixed(2),
      notes: input.notes,
      paymentMethod: input.paymentMethod ?? "pending",
    }).returning({ id: orders.id });
    const orderId = insertedOrder.id;
    if (input.items.length) await tx.insert(orderItems).values(input.items.map((item) => ({ orderId, menuItemId: item.menuItemId, itemName: item.itemName, quantity: item.quantity, unitPrice: item.unitPrice.toFixed(2), observation: item.observation })));
    return { orderId, persisted: true as const };
  });
}

export async function listCustomerOrders(phone: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ order: orders, customer: customers }).from(orders).innerJoin(customers, eq(orders.customerId, customers.id)).where(eq(customers.phone, phone)).orderBy(desc(orders.createdAt)).limit(20);
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [order] = await db.select({ order: orders, customer: customers }).from(orders).leftJoin(customers, eq(orders.customerId, customers.id)).where(eq(orders.id, id)).limit(1);
  const items = order ? await db.select().from(orderItems).where(eq(orderItems.orderId, id)) : [];
  return order ? { ...order, items } : undefined;
}

export async function getDashboardSummary() {
  const db = await getDb();
  if (!db) return { revenue: 0, orders: 0, averageTicket: 0 };
  const [result] = await db.select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)`, orderCount: sql<number>`count(*)` }).from(orders).where(eq(orders.paymentStatus, "approved"));
  const revenue = Number(result?.revenue ?? 0);
  const orderCount = Number(result?.orderCount ?? 0);
  return { revenue, orders: orderCount, averageTicket: orderCount ? revenue / orderCount : 0 };
}

export async function listAdminMenu() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(menuItems).orderBy(menuItems.name);
}

export async function listInventory() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inventoryItems).orderBy(inventoryItems.name);
}

export async function listRecentExpenses(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenses).orderBy(desc(expenses.incurredAt)).limit(limit);
}

export const ORDER_STATUS_FLOW = ["received", "preparing", "ready", "out_for_delivery", "delivered"] as const;
export type OrderStatus = (typeof ORDER_STATUS_FLOW)[number];

export async function advanceOrderStatus(orderId: number, status: OrderStatus) {
  const db = await getDb();
  if (!db) return { orderId, status, persisted: false as const };
  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, orderId));
  return { orderId, status, persisted: true as const };
}

export async function setOrderDelivery(orderId: number, input: { trackingUrl?: string | null; externalDeliveryId?: string | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ ...input, updatedAt: new Date() }).where(eq(orders.id, orderId));
}

export async function setOrderPayment(orderId: number, input: { paymentStatus: "pending" | "approved" | "rejected" | "refunded"; externalPaymentId?: string | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ ...input, updatedAt: new Date() }).where(eq(orders.id, orderId));
}

export async function findOrderByExternalPaymentId(externalPaymentId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [order] = await db.select().from(orders).where(eq(orders.externalPaymentId, externalPaymentId)).limit(1);
  return order;
}

// --- Integration settings (Mercado Pago, Uber Direct, messaging) ---
// `credentials` are stored encrypted (server/_core/crypto.ts) and never returned to the client.

export type IntegrationProvider = "mercadopago" | "uber_direct" | "messaging";

export async function getIntegrationSettings(provider: IntegrationProvider): Promise<IntegrationSettings | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(integrationSettings).where(eq(integrationSettings.provider, provider)).limit(1);
  return row;
}

export async function getIntegrationCredentials<T = Record<string, unknown>>(provider: IntegrationProvider): Promise<T | undefined> {
  const row = await getIntegrationSettings(provider);
  if (!row?.connected || !row.credentials) return undefined;
  try {
    return decryptJson<T>(row.credentials);
  } catch (error) {
    console.error(`[Integrations] Failed to decrypt credentials for ${provider}:`, error);
    return undefined;
  }
}

export async function saveIntegrationCredentials(provider: IntegrationProvider, credentials: Record<string, unknown>, metadata?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const encrypted = encryptJson(credentials);
  const now = new Date();
  await db.insert(integrationSettings).values({
    provider,
    connected: true,
    credentials: encrypted,
    metadata: metadata ? JSON.stringify(metadata) : null,
    connectedAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: integrationSettings.provider,
    set: { connected: true, credentials: encrypted, metadata: metadata ? JSON.stringify(metadata) : null, connectedAt: now, updatedAt: now },
  });
}

export async function disconnectIntegration(provider: IntegrationProvider) {
  const db = await getDb();
  if (!db) return;
  await db.update(integrationSettings).set({ connected: false, credentials: null, updatedAt: new Date() }).where(eq(integrationSettings.provider, provider));
}

export async function getIntegrationsStatus() {
  const db = await getDb();
  if (!db) return { mercadopago: false, uber_direct: false, messaging: false };
  const rows = await db.select({ provider: integrationSettings.provider, connected: integrationSettings.connected, metadata: integrationSettings.metadata }).from(integrationSettings);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  return {
    mercadopago: byProvider.get("mercadopago")?.connected ?? false,
    uber_direct: byProvider.get("uber_direct")?.connected ?? false,
    messaging: byProvider.get("messaging")?.connected ?? false,
  };
}
