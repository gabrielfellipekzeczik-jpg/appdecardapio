// server/db.ts — queries via Supabase SDK (SUPABASE_SERVICE_ROLE_KEY)
// sem DATABASE_URL. Usa schema "marmitaria" isolado.
import { createClient } from "@supabase/supabase-js";

const SCHEMA = "marmitaria";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = ReturnType<typeof createClient<any, any, any>>;

let _db: DB | null = null;

export function getDb(): DB {
  if (!_db) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios");
    _db = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: SCHEMA },
    });
  }
  return _db;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type User = {
  id: number;
  supabaseUserId: string;
  companyId: number | null;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
};

export type Company = {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string | null;
  templateId: "classic" | "modern" | "cover" | "premium";
  pickupAddress: string | null;
  status: "active" | "suspended";
  mp_connected: boolean;
  mp_fee_percent: number | null;
  createdAt: string;
};

export type MenuItem = {
  id: number;
  companyId: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  active: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MenuCategory = {
  id: number;
  companyId: number;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
};

export type Customer = {
  id: number;
  companyId: number;
  name: string;
  phone: string;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Order = {
  id: number;
  companyId: number;
  customerId: number;
  status: string;
  paymentStatus: "pending" | "approved" | "rejected" | "refunded";
  paymentMethod: string | null;
  subtotal: string;
  deliveryFee: string;
  total: string;
  platformFeeAmount: string | null;
  notes: string | null;
  trackingUrl: string | null;
  externalPaymentId: string | null;
  externalDeliveryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderItem = {
  id: number;
  orderId: number;
  menuItemId: number;
  itemName: string;
  quantity: number;
  unitPrice: string;
  observation: string | null;
};

export type InsertUser = Partial<User> & { supabaseUserId: string };

export type IntegrationSettings = {
  id: number;
  companyId: number;
  provider: string;
  connected: boolean;
  credentials: string | null;
  metadata: string | null;
  connectedAt: string | null;
  updatedAt: string;
};

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.supabaseUserId) throw new Error("supabaseUserId is required");
  const db = getDb();
  const values: Record<string, unknown> = {
    supabaseUserId: user.supabaseUserId,
    lastSignedIn: new Date().toISOString(),
  };
  if (user.name !== undefined) values.name = user.name;
  if (user.email !== undefined) values.email = user.email;
  if (user.loginMethod !== undefined) values.loginMethod = user.loginMethod;
  if (user.companyId !== undefined) values.companyId = user.companyId;
  if (user.role !== undefined) values.role = user.role;

  await db.from("users").upsert(values as Record<string, unknown>, { onConflict: "supabaseUserId" });
}

export async function getUserBySupabaseId(supabaseUserId: string): Promise<User | undefined> {
  const db = getDb();
  const { data } = await db.from("users").select("*").eq("supabaseUserId", supabaseUserId).limit(1).single();
  return (data as User) ?? undefined;
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export async function listActiveMenu(companyId: number) {
  const db = getDb();
  const { data } = await db
    .from("menu_items")
    .select("*, menu_categories(*)")
    .eq("companyId", companyId)
    .eq("active", true)
    .order("name");
  return ((data ?? []) as Array<MenuItem & { menu_categories: MenuCategory | null }>).map((row) => ({
    item: { ...row, menu_categories: undefined } as MenuItem,
    category: row.menu_categories as MenuCategory | null,
  }));
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function listRecentOrders(companyId: number, limit = 20) {
  const db = getDb();
  const { data } = await db
    .from("orders")
    .select("*, customers(*)")
    .eq("companyId", companyId)
    .order("createdAt", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Array<Order & { customers: Customer | null }>).map((row) => ({
    order: { ...row, customers: undefined } as Order,
    customer: row.customers as Customer | null,
  }));
}

export async function createCustomerOrder(companyId: number, input: {
  name: string; phone: string; address: string;
  paymentMethod?: string; subtotal: number; deliveryFee: number; total: number;
  notes?: string;
  items: Array<{ menuItemId: number; itemName: string; quantity: number; unitPrice: number; observation?: string }>;
}) {
  const db = getDb();

  await db.from("customers").upsert(
    { companyId, name: input.name, phone: input.phone, address: input.address, updatedAt: new Date().toISOString() } as Record<string, unknown>,
    { onConflict: "companyId,phone" }
  );
  const { data: customerData } = await db.from("customers")
    .select("id").eq("companyId", companyId).eq("phone", input.phone).limit(1).single();
  const customer = customerData as { id: number } | null;
  if (!customer) return { orderId: null, persisted: false as const };

  const { data: orderData } = await db.from("orders").insert({
    companyId,
    customerId: customer.id,
    subtotal: input.subtotal.toFixed(2),
    deliveryFee: input.deliveryFee.toFixed(2),
    total: input.total.toFixed(2),
    notes: input.notes,
    paymentMethod: input.paymentMethod ?? "pending",
  } as Record<string, unknown>).select("id").single();
  const order = orderData as { id: number } | null;

  if (!order) return { orderId: null, persisted: false as const };

  if (input.items.length) {
    await db.from("order_items").insert(
      input.items.map((item) => ({
        orderId: order.id,
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        observation: item.observation,
      })) as Record<string, unknown>[]
    );
  }

  return { orderId: order.id, persisted: true as const };
}

export async function listCustomerOrders(companyId: number, phone: string) {
  const db = getDb();
  const { data: customerData } = await db.from("customers")
    .select("id").eq("companyId", companyId).eq("phone", phone).limit(1).single();
  const customer = customerData as { id: number } | null;
  if (!customer) return [];
  const { data } = await db.from("orders")
    .select("*, customers(*)")
    .eq("companyId", companyId)
    .eq("customerId", customer.id)
    .order("createdAt", { ascending: false })
    .limit(20);
  return ((data ?? []) as Array<Order & { customers: Customer | null }>).map((row) => ({
    order: { ...row, customers: undefined } as Order,
    customer: row.customers as Customer | null,
  }));
}

export async function getOrderById(companyId: number, id: number) {
  const db = getDb();
  const { data: orderRow } = await db.from("orders")
    .select("*, customers(*)").eq("companyId", companyId).eq("id", id).limit(1).single();
  if (!orderRow) return undefined;
  const row = orderRow as Order & { customers: Customer | null };
  const { data: itemsData } = await db.from("order_items").select("*").eq("orderId", id);
  const items = (itemsData ?? []) as OrderItem[];
  return { order: { ...row, customers: undefined } as Order, customer: row.customers, items };
}

export async function getDashboardSummary(companyId: number) {
  const db = getDb();
  const { data } = await db.from("orders")
    .select("total").eq("companyId", companyId).eq("paymentStatus", "approved");
  const rows = (data ?? []) as Array<{ total: string }>;
  const revenue = rows.reduce((sum, r) => sum + Number(r.total), 0);
  const orderCount = rows.length;
  return { revenue, orders: orderCount, averageTicket: orderCount ? revenue / orderCount : 0 };
}

export async function listAdminMenu(companyId: number) {
  const db = getDb();
  const { data } = await db.from("menu_items").select("*").eq("companyId", companyId).order("name");
  return (data ?? []) as MenuItem[];
}

export async function listInventory(companyId: number) {
  const db = getDb();
  const { data } = await db.from("inventory_items").select("*").eq("companyId", companyId).order("name");
  return (data ?? []) as Record<string, unknown>[];
}

export async function listRecentExpenses(companyId: number, limit = 50) {
  const db = getDb();
  const { data } = await db.from("expenses").select("*").eq("companyId", companyId)
    .order("incurredAt", { ascending: false }).limit(limit);
  return (data ?? []) as Record<string, unknown>[];
}

export const ORDER_STATUS_FLOW = ["received", "preparing", "ready", "out_for_delivery", "delivered"] as const;
export type OrderStatus = (typeof ORDER_STATUS_FLOW)[number];

export async function advanceOrderStatus(companyId: number, orderId: number, status: OrderStatus) {
  const db = getDb();
  const { data } = await db.from("orders")
    .update({ status, updatedAt: new Date().toISOString() } as Record<string, unknown>)
    .eq("id", orderId).eq("companyId", companyId)
    .select("id");
  return { orderId, status, persisted: ((data ?? []) as unknown[]).length > 0 };
}

export async function setOrderDelivery(orderId: number, input: { trackingUrl?: string | null; externalDeliveryId?: string | null }) {
  const db = getDb();
  await db.from("orders").update({ ...input, updatedAt: new Date().toISOString() } as Record<string, unknown>).eq("id", orderId);
}

export async function setOrderPayment(orderId: number, input: { paymentStatus: "pending" | "approved" | "rejected" | "refunded"; externalPaymentId?: string | null; platformFeeAmount?: string | null }) {
  const db = getDb();
  await db.from("orders").update({ ...input, updatedAt: new Date().toISOString() } as Record<string, unknown>).eq("id", orderId);
}

export async function findOrderByExternalPaymentId(companyId: number, externalPaymentId: string) {
  const db = getDb();
  const { data } = await db.from("orders")
    .select("*").eq("companyId", companyId).eq("externalPaymentId", externalPaymentId).limit(1).single();
  return (data as Order) ?? undefined;
}

// ─── Integrations ────────────────────────────────────────────────────────────

export type IntegrationProvider = "mercadopago" | "uber_direct" | "lalamove" | "own_courier" | "messaging";

import { decryptJson, encryptJson } from "./_core/crypto";

export async function getIntegrationSettings(companyId: number, provider: IntegrationProvider): Promise<IntegrationSettings | undefined> {
  const db = getDb();
  const { data } = await db.from("integration_settings")
    .select("*").eq("companyId", companyId).eq("provider", provider).limit(1).single();
  return (data as IntegrationSettings) ?? undefined;
}

export async function getIntegrationCredentials<T = Record<string, unknown>>(companyId: number, provider: IntegrationProvider): Promise<T | undefined> {
  const row = await getIntegrationSettings(companyId, provider);
  if (!row?.connected || !row.credentials) return undefined;
  try { return decryptJson<T>(row.credentials); }
  catch (error) {
    console.error(`[Integrations] Failed to decrypt credentials for company ${companyId}/${provider}:`, error);
    return undefined;
  }
}

export async function saveIntegrationCredentials(companyId: number, provider: IntegrationProvider, credentials: Record<string, unknown>, metadata?: Record<string, unknown>) {
  const db = getDb();
  const encrypted = encryptJson(credentials);
  const now = new Date().toISOString();
  await db.from("integration_settings").upsert({
    companyId, provider, connected: true,
    credentials: encrypted,
    metadata: metadata ? JSON.stringify(metadata) : null,
    connectedAt: now, updatedAt: now,
  } as Record<string, unknown>, { onConflict: "companyId,provider" });
}

export async function disconnectIntegration(companyId: number, provider: IntegrationProvider) {
  const db = getDb();
  await db.from("integration_settings")
    .update({ connected: false, credentials: null, updatedAt: new Date().toISOString() } as Record<string, unknown>)
    .eq("companyId", companyId).eq("provider", provider);
}

export async function getIntegrationsStatus(companyId: number) {
  const db = getDb();
  const { data } = await db.from("integration_settings")
    .select("provider, connected").eq("companyId", companyId);
  const rows = (data ?? []) as Array<{ provider: string; connected: boolean }>;
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  return {
    mercadopago: byProvider.get("mercadopago")?.connected ?? false,
    uber_direct: byProvider.get("uber_direct")?.connected ?? false,
    lalamove: byProvider.get("lalamove")?.connected ?? false,
    own_courier: byProvider.get("own_courier")?.connected ?? false,
    messaging: byProvider.get("messaging")?.connected ?? false,
  };
}

export async function getActiveDeliveryProvider(companyId: number): Promise<Exclude<IntegrationProvider, "mercadopago" | "messaging"> | undefined> {
  const status = await getIntegrationsStatus(companyId);
  if (status.uber_direct) return "uber_direct";
  if (status.lalamove) return "lalamove";
  if (status.own_courier) return "own_courier";
  return undefined;
}
