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
  if (user.name !== undefined) { values.name = user.name ?? null; updateSet.name = values.name; }
  if (user.email !== undefined) { values.email = user.email ?? null; updateSet.email = values.email; }
  if (user.loginMethod !== undefined) { values.loginMethod = user.loginMethod ?? null; updateSet.loginMethod = values.loginMethod; }
  if (user.companyId !== undefined) { values.companyId = user.companyId ?? null; updateSet.companyId = values.companyId; }
  const email = (values.email ?? undefined) as string | undefined;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (email && email.toLowerCase() === ENV.ownerEmail) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.supabaseUserId, set: updateSet });
}

export async function getUserBySupabaseId(supabaseUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.supabaseUserId, supabaseUserId)).limit(1);
  return result[0];
}

export async function listActiveMenu(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ item: menuItems, category: menuCategories }).from(menuItems)
    .leftJoin(menuCategories, eq(menuItems.categoryId, menuCategories.id))
    .where(and(eq(menuItems.companyId, companyId), eq(menuItems.active, true), eq(menuCategories.active, true)))
    .orderBy(menuCategories.sortOrder, menuItems.name);
}

export async function listRecentOrders(companyId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ order: orders, customer: customers }).from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.companyId, companyId))
    .orderBy(desc(orders.createdAt)).limit(limit);
}

export async function createCustomerOrder(companyId: number, input: { name: string; phone: string; address: string; paymentMethod?: string; subtotal: number; deliveryFee: number; total: number; notes?: string; items: Array<{ menuItemId: number; itemName: string; quantity: number; unitPrice: number; observation?: string }> }) {
  const db = await getDb();
  if (!db) return { orderId: null, persisted: false as const };
  return db.transaction(async (tx) => {
    await tx.insert(customers).values({ companyId, name: input.name, phone: input.phone, address: input.address })
      .onConflictDoUpdate({ target: [customers.companyId, customers.phone], set: { name: input.name, address: input.address, updatedAt: new Date() } });
    const [customer] = await tx.select().from(customers).where(and(eq(customers.companyId, companyId), eq(customers.phone, input.phone))).limit(1);
    if (!customer) throw new Error("Customer could not be created");
    const [insertedOrder] = await tx.insert(orders).values({
      companyId,
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

export async function listCustomerOrders(companyId: number, phone: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ order: orders, customer: customers }).from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orders.companyId, companyId), eq(customers.phone, phone)))
    .orderBy(desc(orders.createdAt)).limit(20);
}

export async function getOrderById(companyId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [order] = await db.select({ order: orders, customer: customers }).from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orders.companyId, companyId), eq(orders.id, id))).limit(1);
  const items = order ? await db.select().from(orderItems).where(eq(orderItems.orderId, id)) : [];
  return order ? { ...order, items } : undefined;
}

export async function getDashboardSummary(companyId: number) {
  const db = await getDb();
  if (!db) return { revenue: 0, orders: 0, averageTicket: 0 };
  const [result] = await db.select({ revenue: sql<number>`coalesce(sum(${orders.total}), 0)`, orderCount: sql<number>`count(*)` })
    .from(orders).where(and(eq(orders.companyId, companyId), eq(orders.paymentStatus, "approved")));
  const revenue = Number(result?.revenue ?? 0);
  const orderCount = Number(result?.orderCount ?? 0);
  return { revenue, orders: orderCount, averageTicket: orderCount ? revenue / orderCount : 0 };
}

export async function listAdminMenu(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(menuItems).where(eq(menuItems.companyId, companyId)).orderBy(menuItems.name);
}

export async function listInventory(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inventoryItems).where(eq(inventoryItems.companyId, companyId)).orderBy(inventoryItems.name);
}

export async function listRecentExpenses(companyId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(expenses).where(eq(expenses.companyId, companyId)).orderBy(desc(expenses.incurredAt)).limit(limit);
}

export const ORDER_STATUS_FLOW = ["received", "preparing", "ready", "out_for_delivery", "delivered"] as const;
export type OrderStatus = (typeof ORDER_STATUS_FLOW)[number];

/** Returns `persisted: false` (no throw) when the order doesn't belong to `companyId`, so a stray/foreign id fails closed. */
export async function advanceOrderStatus(companyId: number, orderId: number, status: OrderStatus) {
  const db = await getDb();
  if (!db) return { orderId, status, persisted: false as const };
  const result = await db.update(orders).set({ status, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.companyId, companyId))).returning({ id: orders.id });
  return { orderId, status, persisted: result.length > 0 };
}

export async function setOrderDelivery(orderId: number, input: { trackingUrl?: string | null; externalDeliveryId?: string | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ ...input, updatedAt: new Date() }).where(eq(orders.id, orderId));
}

export async function setOrderPayment(orderId: number, input: { paymentStatus: "pending" | "approved" | "rejected" | "refunded"; externalPaymentId?: string | null; platformFeeAmount?: string | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set({ ...input, updatedAt: new Date() }).where(eq(orders.id, orderId));
}

export async function findOrderByExternalPaymentId(companyId: number, externalPaymentId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [order] = await db.select().from(orders).where(and(eq(orders.companyId, companyId), eq(orders.externalPaymentId, externalPaymentId))).limit(1);
  return order;
}

// --- Integration settings (Mercado Pago, Uber Direct, Lalamove, own courier, messaging) ---
// Scoped per company. `credentials` are stored encrypted (server/_core/crypto.ts) and never returned to the client.

export type IntegrationProvider = "mercadopago" | "uber_direct" | "lalamove" | "own_courier" | "messaging";

export async function getIntegrationSettings(companyId: number, provider: IntegrationProvider): Promise<IntegrationSettings | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(integrationSettings).where(and(eq(integrationSettings.companyId, companyId), eq(integrationSettings.provider, provider))).limit(1);
  return row;
}

export async function getIntegrationCredentials<T = Record<string, unknown>>(companyId: number, provider: IntegrationProvider): Promise<T | undefined> {
  const row = await getIntegrationSettings(companyId, provider);
  if (!row?.connected || !row.credentials) return undefined;
  try {
    return decryptJson<T>(row.credentials);
  } catch (error) {
    console.error(`[Integrations] Failed to decrypt credentials for company ${companyId} / ${provider}:`, error);
    return undefined;
  }
}

export async function saveIntegrationCredentials(companyId: number, provider: IntegrationProvider, credentials: Record<string, unknown>, metadata?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const encrypted = encryptJson(credentials);
  const now = new Date();
  await db.insert(integrationSettings).values({
    companyId,
    provider,
    connected: true,
    credentials: encrypted,
    metadata: metadata ? JSON.stringify(metadata) : null,
    connectedAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [integrationSettings.companyId, integrationSettings.provider],
    set: { connected: true, credentials: encrypted, metadata: metadata ? JSON.stringify(metadata) : null, connectedAt: now, updatedAt: now },
  });
}

export async function disconnectIntegration(companyId: number, provider: IntegrationProvider) {
  const db = await getDb();
  if (!db) return;
  await db.update(integrationSettings).set({ connected: false, credentials: null, updatedAt: new Date() })
    .where(and(eq(integrationSettings.companyId, companyId), eq(integrationSettings.provider, provider)));
}

export async function getIntegrationsStatus(companyId: number) {
  const db = await getDb();
  if (!db) return { mercadopago: false, uber_direct: false, lalamove: false, own_courier: false, messaging: false };
  const rows = await db.select({ provider: integrationSettings.provider, connected: integrationSettings.connected }).from(integrationSettings)
    .where(eq(integrationSettings.companyId, companyId));
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  return {
    mercadopago: byProvider.get("mercadopago")?.connected ?? false,
    uber_direct: byProvider.get("uber_direct")?.connected ?? false,
    lalamove: byProvider.get("lalamove")?.connected ?? false,
    own_courier: byProvider.get("own_courier")?.connected ?? false,
    messaging: byProvider.get("messaging")?.connected ?? false,
  };
}

/** Which delivery provider (if any) is active for the company — used to dispatch on order-ready. */
export async function getActiveDeliveryProvider(companyId: number): Promise<Exclude<IntegrationProvider, "mercadopago" | "messaging"> | undefined> {
  const status = await getIntegrationsStatus(companyId);
  if (status.uber_direct) return "uber_direct";
  if (status.lalamove) return "lalamove";
  if (status.own_courier) return "own_courier";
  return undefined;
}
