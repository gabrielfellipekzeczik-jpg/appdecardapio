// server/db.ts — queries via Supabase SDK (SUPABASE_SERVICE_ROLE_KEY)
// sem DATABASE_URL. Usa schema "marmitaria" isolado.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { calculateDeliveryFee } from "@shared/checkout";
import { buildFinanceReport } from "@shared/finance";
import {
  PICKUP_ADDRESS,
  isPickupOrder,
  type OpeningHours,
} from "@shared/store-rules";
import { isTestMode } from "./testData";
import {
  testAdvanceOrderStatus,
  testCreateCustomerOrder,
  testDashboardSummary,
  testFindOrderByExternalPaymentId,
  testGetIntegrationsStatus,
  testGetOrderById,
  testListActiveMenu,
  testListAdminMenu,
  testListCustomerOrders,
  testListExpenses,
  testListInventory,
  testListRecipeIngredients,
  testSaveRecipe,
  testListRecentOrders,
  testSetOrderDelivery,
  testSetOrderPayment,
  testCreateMenuCategory,
  testCreateMenuItem,
  testDeleteMenuItem,
  testListMenuCategories,
  testUpdateMenuItem,
  testCreateExpense,
  testCreateInventoryItem,
  testFinanceReport,
  testListInventoryMovements,
  testRecordInventoryMovement,
  testGetWhatsappBot,
  testPatchWhatsappBot,
  testGetCustomerTracking,
  testGetDriverTrackingInfo,
  testIssueDriverTrackingToken,
  testUpdateDriverLocation,
  testConfirmDriverDelivery,
} from "./testStore";

const SCHEMA = "marmitaria";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = ReturnType<typeof createClient<any, any, any>>;

let _db: DB | null = null;

export function getDb(): DB {
  if (!_db) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !key)
      throw new Error(
        "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios"
      );
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
  openingHours?: OpeningHours | null;
  acceptsCashOnDelivery?: boolean;
  pickupEnabled?: boolean;
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
  deliveryAddress: string | null;
  platformFeeAmount: string | null;
  notes: string | null;
  trackingUrl: string | null;
  externalPaymentId: string | null;
  externalDeliveryId: string | null;
  deliveryQuoteId?: string | null;
  paymentApprovedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customerTrackingTokenHash: string | null;
  driverTrackingTokenHash: string | null;
  trackingLatitude: string | null;
  trackingLongitude: string | null;
  trackingUpdatedAt: string | null;
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

  const { error } = await db
    .from("users")
    .upsert(values as Record<string, unknown>, {
      onConflict: "supabaseUserId",
    });
  if (error) throw new Error(`[DB] Falha ao salvar usuário: ${error.message}`);
}

export async function getUserBySupabaseId(
  supabaseUserId: string
): Promise<User | undefined> {
  const db = getDb();
  const { data, error } = await db
    .from("users")
    .select("*")
    .eq("supabaseUserId", supabaseUserId)
    .limit(1)
    .maybeSingle();
  if (error)
    throw new Error(`[DB] Falha ao consultar usuário: ${error.message}`);
  return (data as User) ?? undefined;
}

// ─── Menu ────────────────────────────────────────────────────────────────────

/**
 * O banco não declara chaves estrangeiras, então o PostgREST não consegue "embutir" tabelas relacionadas
 * (select("*, menu_categories(*)") falha). Por isso buscamos as tabelas separadamente e juntamos aqui.
 */
export function joinMenuWithCategories(
  items: MenuItem[],
  categories: MenuCategory[]
) {
  const byId = new Map(categories.map(category => [category.id, category]));
  return items.map(item => ({
    item,
    category: byId.get(item.categoryId) ?? null,
  }));
}

export async function listActiveMenu(companyId: number) {
  if (isTestMode()) return testListActiveMenu();
  const db = getDb();
  const [items, categories] = await Promise.all([
    db
      .from("menu_items")
      .select("*")
      .eq("companyId", companyId)
      .eq("active", true)
      .order("name"),
    db.from("menu_categories").select("*").eq("companyId", companyId),
  ]);
  if (items.error)
    throw new Error(`[DB] Falha ao listar o cardápio: ${items.error.message}`);
  if (categories.error)
    throw new Error(
      `[DB] Falha ao listar categorias: ${categories.error.message}`
    );
  return joinMenuWithCategories(
    (items.data ?? []) as MenuItem[],
    (categories.data ?? []) as MenuCategory[]
  );
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export function joinOrdersWithCustomers(
  orders: Order[],
  customers: Customer[]
) {
  const byId = new Map(customers.map(customer => [customer.id, customer]));
  return orders.map(order => ({
    order,
    customer: byId.get(order.customerId) ?? null,
  }));
}

async function loadCustomersFor(
  db: DB,
  companyId: number,
  orders: Order[]
): Promise<Customer[]> {
  const ids = Array.from(new Set(orders.map(order => order.customerId)));
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from("customers")
    .select("*")
    .eq("companyId", companyId)
    .in("id", ids);
  if (error)
    throw new Error(`[DB] Falha ao consultar clientes: ${error.message}`);
  return (data ?? []) as Customer[];
}

export async function listRecentOrders(companyId: number, limit = 20) {
  if (isTestMode()) return testListRecentOrders(limit);
  const db = getDb();
  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("companyId", companyId)
    .order("createdAt", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`[DB] Falha ao listar pedidos: ${error.message}`);
  const orders = (data ?? []) as Order[];
  return joinOrdersWithCustomers(
    orders,
    await loadCustomersFor(db, companyId, orders)
  );
}

export async function createCustomerOrder(
  companyId: number,
  input: {
    name: string;
    phone: string;
    address: string;
    addressNumber: string;
    accessToken: string;
    customerTrackingToken: string;
    /** E-mail confirmado do comprador (permite consultar o pedido depois e receber avisos). */
    customerEmail?: string;
    paymentMethod?: string;
    pickup?: boolean;
    notes?: string;
    deliveryFee?: number;
    deliveryQuoteId?: string | null;
    items: Array<{
      menuItemId: number;
      quantity: number;
      observation?: string;
    }>;
  }
) {
  if (isTestMode()) return testCreateCustomerOrder(input);
  const db = getDb();
  if (!input.address.trim() || !input.addressNumber.trim())
    throw new Error("Informe o endereço e o número antes de criar o pedido.");
  const fullAddress = input.pickup
    ? PICKUP_ADDRESS
    : `${input.address.trim()}, nº ${input.addressNumber.trim()}`;
  const quantities = input.items.reduce((acc, item) => acc + item.quantity, 0);
  if (quantities > 100 || input.items.some(item => item.quantity > 50))
    throw new Error("Quantidade máxima excedida.");
  const ids = Array.from(new Set(input.items.map(item => item.menuItemId)));
  const { data: menuRows, error: menuError } = await db
    .from("menu_items")
    .select("id,name,price,active")
    .eq("companyId", companyId)
    .eq("active", true)
    .in("id", ids);
  if (menuError)
    throw new Error(
      `[DB] Falha ao validar itens do cardápio: ${menuError.message}`
    );
  const byId = new Map((menuRows ?? []).map((row: any) => [row.id, row]));
  if (byId.size !== ids.length)
    throw new Error("Um ou mais itens não estão disponíveis.");
  const pricedItems = input.items.map(item => {
    const menu: any = byId.get(item.menuItemId);
    return { ...item, itemName: menu.name, unitPrice: Number(menu.price) };
  });
  const subtotal = pricedItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  const deliveryProvider = await getActiveDeliveryProvider(companyId);
  const deliveryFee = calculateDeliveryFee(
    subtotal,
    input.address,
    Boolean(deliveryProvider) && !input.pickup,
    input.addressNumber,
    input.deliveryFee ?? 0
  );
  const total = subtotal + deliveryFee;
  const accessTokenHash = createHash("sha256")
    .update(input.accessToken)
    .digest("hex");
  const customerTrackingTokenHash = createHash("sha256")
    .update(input.customerTrackingToken)
    .digest("hex");

  const customerWrite = await db.from("customers").upsert(
    {
      companyId,
      name: input.name,
      phone: input.phone,
      address: fullAddress,
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>,
    { onConflict: "companyId,phone", ignoreDuplicates: true }
  );
  if (customerWrite.error)
    throw new Error(
      `[DB] Falha ao salvar cliente: ${customerWrite.error.message}`
    );
  const { data: customerData, error: customerReadError } = await db
    .from("customers")
    .select("id")
    .eq("companyId", companyId)
    .eq("phone", input.phone)
    .limit(1)
    .single();
  if (customerReadError)
    throw new Error(
      `[DB] Falha ao consultar cliente: ${customerReadError.message}`
    );
  const customer = customerData as { id: number } | null;
  if (!customer) return { orderId: null, persisted: false as const };

  const baseOrder = {
    companyId,
    customerId: customer.id,
    subtotal: subtotal.toFixed(2),
    deliveryFee: deliveryFee.toFixed(2),
    total: total.toFixed(2),
    deliveryAddress: fullAddress,
    deliveryQuoteId: input.deliveryQuoteId ?? null,
    customerAccessTokenHash: accessTokenHash,
    customerTrackingTokenHash,
    notes: input.notes,
    paymentMethod: input.paymentMethod ?? "pending",
  } as Record<string, unknown>;
  // Colunas da migração 0007. Se ela ainda não foi aplicada, o pedido é criado sem elas
  // (o pagamento continua funcionando; só não há consulta por e-mail nem avisos).
  let notificationColumns: Record<string, unknown> = {};
  try {
    notificationColumns = {
      customerEmail: input.customerEmail?.trim().toLowerCase() || null,
      customerTrackingTokenEnc: encryptJson(input.customerTrackingToken),
    };
  } catch {
    notificationColumns = {
      customerEmail: input.customerEmail?.trim().toLowerCase() || null,
    };
  }
  let insertResult = await db
    .from("orders")
    .insert({ ...baseOrder, ...notificationColumns })
    .select("id")
    .single();
  if (
    insertResult.error &&
    /customerEmail|customerTrackingTokenEnc/.test(insertResult.error.message)
  ) {
    console.warn(
      "[DB] Migração 0007 ainda não aplicada; criando pedido sem e-mail/avisos."
    );
    insertResult = await db.from("orders").insert(baseOrder).select("id").single();
  }
  const { data: orderData, error: orderError } = insertResult;
  if (orderError)
    throw new Error(`[DB] Falha ao criar pedido: ${orderError.message}`);
  const order = orderData as { id: number } | null;

  if (!order) return { orderId: null, persisted: false as const };

  if (pricedItems.length) {
    const { error: itemsError } = await db.from("order_items").insert(
      pricedItems.map(item => ({
        orderId: order.id,
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        observation: item.observation,
      })) as Record<string, unknown>[]
    );
    if (itemsError) {
      await db
        .from("orders")
        .delete()
        .eq("id", order.id)
        .eq("companyId", companyId);
      throw new Error(
        `[DB] Falha ao salvar itens do pedido: ${itemsError.message}`
      );
    }
  }

  return {
    orderId: order.id,
    persisted: true as const,
    customerTrackingToken: input.customerTrackingToken,
  };
}

/** Barreira contra pedidos falsos em série, inclusive os pagos só na entrega. */
export async function countRecentUnpaidOrders(
  companyId: number,
  phone: string
) {
  if (isTestMode()) return 0;
  const db = getDb();
  const { data: customer } = await db
    .from("customers")
    .select("id")
    .eq("companyId", companyId)
    .eq("phone", phone)
    .maybeSingle();
  if (!customer) return 0;
  const { count, error } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("companyId", companyId)
    .eq("customerId", customer.id)
    .neq("paymentStatus", "approved")
    .gte("createdAt", new Date(Date.now() - 60 * 60_000).toISOString());
  if (error)
    throw new Error(`[DB] Falha ao validar pedidos recentes: ${error.message}`);
  return count ?? 0;
}

export async function listCustomerOrders(
  companyId: number,
  phone: string,
  accessToken: string
) {
  const accessTokenHash = createHash("sha256")
    .update(accessToken)
    .digest("hex");
  if (isTestMode()) return testListCustomerOrders(phone, accessToken);
  const db = getDb();
  const { data: customerRows, error: customerError } = await db
    .from("customers")
    .select("*")
    .eq("companyId", companyId)
    .eq("phone", phone)
    .limit(1);
  if (customerError)
    throw new Error(
      `[DB] Falha ao consultar cliente: ${customerError.message}`
    );
  const customer = ((customerRows ?? []) as Customer[])[0];
  if (!customer) return [];
  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("companyId", companyId)
    .eq("customerId", customer.id)
    .eq("customerAccessTokenHash", accessTokenHash)
    .order("createdAt", { ascending: false })
    .limit(20);
  if (error) throw new Error(`[DB] Falha ao listar pedidos: ${error.message}`);
  return joinOrdersWithCustomers((data ?? []) as Order[], [customer]);
}

export async function getOrderById(companyId: number, id: number) {
  if (isTestMode()) return testGetOrderById(id);
  const db = getDb();
  const { data: orderRows, error } = await db
    .from("orders")
    .select("*")
    .eq("companyId", companyId)
    .eq("id", id)
    .limit(1);
  if (error)
    throw new Error(`[DB] Falha ao consultar pedido: ${error.message}`);
  const order = ((orderRows ?? []) as Order[])[0];
  if (!order) return undefined;
  const [customers, itemsResult] = await Promise.all([
    loadCustomersFor(db, companyId, [order]),
    db.from("order_items").select("*").eq("orderId", id),
  ]);
  const items = (itemsResult.data ?? []) as OrderItem[];
  return { order, customer: customers[0] ?? null, items };
}

export async function getCustomerOrderById(
  companyId: number,
  id: number,
  accessToken: string
) {
  if (isTestMode()) return testGetOrderById(id, accessToken);
  const db = getDb();
  const hash = createHash("sha256").update(accessToken).digest("hex");
  const { data, error } = await db
    .from("orders")
    .select("id")
    .eq("companyId", companyId)
    .eq("id", id)
    .eq("customerAccessTokenHash", hash)
    .maybeSingle();
  if (error)
    throw new Error(`[DB] Falha ao validar acesso ao pedido: ${error.message}`);
  return data ? getOrderById(companyId, id) : undefined;
}

export async function issueDriverTrackingToken(
  companyId: number,
  orderId: number,
  token: string
) {
  const hash = createHash("sha256").update(token).digest("hex");
  if (isTestMode()) return testIssueDriverTrackingToken(orderId, hash);
  const db = getDb();
  const { data, error } = await db
    .from("orders")
    .update({
      driverTrackingTokenHash: hash,
      trackingLatitude: null,
      trackingLongitude: null,
      trackingUpdatedAt: null,
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("companyId", companyId)
    .eq("id", orderId)
    .in("status", ["ready", "out_for_delivery"])
    .select("id")
    .maybeSingle();
  if (error)
    throw new Error(`[DB] Falha ao emitir link do motoboy: ${error.message}`);
  return Boolean(data);
}

export async function findOrderByDriverToken(token: string) {
  if (isTestMode()) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data } = await getDb()
    .from("orders")
    .select("id,status")
    .eq("driverTrackingTokenHash", hash)
    .maybeSingle();
  return data ? { id: Number(data.id), status: String(data.status) } : null;
}

export async function updateDriverLocation(
  token: string,
  latitude: number,
  longitude: number
) {
  const hash = createHash("sha256").update(token).digest("hex");
  if (isTestMode()) return testUpdateDriverLocation(hash, latitude, longitude);
  const db = getDb();
  const { data: order, error: lookupError } = await db
    .from("orders")
    .select("id,status")
    .eq("driverTrackingTokenHash", hash)
    .maybeSingle();
  if (lookupError)
    throw new Error(`[DB] Falha ao localizar entrega: ${lookupError.message}`);
  if (!order || !["ready", "out_for_delivery"].includes(order.status))
    return false;
  const { error } = await db
    .from("orders")
    .update({
      status: "out_for_delivery",
      trackingLatitude: latitude,
      trackingLongitude: longitude,
      trackingUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", order.id);
  if (error)
    throw new Error(`[DB] Falha ao atualizar localização: ${error.message}`);
  return true;
}

async function buildTracking(
  db: DB,
  order: Record<string, any>
): Promise<CustomerTracking> {
  const [companyResult, customerResult, provider] = await Promise.all([
    db.from("companies").select("name,slug").eq("id", order.companyId).maybeSingle(),
    db
      .from("customers")
      .select("phone")
      .eq("companyId", order.companyId)
      .eq("id", order.customerId)
      .maybeSingle(),
    getActiveDeliveryProvider(order.companyId),
  ]);
  if (companyResult.error || customerResult.error)
    throw new Error("[DB] Falha ao carregar dados de rastreamento.");
  const phone = String(customerResult.data?.phone ?? "").replace(/\D/g, "");
  const deliveryCode =
    provider === "own_courier" &&
    !isPickupOrder(order) &&
    ["ready", "out_for_delivery", "delivered"].includes(String(order.status)) &&
    phone.length >= 4
      ? phone.slice(-4)
      : null;
  return {
    orderId: order.id,
    companyName: String(companyResult.data?.name ?? "Sua loja"),
    companySlug: String(companyResult.data?.slug ?? ""),
    status: String(order.status),
    paymentStatus: String(order.paymentStatus),
    paymentMethod: (order.paymentMethod as string | null) ?? null,
    pickup: isPickupOrder(order),
    trackingUrl: (order.trackingUrl as string | null) ?? null,
    updatedAt: (order.updatedAt as string | null) ?? null,
    createdAt: (order.createdAt as string | null) ?? null,
    location:
      order.trackingLatitude != null && order.trackingLongitude != null
        ? {
            latitude: Number(order.trackingLatitude),
            longitude: Number(order.trackingLongitude),
            updatedAt: order.trackingUpdatedAt as string | null,
          }
        : null,
    deliveryCode,
  };
}

export type CustomerTracking = {
  orderId: number;
  companyName: string;
  companySlug: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  pickup: boolean;
  trackingUrl: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  location: { latitude: number; longitude: number; updatedAt: string | null } | null;
  deliveryCode: string | null;
};

const TRACKING_COLUMNS =
  "id,companyId,customerId,status,paymentStatus,paymentMethod,deliveryAddress,trackingLatitude,trackingLongitude,trackingUpdatedAt,trackingUrl,updatedAt,createdAt";

export async function getCustomerTracking(token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  if (isTestMode()) return testGetCustomerTracking(hash);
  const db = getDb();
  const { data: order, error } = await db
    .from("orders")
    .select(TRACKING_COLUMNS)
    .eq("customerTrackingTokenHash", hash)
    .maybeSingle();
  if (error)
    throw new Error(`[DB] Falha ao consultar rastreamento: ${error.message}`);
  if (!order) return undefined;
  return buildTracking(db, order);
}

/** Pedidos de um comprador (e-mail já confirmado) em uma loja — mais recentes primeiro. */
export async function listOrdersForEmail(companyId: number, email: string) {
  if (isTestMode()) return [] as CustomerTracking[];
  const db = getDb();
  const { data, error } = await db
    .from("orders")
    .select(TRACKING_COLUMNS)
    .eq("companyId", companyId)
    .ilike("customerEmail", email.trim().toLowerCase())
    .order("createdAt", { ascending: false })
    .limit(15);
  if (error) {
    if (/customerEmail/.test(error.message)) return [];
    throw new Error(`[DB] Falha ao listar pedidos do cliente: ${error.message}`);
  }
  return Promise.all((data ?? []).map(order => buildTracking(db, order)));
}

export async function getTrackingForEmail(
  companyId: number,
  orderId: number,
  email: string
) {
  if (isTestMode()) return undefined;
  const db = getDb();
  const { data: order, error } = await db
    .from("orders")
    .select(TRACKING_COLUMNS)
    .eq("companyId", companyId)
    .eq("id", orderId)
    .ilike("customerEmail", email.trim().toLowerCase())
    .maybeSingle();
  if (error) {
    if (/customerEmail/.test(error.message)) return undefined;
    throw new Error(`[DB] Falha ao consultar pedido: ${error.message}`);
  }
  return order ? buildTracking(db, order) : undefined;
}

// ─── Avisos ao cliente ────────────────────────────────────────────────────────

export type NotificationContext = {
  orderId: number;
  companyId: number;
  companyName: string;
  companySlug: string;
  customerName: string;
  phone: string;
  email: string | null;
  trackingToken: string | null;
  total: string;
  botConnected: boolean;
  pickup: boolean;
  cash: boolean;
};

export async function getNotificationContext(
  orderId: number
): Promise<NotificationContext | null> {
  if (isTestMode()) return null;
  const db = getDb();
  const { data: order, error } = await db
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return null;
  const [company, customer, bot] = await Promise.all([
    db.from("companies").select("name,slug").eq("id", order.companyId).maybeSingle(),
    db.from("customers").select("name,phone").eq("id", order.customerId).maybeSingle(),
    db.from("whatsapp_bots").select("desired").eq("companyId", order.companyId).maybeSingle(),
  ]);
  let trackingToken: string | null = null;
  try {
    if (order.customerTrackingTokenEnc)
      trackingToken = decryptJson<string>(String(order.customerTrackingTokenEnc));
  } catch {
    trackingToken = null;
  }
  return {
    orderId,
    companyId: order.companyId,
    companyName: String(company.data?.name ?? "Sua loja"),
    companySlug: String(company.data?.slug ?? ""),
    customerName: String(customer.data?.name ?? ""),
    phone: String(customer.data?.phone ?? ""),
    email: (order.customerEmail as string | null) ?? null,
    trackingToken,
    total: String(order.total),
    botConnected: bot.data?.desired === "connected",
    pickup: isPickupOrder(order),
    cash: order.paymentMethod === "cash_on_delivery",
  };
}

/** Registra o aviso. Retorna false se já existia (evita duplicar em reenvios de webhook / voltar e avançar status). */
export async function claimNotification(input: {
  companyId: number;
  orderId: number;
  event: string;
  channel: "whatsapp" | "email";
  recipient: string;
  message: string;
}): Promise<number | null> {
  if (isTestMode()) return null;
  const db = getDb();
  const { data, error } = await db
    .from("order_notifications")
    .upsert(input as Record<string, unknown>, {
      onConflict: "orderId,event,channel",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) {
    console.error("[notifications] falha ao registrar aviso:", error.message);
    return null;
  }
  return ((data ?? []) as Array<{ id: number }>)[0]?.id ?? null;
}

export async function finishNotification(
  id: number,
  status: "sent" | "failed",
  error?: string
) {
  if (isTestMode()) return;
  await getDb()
    .from("order_notifications")
    .update({
      status,
      error: error ?? null,
      sentAt: status === "sent" ? new Date().toISOString() : null,
    } as Record<string, unknown>)
    .eq("id", id);
}

export async function getDriverTrackingInfo(token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  if (isTestMode()) return testGetDriverTrackingInfo(hash);
  const db = getDb();
  const { data: order, error } = await db
    .from("orders")
    .select(
      "id,companyId,customerId,status,deliveryAddress,trackingLatitude,trackingLongitude,trackingUpdatedAt"
    )
    .eq("driverTrackingTokenHash", hash)
    .maybeSingle();
  if (error)
    throw new Error(
      `[DB] Falha ao consultar rota do motoboy: ${error.message}`
    );
  if (!order) return undefined;
  const [company, customer] = await Promise.all([
    db.from("companies").select("name").eq("id", order.companyId).maybeSingle(),
    db
      .from("customers")
      .select("name,phone")
      .eq("companyId", order.companyId)
      .eq("id", order.customerId)
      .maybeSingle(),
  ]);
  if (company.error || customer.error)
    throw new Error("[DB] Falha ao carregar destino de entrega.");
  return {
    orderId: order.id,
    companyName: company.data?.name ?? "Sua loja",
    customerName: customer.data?.name ?? "Cliente",
    customerPhone: customer.data?.phone ?? "",
    address: order.deliveryAddress ?? "",
    status: order.status,
    location:
      order.trackingLatitude != null && order.trackingLongitude != null
        ? {
            latitude: Number(order.trackingLatitude),
            longitude: Number(order.trackingLongitude),
            updatedAt: order.trackingUpdatedAt as string | null,
          }
        : null,
  };
}

export async function confirmDriverDelivery(token: string, code: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  if (isTestMode()) return testConfirmDriverDelivery(hash, code);
  const db = getDb();
  const { data: order, error } = await db
    .from("orders")
    .select("id,companyId,customerId,status")
    .eq("driverTrackingTokenHash", hash)
    .maybeSingle();
  if (error) throw new Error(`[DB] Falha ao validar entrega: ${error.message}`);
  if (!order || order.status !== "out_for_delivery") return false;
  const { data: customer, error: customerError } = await db
    .from("customers")
    .select("phone")
    .eq("companyId", order.companyId)
    .eq("id", order.customerId)
    .maybeSingle();
  if (customerError)
    throw new Error(`[DB] Falha ao validar cliente: ${customerError.message}`);
  const phone = String(customer?.phone ?? "").replace(/\D/g, "");
  if (phone.length < 4 || phone.slice(-4) !== code) return false;
  const { error: updateError } = await db
    .from("orders")
    .update({
      status: "delivered",
      driverTrackingTokenHash: null,
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", order.id)
    .eq("companyId", order.companyId);
  if (updateError)
    throw new Error(`[DB] Falha ao confirmar entrega: ${updateError.message}`);
  return true;
}

export async function getDashboardSummary(companyId: number) {
  if (isTestMode()) return testDashboardSummary();
  const db = getDb();
  const { data } = await db
    .from("orders")
    .select("total")
    .eq("companyId", companyId)
    .eq("paymentStatus", "approved");
  const rows = (data ?? []) as Array<{ total: string }>;
  const revenue = rows.reduce((sum, r) => sum + Number(r.total), 0);
  const orderCount = rows.length;
  return {
    revenue,
    orders: orderCount,
    averageTicket: orderCount ? revenue / orderCount : 0,
  };
}

export async function listAdminMenu(companyId: number) {
  if (isTestMode()) return testListAdminMenu();
  const db = getDb();
  const { data } = await db
    .from("menu_items")
    .select("*")
    .eq("companyId", companyId)
    .order("name");
  return (data ?? []) as MenuItem[];
}

export type MenuItemInput = {
  categoryId: number;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  active?: boolean;
  featured?: boolean;
};

/** Categorias que toda empresa começa tendo (genéricas, servem para qualquer tipo de loja). */
export const DEFAULT_MENU_CATEGORIES = [
  "Mais vendidos",
  "Principais",
  "Bebidas",
  "Sobremesas",
] as const;

export async function listMenuCategories(
  companyId: number
): Promise<MenuCategory[]> {
  if (isTestMode()) return testListMenuCategories() as MenuCategory[];
  const db = getDb();
  const select = () =>
    db
      .from("menu_categories")
      .select("*")
      .eq("companyId", companyId)
      .order("sortOrder")
      .order("name");
  const { data, error } = await select();
  if (error)
    throw new Error(`[DB] Falha ao listar categorias: ${error.message}`);
  if ((data ?? []).length > 0) return data as MenuCategory[];

  // Empresa sem nenhuma categoria (nova, ou criada antes desta versão): cria as padrão.
  const { error: seedError } = await db.from("menu_categories").insert(
    DEFAULT_MENU_CATEGORIES.map((name, index) => ({
      companyId,
      name,
      sortOrder: index + 1,
      active: true,
    })) as Record<string, unknown>[]
  );
  if (seedError)
    throw new Error(
      `[DB] Falha ao criar categorias padrão: ${seedError.message}`
    );
  const seeded = await select();
  if (seeded.error)
    throw new Error(`[DB] Falha ao listar categorias: ${seeded.error.message}`);
  return (seeded.data ?? []) as MenuCategory[];
}

export async function createMenuCategory(
  companyId: number,
  input: { name: string }
) {
  const existing = await listMenuCategories(companyId);
  // Mesmo nome (sem diferenciar maiúsculas/minúsculas) devolve a categoria que já existe.
  const duplicate = existing.find(
    category =>
      category.name.trim().toLowerCase() === input.name.trim().toLowerCase()
  );
  if (duplicate) return duplicate;
  if (isTestMode()) return testCreateMenuCategory(input) as MenuCategory;
  const db = getDb();
  const { data, error } = await db
    .from("menu_categories")
    .insert({
      companyId,
      name: input.name,
      sortOrder: existing.length + 1,
      active: true,
    } as Record<string, unknown>)
    .select("*")
    .single();
  if (error) throw new Error(`[DB] Falha ao criar categoria: ${error.message}`);
  return data as MenuCategory;
}

/** Returns undefined when the category does not belong to the company. */
export async function createMenuItem(companyId: number, input: MenuItemInput) {
  if (isTestMode()) return testCreateMenuItem(input) as MenuItem | undefined;
  const db = getDb();
  const categories = await listMenuCategories(companyId);
  if (!categories.some(category => category.id === input.categoryId))
    return undefined;
  const { data, error } = await db
    .from("menu_items")
    .insert({
      companyId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      price: input.price.toFixed(2),
      imageUrl: input.imageUrl ?? null,
      active: input.active ?? true,
      featured: input.featured ?? false,
    } as Record<string, unknown>)
    .select("*")
    .single();
  if (error) throw new Error(`[DB] Falha ao criar item: ${error.message}`);
  return data as MenuItem;
}

/** Scoped by companyId, so one company can never edit another's item. Returns undefined if not found. */
export async function updateMenuItem(
  companyId: number,
  id: number,
  input: Partial<MenuItemInput>
) {
  if (isTestMode())
    return testUpdateMenuItem(id, input) as MenuItem | undefined;
  const db = getDb();
  if (input.categoryId !== undefined) {
    const categories = await listMenuCategories(companyId);
    if (!categories.some(category => category.id === input.categoryId))
      return undefined;
  }
  const { price, ...rest } = input;
  const patch: Record<string, unknown> = {
    ...rest,
    updatedAt: new Date().toISOString(),
  };
  if (price !== undefined) patch.price = price.toFixed(2);
  const { data, error } = await db
    .from("menu_items")
    .update(patch)
    .eq("id", id)
    .eq("companyId", companyId)
    .select("*");
  if (error) throw new Error(`[DB] Falha ao atualizar item: ${error.message}`);
  return ((data ?? []) as MenuItem[])[0];
}

export async function deleteMenuItem(companyId: number, id: number) {
  if (isTestMode()) return testDeleteMenuItem(id);
  const db = getDb();
  const { data, error } = await db
    .from("menu_items")
    .delete()
    .eq("id", id)
    .eq("companyId", companyId)
    .select("id");
  if (error) throw new Error(`[DB] Falha ao excluir item: ${error.message}`);
  return (data ?? []).length > 0;
}

export async function listInventory(companyId: number) {
  if (isTestMode()) return testListInventory();
  const db = getDb();
  const { data } = await db
    .from("inventory_items")
    .select("*")
    .eq("companyId", companyId)
    .order("name");
  return (data ?? []) as Record<string, unknown>[];
}

export async function listRecentExpenses(companyId: number, limit = 50) {
  if (isTestMode()) return testListExpenses();
  const db = getDb();
  const { data } = await db
    .from("expenses")
    .select("*")
    .eq("companyId", companyId)
    .order("incurredAt", { ascending: false })
    .limit(limit);
  return (data ?? []) as Record<string, unknown>[];
}

export type InventoryItemResult = {
  id: number;
  name: string;
  unit: string;
  currentQuantity: string;
  minimumQuantity: string;
  costPerUnit: string;
  active: boolean;
  updatedAt: string;
};
export type InventoryMovementResult = {
  id: number;
  itemName: string;
  unit: string;
  type: "in" | "out" | "adjustment";
  quantity: string;
  reason: string;
  occurredAt: string;
};

export async function createInventoryItem(
  companyId: number,
  input: {
    name: string;
    unit: string;
    minimumQuantity: number;
    costPerUnit: number;
  }
): Promise<InventoryItemResult> {
  if (isTestMode()) return testCreateInventoryItem(input);
  const db = getDb();
  const { data, error } = await db
    .from("inventory_items")
    .insert({
      companyId,
      name: input.name,
      unit: input.unit,
      currentQuantity: "0.000",
      minimumQuantity: input.minimumQuantity.toFixed(3),
      costPerUnit: input.costPerUnit.toFixed(2),
      active: true,
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>)
    .select("*")
    .single();
  if (error)
    throw new Error(
      `[DB] Falha ao cadastrar item de estoque: ${error.message}`
    );
  return data as InventoryItemResult;
}

export async function recordInventoryMovement(
  companyId: number,
  input: {
    itemId: number;
    type: "in" | "out" | "adjustment";
    quantity: number;
    reason: string;
  }
) {
  if (isTestMode()) return testRecordInventoryMovement(input);
  const db = getDb();
  const { data, error } = await db.rpc("record_inventory_movement", {
    p_company_id: companyId,
    p_item_id: input.itemId,
    p_type: input.type,
    p_quantity: input.quantity,
    p_reason: input.reason,
  });
  if (error) {
    if (/not found/i.test(error.message)) return undefined;
    throw new Error(
      `[DB] Falha ao registrar movimentação de estoque: ${error.message}`
    );
  }
  return data as Record<string, unknown>;
}

export async function listRecipeIngredients(companyId: number) {
  if (isTestMode()) return testListRecipeIngredients();
  const db = getDb();
  const { data, error } = await db
    .from("recipe_ingredients")
    .select("menuItemId,inventoryItemId,quantity,unit,lossPercent")
    .eq("companyId", companyId);
  if (error)
    throw new Error(`[DB] Falha ao listar fichas técnicas: ${error.message}`);
  return (data ?? []) as {
    menuItemId: number;
    inventoryItemId: number;
    quantity: number | string;
    unit: string;
    lossPercent: number | string | null;
  }[];
}

/** Grava antes de apagar o que saiu da ficha: uma falha no meio não deixa o prato sem receita. */
export async function saveRecipe(
  companyId: number,
  input: {
    menuItemId: number;
    lines: {
      inventoryItemId: number;
      quantity: number;
      unit: string;
      lossPercent: number | null;
    }[];
  }
) {
  if (isTestMode()) return testSaveRecipe(input);
  const db = getDb();
  const { data: dish } = await db
    .from("menu_items")
    .select("id")
    .eq("id", input.menuItemId)
    .eq("companyId", companyId)
    .maybeSingle();
  if (!dish) return false;
  if (input.lines.length) {
    const { error } = await db.from("recipe_ingredients").upsert(
      input.lines.map(line => ({
        companyId,
        menuItemId: input.menuItemId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity.toFixed(3),
        unit: line.unit,
        lossPercent: line.lossPercent?.toFixed(2) ?? null,
        updatedAt: new Date().toISOString(),
      })) as Record<string, unknown>[],
      { onConflict: "menuItemId,inventoryItemId" }
    );
    if (error)
      throw new Error(`[DB] Falha ao salvar ficha técnica: ${error.message}`);
  }
  let removal = db
    .from("recipe_ingredients")
    .delete()
    .eq("companyId", companyId)
    .eq("menuItemId", input.menuItemId);
  if (input.lines.length)
    removal = removal.not(
      "inventoryItemId",
      "in",
      `(${input.lines.map(line => line.inventoryItemId).join(",")})`
    );
  const { error: removalError } = await removal;
  if (removalError)
    throw new Error(
      `[DB] Falha ao atualizar ficha técnica: ${removalError.message}`
    );
  return true;
}

export async function listInventoryMovements(companyId: number, limit = 100) {
  if (isTestMode()) return testListInventoryMovements(limit);
  const db = getDb();
  const items = await listInventory(companyId);
  const byId = new Map(items.map(item => [Number(item.id), item]));
  if (!byId.size) return [];
  const { data, error } = await db
    .from("inventory_movements")
    .select("*")
    .in("inventoryItemId", Array.from(byId.keys()))
    .order("occurredAt", { ascending: false })
    .limit(limit);
  if (error)
    throw new Error(
      `[DB] Falha ao listar movimentações de estoque: ${error.message}`
    );
  return ((data ?? []) as Array<Record<string, unknown>>).map(
    (movement): InventoryMovementResult => {
      const item = byId.get(Number(movement.inventoryItemId));
      return {
        id: Number(movement.id),
        itemName: String(item?.name ?? "Item removido"),
        unit: String(item?.unit ?? "un"),
        type: movement.type as InventoryMovementResult["type"],
        quantity: String(movement.quantity),
        reason: String(movement.reason),
        occurredAt: String(movement.occurredAt),
      };
    }
  );
}

export async function createExpense(
  companyId: number,
  input: {
    description: string;
    category: string;
    amount: number;
    date: string;
    notes?: string;
  }
) {
  if (isTestMode()) return testCreateExpense(input);
  const db = getDb();
  const { data, error } = await db
    .from("expenses")
    .insert({
      companyId,
      description: input.description,
      category: input.category,
      amount: input.amount.toFixed(2),
      incurredAt: `${input.date}T12:00:00`,
      notes: input.notes ?? null,
    } as Record<string, unknown>)
    .select("*")
    .single();
  if (error) throw new Error(`[DB] Falha ao lançar despesa: ${error.message}`);
  return data as Record<string, unknown>;
}

function brazilDateBounds(from: string, to: string) {
  const dayAfter = new Date(`${to}T12:00:00Z`);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  return {
    start: `${from}T03:00:00`,
    end: `${dayAfter.toISOString().slice(0, 10)}T03:00:00`,
  };
}

export async function getFinanceReport(
  companyId: number,
  from: string,
  to: string
) {
  if (isTestMode()) return testFinanceReport(from, to);
  const db = getDb();
  const { start, end } = brazilDateBounds(from, to);
  const readPages = async <T>(build: () => any): Promise<T[]> => {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await build().range(offset, offset + 999);
      if (error)
        throw new Error(
          `[DB] Falha ao carregar relatório financeiro: ${error.message}`
        );
      const page = (data ?? []) as T[];
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  };
  type FinanceOrder = {
    id: number;
    createdAt: string;
    paymentApprovedAt: string | null;
    paymentStatus: string;
    paymentMethod: string | null;
    total: string;
    platformFeeAmount: string | null;
  };
  let usedCreatedAtFallback = false;
  let orders: FinanceOrder[];
  try {
    orders = await readPages<FinanceOrder>(() =>
      db
        .from("orders")
        .select(
          "id,createdAt,paymentApprovedAt,paymentStatus,paymentMethod,total,platformFeeAmount"
        )
        .eq("companyId", companyId)
        .or(
          `and(paymentStatus.eq.approved,paymentApprovedAt.gte.${start},paymentApprovedAt.lt.${end}),and(paymentStatus.eq.approved,paymentApprovedAt.is.null,createdAt.gte.${start},createdAt.lt.${end}),and(paymentStatus.eq.pending,createdAt.gte.${start},createdAt.lt.${end})`
        )
        .order("id", { ascending: true })
    );
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !/column orders\.paymentApprovedAt does not exist/i.test(error.message)
    )
      throw error;
    usedCreatedAtFallback = true;
    const legacyOrders = await readPages<
      Omit<FinanceOrder, "paymentApprovedAt">
    >(() =>
      db
        .from("orders")
        .select(
          "id,createdAt,paymentStatus,paymentMethod,total,platformFeeAmount"
        )
        .eq("companyId", companyId)
        .in("paymentStatus", ["approved", "pending"])
        .gte("createdAt", start)
        .lt("createdAt", end)
        .order("id", { ascending: true })
    );
    orders = legacyOrders.map(order => ({ ...order, paymentApprovedAt: null }));
  }
  const expenses = await readPages<{
    id: number;
    description: string;
    category: string;
    amount: string;
    incurredAt: string;
    notes: string | null;
  }>(() =>
    db
      .from("expenses")
      .select("id,description,category,amount,incurredAt,notes")
      .eq("companyId", companyId)
      .gte("incurredAt", start)
      .lt("incurredAt", end)
      .order("id", { ascending: true })
  );
  const paidIds = orders
    .filter(order => order.paymentStatus === "approved")
    .map(order => order.id);
  const orderItems: Array<{
    orderId: number;
    itemName: string;
    quantity: number;
    unitPrice: string;
  }> = [];
  for (let index = 0; index < paidIds.length; index += 20) {
    const ids = paidIds.slice(index, index + 20);
    const { data, error } = await db
      .from("order_items")
      .select("orderId,itemName,quantity,unitPrice")
      .in("orderId", ids)
      .order("id", { ascending: true });
    if (error)
      throw new Error(
        `[DB] Falha ao carregar produtos vendidos: ${error.message}`
      );
    orderItems.push(...((data ?? []) as typeof orderItems));
  }
  return {
    ...buildFinanceReport(from, to, orders, expenses, orderItems),
    financeDateBasis: usedCreatedAtFallback
      ? ("createdAt" as const)
      : ("paymentApprovedAt" as const),
  };
}

export const ORDER_STATUS_FLOW = [
  "received",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
] as const;
export type OrderStatus = (typeof ORDER_STATUS_FLOW)[number];

export async function advanceOrderStatus(
  companyId: number,
  orderId: number,
  status: OrderStatus
) {
  if (isTestMode()) return testAdvanceOrderStatus(orderId, status);
  const db = getDb();
  const { data } = await db
    .from("orders")
    .update({ status, updatedAt: new Date().toISOString() } as Record<
      string,
      unknown
    >)
    .eq("id", orderId)
    .eq("companyId", companyId)
    .select("id");
  return { orderId, status, persisted: ((data ?? []) as unknown[]).length > 0 };
}

export async function setOrderDelivery(
  orderId: number,
  input: { trackingUrl?: string | null; externalDeliveryId?: string | null }
) {
  if (isTestMode()) {
    testSetOrderDelivery(orderId, input);
    return;
  }
  const db = getDb();
  await db
    .from("orders")
    .update({ ...input, updatedAt: new Date().toISOString() } as Record<
      string,
      unknown
    >)
    .eq("id", orderId);
}

export async function setOrderPayment(
  orderId: number,
  input: {
    paymentStatus: "pending" | "approved" | "rejected" | "refunded";
    externalPaymentId?: string | null;
    platformFeeAmount?: string | null;
  }
) {
  if (isTestMode()) {
    testSetOrderPayment(orderId, input);
    return;
  }
  const db = getDb();
  const now = new Date().toISOString();
  const patch = {
    ...input,
    ...(input.paymentStatus === "approved" ? { paymentApprovedAt: now } : {}),
    updatedAt: now,
  };
  const { error } = await db
    .from("orders")
    .update(patch as Record<string, unknown>)
    .eq("id", orderId);
  if (error)
    throw new Error(
      `[DB] Falha ao atualizar pagamento do pedido: ${error.message}`
    );
}

export async function findOrderByExternalPaymentId(
  companyId: number,
  externalPaymentId: string
) {
  if (isTestMode()) return testFindOrderByExternalPaymentId(externalPaymentId);
  const db = getDb();
  const { data } = await db
    .from("orders")
    .select("*")
    .eq("companyId", companyId)
    .eq("externalPaymentId", externalPaymentId)
    .limit(1)
    .single();
  return (data as Order) ?? undefined;
}

// ─── Integrations ────────────────────────────────────────────────────────────

export type IntegrationProvider =
  | "mercadopago"
  | "uber_direct"
  | "lalamove"
  | "own_courier"
  | "messaging";

import { decryptJson, encryptJson } from "./_core/crypto";

export async function getIntegrationSettings(
  companyId: number,
  provider: IntegrationProvider
): Promise<IntegrationSettings | undefined> {
  if (isTestMode()) return undefined;
  const db = getDb();
  const { data } = await db
    .from("integration_settings")
    .select("*")
    .eq("companyId", companyId)
    .eq("provider", provider)
    .limit(1)
    .single();
  return (data as IntegrationSettings) ?? undefined;
}

export async function getIntegrationCredentials<T = Record<string, unknown>>(
  companyId: number,
  provider: IntegrationProvider
): Promise<T | undefined> {
  const row = await getIntegrationSettings(companyId, provider);
  if (!row?.connected || !row.credentials) return undefined;
  try {
    return decryptJson<T>(row.credentials);
  } catch (error) {
    console.error(
      `[Integrations] Failed to decrypt credentials for company ${companyId}/${provider}:`,
      error
    );
    return undefined;
  }
}

export async function saveIntegrationCredentials(
  companyId: number,
  provider: IntegrationProvider,
  credentials: Record<string, unknown>,
  metadata?: Record<string, unknown>
) {
  if (isTestMode()) return;
  const db = getDb();
  const encrypted = encryptJson(credentials);
  const now = new Date().toISOString();
  await db.from("integration_settings").upsert(
    {
      companyId,
      provider,
      connected: true,
      credentials: encrypted,
      metadata: metadata ? JSON.stringify(metadata) : null,
      connectedAt: now,
      updatedAt: now,
    } as Record<string, unknown>,
    { onConflict: "companyId,provider" }
  );
}

export async function disconnectIntegration(
  companyId: number,
  provider: IntegrationProvider
) {
  if (isTestMode()) return;
  const db = getDb();
  await db
    .from("integration_settings")
    .update({
      connected: false,
      credentials: null,
      updatedAt: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("companyId", companyId)
    .eq("provider", provider);
}

export async function getIntegrationsStatus(companyId: number) {
  if (isTestMode()) return testGetIntegrationsStatus();
  const db = getDb();
  const { data } = await db
    .from("integration_settings")
    .select("provider, connected")
    .eq("companyId", companyId);
  const rows = (data ?? []) as Array<{ provider: string; connected: boolean }>;
  const byProvider = new Map(rows.map(r => [r.provider, r]));
  return {
    mercadopago: byProvider.get("mercadopago")?.connected ?? false,
    uber_direct: byProvider.get("uber_direct")?.connected ?? false,
    lalamove: byProvider.get("lalamove")?.connected ?? false,
    own_courier: byProvider.get("own_courier")?.connected ?? false,
    messaging: byProvider.get("messaging")?.connected ?? false,
  };
}

export async function getActiveDeliveryProvider(
  companyId: number
): Promise<
  Exclude<IntegrationProvider, "mercadopago" | "messaging"> | undefined
> {
  const status = await getIntegrationsStatus(companyId);
  if (status.uber_direct) return "uber_direct";
  if (status.lalamove) return "lalamove";
  if (status.own_courier) return "own_courier";
  return undefined;
}

// ─── Bot de atendimento no WhatsApp ──────────────────────────────────────────
// O app grava a intenção (desired) e as preferências; o serviço /bot grava status, QR e heartbeat.

export type WhatsappBotRow = {
  companyId: number;
  desired: "connected" | "disconnected";
  status: "idle" | "starting" | "qr" | "connected" | "error";
  qr: string | null;
  phone: string | null;
  error: string | null;
  aiEnabled: boolean;
  instructions: string | null;
  heartbeatAt: string | null;
  updatedAt: string;
};

/** O serviço do bot grava um heartbeat a cada poucos segundos; sem ele o app avisa que o serviço está fora do ar. */
export const BOT_HEARTBEAT_MAX_AGE_MS = 120_000;

export async function getWhatsappBot(
  companyId: number
): Promise<WhatsappBotRow | undefined> {
  if (isTestMode()) return testGetWhatsappBot() as WhatsappBotRow | undefined;
  const db = getDb();
  const { data, error } = await db
    .from("whatsapp_bots")
    .select("*")
    .eq("companyId", companyId)
    .limit(1);
  if (error)
    throw new Error(
      `[DB] Falha ao consultar o bot de WhatsApp: ${error.message}`
    );
  return ((data ?? []) as WhatsappBotRow[])[0];
}

async function patchWhatsappBot(
  companyId: number,
  patch: Record<string, unknown>
) {
  if (isTestMode())
    return testPatchWhatsappBot(patch as never) as unknown as WhatsappBotRow;
  const db = getDb();
  const { data, error } = await db
    .from("whatsapp_bots")
    .upsert(
      { companyId, ...patch, updatedAt: new Date().toISOString() } as Record<
        string,
        unknown
      >,
      { onConflict: "companyId" }
    )
    .select("*")
    .single();
  if (error)
    throw new Error(`[DB] Falha ao salvar o bot de WhatsApp: ${error.message}`);
  return data as WhatsappBotRow;
}

export const requestWhatsappConnect = (companyId: number) =>
  patchWhatsappBot(companyId, {
    desired: "connected",
    status: "starting",
    qr: null,
    error: null,
  });

export const requestWhatsappDisconnect = (companyId: number) =>
  patchWhatsappBot(companyId, { desired: "disconnected" });

export const updateWhatsappSettings = (
  companyId: number,
  input: { aiEnabled?: boolean; instructions?: string | null }
) => patchWhatsappBot(companyId, input);
