var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/testData.ts
function isTestMode() {
  return process.env.NODE_ENV === "test";
}
function isTemplateId(value) {
  return TEMPLATE_IDS.includes(value);
}
function buildTestCompany(slug) {
  const templateId = isTemplateId(slug) ? slug : "premium";
  return {
    id: -1,
    slug,
    name: "Restaurante de Teste",
    tagline: "sabores que contam hist\xF3rias",
    logoUrl: null,
    heroImageUrl: null,
    primaryColor: "#c9a15a",
    templateId,
    pickupAddress: "Rua Exemplo, 123 \u2014 Centro",
    status: "active",
    createdAt: /* @__PURE__ */ new Date()
  };
}
var TEMPLATE_IDS;
var init_testData = __esm({
  "server/testData.ts"() {
    "use strict";
    TEMPLATE_IDS = ["classic", "modern", "cover", "premium"];
  }
});

// server/testStore.ts
function testListActiveMenu() {
  return menu.filter((item) => item.active).map((item) => ({ item, category: categories.find((category) => category.id === item.categoryId) ?? null }));
}
function testListAdminMenu() {
  return menu;
}
function testListInventory() {
  return [];
}
function testListExpenses() {
  return [];
}
function testListRecentOrders(limit) {
  return orders.slice(-limit).reverse().map(({ order, customer }) => ({ order, customer }));
}
function testGetIntegrationsStatus() {
  return { mercadopago: false, uber_direct: false, lalamove: false, own_courier: false, messaging: false };
}
function testCreateCustomerOrder(input) {
  const timestamp = now();
  let customer = customers.find((value) => value.phone === input.phone);
  if (!customer) {
    customer = { id: nextCustomerId++, companyId: DEMO_COMPANY_ID, name: input.name, phone: input.phone, address: input.address, createdAt: timestamp, updatedAt: timestamp };
    customers.push(customer);
  } else {
    customer.name = input.name;
    customer.address = input.address;
    customer.updatedAt = timestamp;
  }
  const orderId = nextOrderId++;
  const order = { id: orderId, companyId: DEMO_COMPANY_ID, customerId: customer.id, status: "received", paymentStatus: "pending", paymentMethod: input.paymentMethod ?? "pending", subtotal: input.subtotal.toFixed(2), deliveryFee: input.deliveryFee.toFixed(2), total: input.total.toFixed(2), platformFeeAmount: null, notes: input.notes ?? null, trackingUrl: null, externalPaymentId: null, externalDeliveryId: null, createdAt: timestamp, updatedAt: timestamp };
  const items = input.items.map((item) => ({ id: nextOrderItemId++, orderId, menuItemId: item.menuItemId, itemName: item.itemName, quantity: item.quantity, unitPrice: item.unitPrice.toFixed(2), observation: item.observation ?? null }));
  orders.push({ order, customer, items });
  return { orderId, persisted: true };
}
function testListCustomerOrders(phone) {
  return orders.filter((value) => value.customer.phone === phone).slice(-20).reverse().map(({ order, customer }) => ({ order, customer }));
}
function testGetOrderById(id) {
  const found = orders.find((value) => value.order.id === id);
  return found ? { order: found.order, customer: found.customer, items: found.items } : void 0;
}
function testAdvanceOrderStatus(orderId, status) {
  const found = orders.find((value) => value.order.id === orderId);
  if (!found) return { orderId, status, persisted: false };
  found.order.status = status;
  found.order.updatedAt = now();
  return { orderId, status, persisted: true };
}
function testSetOrderDelivery(orderId, input) {
  const found = orders.find((value) => value.order.id === orderId);
  if (found) Object.assign(found.order, input, { updatedAt: now() });
}
function testSetOrderPayment(orderId, input) {
  const found = orders.find((value) => value.order.id === orderId);
  if (found) Object.assign(found.order, input, { updatedAt: now() });
}
function testDashboardSummary() {
  const approved = orders.filter((value) => value.order.paymentStatus === "approved");
  const revenue = approved.reduce((sum, value) => sum + Number(value.order.total), 0);
  return { revenue, orders: approved.length, averageTicket: approved.length ? revenue / approved.length : 0 };
}
function testFindOrderByExternalPaymentId(externalPaymentId) {
  return orders.find((value) => value.order.externalPaymentId === externalPaymentId)?.order;
}
var DEMO_COMPANY_ID, now, categories, menu, customers, orders, nextCustomerId, nextOrderId, nextOrderItemId;
var init_testStore = __esm({
  "server/testStore.ts"() {
    "use strict";
    DEMO_COMPANY_ID = -1;
    now = () => (/* @__PURE__ */ new Date()).toISOString();
    categories = [
      { id: 1, companyId: DEMO_COMPANY_ID, name: "Mais pedidos", description: null, sortOrder: 1, active: true, createdAt: now() },
      { id: 2, companyId: DEMO_COMPANY_ID, name: "Leves & fit", description: null, sortOrder: 2, active: true, createdAt: now() },
      { id: 3, companyId: DEMO_COMPANY_ID, name: "Especiais", description: null, sortOrder: 3, active: true, createdAt: now() }
    ];
    menu = [
      { id: 1, companyId: DEMO_COMPANY_ID, categoryId: 1, name: "Caseira da semana", description: "Arroz soltinho, feij\xE3o cremoso, frango grelhado, pur\xEA de batata e salada fresca.", price: "24.90", imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85", active: true, featured: true, createdAt: now(), updatedAt: now() },
      { id: 2, companyId: DEMO_COMPANY_ID, categoryId: 1, name: "Bife acebolado", description: "Bife macio na chapa, arroz, feij\xE3o, farofa crocante e vinagrete da casa.", price: "28.90", imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=85", active: true, featured: true, createdAt: now(), updatedAt: now() },
      { id: 3, companyId: DEMO_COMPANY_ID, categoryId: 2, name: "Frango tropical", description: "Frango ao molho de laranja, arroz integral, legumes tostados e folhas.", price: "26.90", imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85", active: true, featured: false, createdAt: now(), updatedAt: now() },
      { id: 4, companyId: DEMO_COMPANY_ID, categoryId: 2, name: "Bowl da horta", description: "Quinoa, gr\xE3o-de-bico, ab\xF3bora assada, avocado e molho de ervas.", price: "25.90", imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85", active: true, featured: false, createdAt: now(), updatedAt: now() },
      { id: 5, companyId: DEMO_COMPANY_ID, categoryId: 3, name: "Parmegiana de domingo", description: "Frango empanado, molho de tomate assado, queijo gratinado e batatas r\xFAsticas.", price: "32.90", imageUrl: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=900&q=85", active: true, featured: true, createdAt: now(), updatedAt: now() }
    ];
    customers = [];
    orders = [];
    nextCustomerId = 1;
    nextOrderId = 2e3;
    nextOrderItemId = 1;
  }
});

// server/_core/env.ts
function assertRuntimeEnv() {
  if (process.env.NODE_ENV === "test") return;
  const missing = [];
  if (!(ENV.supabaseUrl || process.env.VITE_SUPABASE_URL)) missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!process.env.VITE_SUPABASE_ANON_KEY) missing.push("VITE_SUPABASE_ANON_KEY");
  if (missing.length) {
    throw new Error(`Configura\xE7\xE3o incompleta. Defina no ambiente: ${missing.join(", ")}. Consulte SETUP.md.`);
  }
}
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      databaseUrl: process.env.DATABASE_URL ?? "",
      isProduction: process.env.NODE_ENV === "production",
      supabaseUrl: process.env.SUPABASE_URL ?? "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
      // Getter (not a frozen value) so tests can set OWNER_EMAIL per-case without module reload tricks.
      get ownerEmail() {
        return (process.env.OWNER_EMAIL ?? "").toLowerCase();
      },
      integrationsEncryptionKey: process.env.INTEGRATIONS_ENCRYPTION_KEY ?? "",
      // Platform-level Mercado Pago OAuth application (one app registered by the
      // platform owner). Each company connects *their own* seller account through
      // it; the platform fee is retained automatically via `application_fee`.
      mpClientId: process.env.MP_CLIENT_ID ?? "",
      mpClientSecret: process.env.MP_CLIENT_SECRET ?? "",
      mpRedirectUri: process.env.MP_REDIRECT_URI ?? "",
      get platformFeePercent() {
        return Number(process.env.PLATFORM_FEE_PERCENT ?? "5");
      }
      // Delivery provider credentials (Uber Direct, Lalamove) are per-company —
      // see `server/db.ts` `getIntegrationCredentials`, not env vars.
    };
  }
});

// server/_core/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function getKey() {
  const raw = ENV.integrationsEncryptionKey;
  if (!raw) throw new Error("INTEGRATIONS_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("INTEGRATIONS_ENCRYPTION_KEY must decode to 32 bytes (base64)");
  return key;
}
function encryptJson(value) {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf-8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}
function decryptJson(payload) {
  const key = getKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf-8"));
}
var ALGO;
var init_crypto = __esm({
  "server/_core/crypto.ts"() {
    "use strict";
    init_env();
    ALGO = "aes-256-gcm";
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  ORDER_STATUS_FLOW: () => ORDER_STATUS_FLOW,
  advanceOrderStatus: () => advanceOrderStatus,
  createCustomerOrder: () => createCustomerOrder,
  disconnectIntegration: () => disconnectIntegration,
  findOrderByExternalPaymentId: () => findOrderByExternalPaymentId,
  getActiveDeliveryProvider: () => getActiveDeliveryProvider,
  getDashboardSummary: () => getDashboardSummary,
  getDb: () => getDb,
  getIntegrationCredentials: () => getIntegrationCredentials,
  getIntegrationSettings: () => getIntegrationSettings,
  getIntegrationsStatus: () => getIntegrationsStatus,
  getOrderById: () => getOrderById,
  getUserBySupabaseId: () => getUserBySupabaseId,
  listActiveMenu: () => listActiveMenu,
  listAdminMenu: () => listAdminMenu,
  listCustomerOrders: () => listCustomerOrders,
  listInventory: () => listInventory,
  listRecentExpenses: () => listRecentExpenses,
  listRecentOrders: () => listRecentOrders,
  saveIntegrationCredentials: () => saveIntegrationCredentials,
  setOrderDelivery: () => setOrderDelivery,
  setOrderPayment: () => setOrderPayment,
  upsertUser: () => upsertUser
});
import { createClient } from "@supabase/supabase-js";
function getDb() {
  if (!_db) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY s\xE3o obrigat\xF3rios");
    _db = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: SCHEMA }
    });
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.supabaseUserId) throw new Error("supabaseUserId is required");
  const db = getDb();
  const values = {
    supabaseUserId: user.supabaseUserId,
    lastSignedIn: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (user.name !== void 0) values.name = user.name;
  if (user.email !== void 0) values.email = user.email;
  if (user.loginMethod !== void 0) values.loginMethod = user.loginMethod;
  if (user.companyId !== void 0) values.companyId = user.companyId;
  if (user.role !== void 0) values.role = user.role;
  const { error } = await db.from("users").upsert(values, { onConflict: "supabaseUserId" });
  if (error) throw new Error(`[DB] Falha ao salvar usu\xE1rio: ${error.message}`);
}
async function getUserBySupabaseId(supabaseUserId) {
  const db = getDb();
  const { data, error } = await db.from("users").select("*").eq("supabaseUserId", supabaseUserId).limit(1).maybeSingle();
  if (error) throw new Error(`[DB] Falha ao consultar usu\xE1rio: ${error.message}`);
  return data ?? void 0;
}
async function listActiveMenu(companyId) {
  if (isTestMode()) return testListActiveMenu();
  const db = getDb();
  const { data } = await db.from("menu_items").select("*, menu_categories(*)").eq("companyId", companyId).eq("active", true).order("name");
  return (data ?? []).map((row) => ({
    item: { ...row, menu_categories: void 0 },
    category: row.menu_categories
  }));
}
async function listRecentOrders(companyId, limit = 20) {
  if (isTestMode()) return testListRecentOrders(limit);
  const db = getDb();
  const { data } = await db.from("orders").select("*, customers(*)").eq("companyId", companyId).order("createdAt", { ascending: false }).limit(limit);
  return (data ?? []).map((row) => ({
    order: { ...row, customers: void 0 },
    customer: row.customers
  }));
}
async function createCustomerOrder(companyId, input) {
  if (isTestMode()) return testCreateCustomerOrder(input);
  const db = getDb();
  await db.from("customers").upsert(
    { companyId, name: input.name, phone: input.phone, address: input.address, updatedAt: (/* @__PURE__ */ new Date()).toISOString() },
    { onConflict: "companyId,phone" }
  );
  const { data: customerData } = await db.from("customers").select("id").eq("companyId", companyId).eq("phone", input.phone).limit(1).single();
  const customer = customerData;
  if (!customer) return { orderId: null, persisted: false };
  const { data: orderData } = await db.from("orders").insert({
    companyId,
    customerId: customer.id,
    subtotal: input.subtotal.toFixed(2),
    deliveryFee: input.deliveryFee.toFixed(2),
    total: input.total.toFixed(2),
    notes: input.notes,
    paymentMethod: input.paymentMethod ?? "pending"
  }).select("id").single();
  const order = orderData;
  if (!order) return { orderId: null, persisted: false };
  if (input.items.length) {
    await db.from("order_items").insert(
      input.items.map((item) => ({
        orderId: order.id,
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        observation: item.observation
      }))
    );
  }
  return { orderId: order.id, persisted: true };
}
async function listCustomerOrders(companyId, phone) {
  if (isTestMode()) return testListCustomerOrders(phone);
  const db = getDb();
  const { data: customerData } = await db.from("customers").select("id").eq("companyId", companyId).eq("phone", phone).limit(1).single();
  const customer = customerData;
  if (!customer) return [];
  const { data } = await db.from("orders").select("*, customers(*)").eq("companyId", companyId).eq("customerId", customer.id).order("createdAt", { ascending: false }).limit(20);
  return (data ?? []).map((row) => ({
    order: { ...row, customers: void 0 },
    customer: row.customers
  }));
}
async function getOrderById(companyId, id) {
  if (isTestMode()) return testGetOrderById(id);
  const db = getDb();
  const { data: orderRow } = await db.from("orders").select("*, customers(*)").eq("companyId", companyId).eq("id", id).limit(1).single();
  if (!orderRow) return void 0;
  const row = orderRow;
  const { data: itemsData } = await db.from("order_items").select("*").eq("orderId", id);
  const items = itemsData ?? [];
  return { order: { ...row, customers: void 0 }, customer: row.customers, items };
}
async function getDashboardSummary(companyId) {
  if (isTestMode()) return testDashboardSummary();
  const db = getDb();
  const { data } = await db.from("orders").select("total").eq("companyId", companyId).eq("paymentStatus", "approved");
  const rows = data ?? [];
  const revenue = rows.reduce((sum, r) => sum + Number(r.total), 0);
  const orderCount = rows.length;
  return { revenue, orders: orderCount, averageTicket: orderCount ? revenue / orderCount : 0 };
}
async function listAdminMenu(companyId) {
  if (isTestMode()) return testListAdminMenu();
  const db = getDb();
  const { data } = await db.from("menu_items").select("*").eq("companyId", companyId).order("name");
  return data ?? [];
}
async function listInventory(companyId) {
  if (isTestMode()) return testListInventory();
  const db = getDb();
  const { data } = await db.from("inventory_items").select("*").eq("companyId", companyId).order("name");
  return data ?? [];
}
async function listRecentExpenses(companyId, limit = 50) {
  if (isTestMode()) return testListExpenses();
  const db = getDb();
  const { data } = await db.from("expenses").select("*").eq("companyId", companyId).order("incurredAt", { ascending: false }).limit(limit);
  return data ?? [];
}
async function advanceOrderStatus(companyId, orderId, status) {
  if (isTestMode()) return testAdvanceOrderStatus(orderId, status);
  const db = getDb();
  const { data } = await db.from("orders").update({ status, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", orderId).eq("companyId", companyId).select("id");
  return { orderId, status, persisted: (data ?? []).length > 0 };
}
async function setOrderDelivery(orderId, input) {
  if (isTestMode()) {
    testSetOrderDelivery(orderId, input);
    return;
  }
  const db = getDb();
  await db.from("orders").update({ ...input, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", orderId);
}
async function setOrderPayment(orderId, input) {
  if (isTestMode()) {
    testSetOrderPayment(orderId, input);
    return;
  }
  const db = getDb();
  await db.from("orders").update({ ...input, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", orderId);
}
async function findOrderByExternalPaymentId(companyId, externalPaymentId) {
  if (isTestMode()) return testFindOrderByExternalPaymentId(externalPaymentId);
  const db = getDb();
  const { data } = await db.from("orders").select("*").eq("companyId", companyId).eq("externalPaymentId", externalPaymentId).limit(1).single();
  return data ?? void 0;
}
async function getIntegrationSettings(companyId, provider) {
  if (isTestMode()) return void 0;
  const db = getDb();
  const { data } = await db.from("integration_settings").select("*").eq("companyId", companyId).eq("provider", provider).limit(1).single();
  return data ?? void 0;
}
async function getIntegrationCredentials(companyId, provider) {
  const row = await getIntegrationSettings(companyId, provider);
  if (!row?.connected || !row.credentials) return void 0;
  try {
    return decryptJson(row.credentials);
  } catch (error) {
    console.error(`[Integrations] Failed to decrypt credentials for company ${companyId}/${provider}:`, error);
    return void 0;
  }
}
async function saveIntegrationCredentials(companyId, provider, credentials, metadata) {
  if (isTestMode()) return;
  const db = getDb();
  const encrypted = encryptJson(credentials);
  const now2 = (/* @__PURE__ */ new Date()).toISOString();
  await db.from("integration_settings").upsert({
    companyId,
    provider,
    connected: true,
    credentials: encrypted,
    metadata: metadata ? JSON.stringify(metadata) : null,
    connectedAt: now2,
    updatedAt: now2
  }, { onConflict: "companyId,provider" });
}
async function disconnectIntegration(companyId, provider) {
  if (isTestMode()) return;
  const db = getDb();
  await db.from("integration_settings").update({ connected: false, credentials: null, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("companyId", companyId).eq("provider", provider);
}
async function getIntegrationsStatus(companyId) {
  if (isTestMode()) return testGetIntegrationsStatus();
  const db = getDb();
  const { data } = await db.from("integration_settings").select("provider, connected").eq("companyId", companyId);
  const rows = data ?? [];
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  return {
    mercadopago: byProvider.get("mercadopago")?.connected ?? false,
    uber_direct: byProvider.get("uber_direct")?.connected ?? false,
    lalamove: byProvider.get("lalamove")?.connected ?? false,
    own_courier: byProvider.get("own_courier")?.connected ?? false,
    messaging: byProvider.get("messaging")?.connected ?? false
  };
}
async function getActiveDeliveryProvider(companyId) {
  const status = await getIntegrationsStatus(companyId);
  if (status.uber_direct) return "uber_direct";
  if (status.lalamove) return "lalamove";
  if (status.own_courier) return "own_courier";
  return void 0;
}
var SCHEMA, _db, ORDER_STATUS_FLOW;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_testData();
    init_testStore();
    init_crypto();
    SCHEMA = "marmitaria";
    _db = null;
    ORDER_STATUS_FLOW = ["received", "preparing", "ready", "out_for_delivery", "delivered"];
  }
});

// server/companies.ts
var companies_exports = {};
__export(companies_exports, {
  createCompany: () => createCompany,
  getCompanyById: () => getCompanyById,
  getCompanyBySlug: () => getCompanyBySlug,
  isSlugAvailableFormat: () => isSlugAvailableFormat,
  listCompanies: () => listCompanies,
  setCompanyStatus: () => setCompanyStatus,
  updateCompanyBranding: () => updateCompanyBranding
});
function isSlugAvailableFormat(slug) {
  return /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.has(slug);
}
async function getCompanyBySlug(slug) {
  const db = getDb();
  const { data, error } = await db.from("companies").select("*").eq("slug", slug).limit(1).maybeSingle();
  if (error) throw new Error(`[DB] Falha ao consultar empresas: ${error.message}`);
  return data ?? void 0;
}
async function getCompanyById(id) {
  const db = getDb();
  const { data } = await db.from("companies").select("*").eq("id", id).limit(1).single();
  return data ?? void 0;
}
async function createCompany(input) {
  const db = getDb();
  const { data, error } = await db.from("companies").insert(input).select("*").single();
  if (error || !data) throw new Error(`[DB] Falha ao criar empresa: ${error?.message ?? "sem retorno"}`);
  return data;
}
async function listCompanies() {
  const db = getDb();
  const { data: companies } = await db.from("companies").select("*").order("createdAt");
  if (!companies) return [];
  const results = await Promise.all(companies.map(async (company) => {
    const { data: orders2 } = await db.from("orders").select("total, platformFeeAmount").eq("companyId", company.id).eq("paymentStatus", "approved");
    const rows = orders2 ?? [];
    const revenue = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
    const platformFee = rows.reduce((sum, r) => sum + Number(r.platformFeeAmount ?? 0), 0);
    return { company, revenue, platformFee, orderCount: rows.length };
  }));
  return results;
}
async function setCompanyStatus(companyId, status) {
  const db = getDb();
  await db.from("companies").update({ status }).eq("id", companyId);
}
async function updateCompanyBranding(companyId, input) {
  const db = getDb();
  await db.from("companies").update(input).eq("id", companyId);
}
var RESERVED_SLUGS;
var init_companies = __esm({
  "server/companies.ts"() {
    "use strict";
    init_db();
    RESERVED_SLUGS = /* @__PURE__ */ new Set(["admin-login", "super-admin", "cadastrar", "api", "404", "admin", "cozinha"]);
  }
});

// server/vercel-handler.ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

// server/routers.ts
import { TRPCError as TRPCError2 } from "@trpc/server";
import { z as z2 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// shared/const.ts
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

// server/_core/supabaseAuth.ts
init_db();
init_env();
import { createRemoteJWKSet, jwtVerify } from "jose";
var getJWKS = /* @__PURE__ */ (() => {
  let jwks = null;
  return () => {
    if (!jwks) {
      const baseUrl = (ENV.supabaseUrl || process.env.VITE_SUPABASE_URL).replace(/\/$/, "");
      jwks = createRemoteJWKSet(new URL(`${baseUrl}/auth/v1/.well-known/jwks.json`));
    }
    return jwks;
  };
})();
function getBearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    return header.slice(7);
  }
  return void 0;
}
async function verifySupabaseJwt(token) {
  try {
    const { payload } = await jwtVerify(token, getJWKS());
    const sub = payload.sub;
    const email = typeof payload.email === "string" ? payload.email : void 0;
    if (typeof sub !== "string") return null;
    return { sub, email };
  } catch (error) {
    console.warn("[Auth] Supabase JWT verification failed:", String(error));
    return null;
  }
}
async function authenticateRequest(req) {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing bearer token");
  const claims = await verifySupabaseJwt(token);
  if (!claims) throw new Error("Invalid session token");
  let user = await getUserBySupabaseId(claims.sub);
  if (!user) {
    await upsertUser({ supabaseUserId: claims.sub, email: claims.email ?? null, lastSignedIn: (/* @__PURE__ */ new Date()).toISOString() });
    user = await getUserBySupabaseId(claims.sub);
  } else {
    await upsertUser({ supabaseUserId: claims.sub, lastSignedIn: (/* @__PURE__ */ new Date()).toISOString() });
  }
  if (!user) throw new Error("User could not be synced");
  return user;
}
function isOwnerEmail(email) {
  if (!email || !ENV.ownerEmail) return false;
  return email.toLowerCase() === ENV.ownerEmail;
}

// server/_core/trpc.ts
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var superAdminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || !isOwnerEmail(ctx.user.email)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao propriet\xE1rio." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin" && !isOwnerEmail(ctx.user.email)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);
var companyAdminProcedure = adminProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user?.companyId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Conta n\xE3o est\xE1 vinculada a nenhuma empresa." });
    }
    return next({ ctx: { ...ctx, companyId: ctx.user.companyId } });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  }))
});

// server/routers.ts
init_companies();
init_testData();

// shared/delivery.ts
function unavailableDeliveryResponse(provider, reason) {
  return {
    provider,
    available: false,
    trackingUrl: null,
    reason: reason ?? "Conecte um provedor de entrega em Integra\xE7\xF5es para ativar o despacho autom\xE1tico."
  };
}

// server/routers.ts
init_db();

// server/integrations/mercadoPago.ts
init_env();
init_db();
var MP_AUTHORIZE_URL = "https://auth.mercadopago.com/authorization";
var MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
var MP_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";
function isMercadoPagoConfigured() {
  return Boolean(ENV.mpClientId && ENV.mpClientSecret && ENV.mpRedirectUri);
}
function buildAuthorizeUrl(companyId) {
  const url = new URL(MP_AUTHORIZE_URL);
  url.searchParams.set("client_id", ENV.mpClientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", ENV.mpRedirectUri);
  url.searchParams.set("state", Buffer.from(JSON.stringify({ companyId, nonce: Math.random().toString(36).slice(2) })).toString("base64"));
  return url.toString();
}
async function refreshCredentials(refreshToken) {
  const response = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: ENV.mpClientId,
      client_secret: ENV.mpClientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Mercado Pago token refresh failed (${response.status}): ${detail}`);
  }
  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    publicKey: data.public_key,
    userId: data.user_id,
    liveMode: data.live_mode
  };
}
async function getConnectedCredentials(companyId) {
  return getIntegrationCredentials(companyId, "mercadopago");
}
async function saveCredentials(companyId, credentials) {
  await saveIntegrationCredentials(companyId, "mercadopago", credentials, { publicKey: credentials.publicKey, userId: credentials.userId, liveMode: credentials.liveMode });
}
function computeApplicationFee(transactionAmount) {
  return Math.round(transactionAmount * (ENV.platformFeePercent / 100) * 100) / 100;
}
async function createPayment(input) {
  const credentials = await getConnectedCredentials(input.companyId);
  if (!credentials) throw new Error("Mercado Pago is not connected");
  const applicationFee = computeApplicationFee(input.transactionAmount);
  const body = {
    transaction_amount: input.transactionAmount,
    application_fee: applicationFee,
    description: input.description,
    payment_method_id: input.paymentMethodId,
    token: input.token,
    installments: input.installments ?? 1,
    issuer_id: input.issuerId,
    payer: { email: input.payer.email, first_name: input.payer.firstName },
    external_reference: String(input.orderId),
    notification_url: ENV.mpRedirectUri ? `${new URL("/api/webhooks/mercadopago", ENV.mpRedirectUri).toString()}?companyId=${input.companyId}` : void 0
  };
  const attempt = async (accessToken) => fetch(MP_PAYMENTS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": `order-${input.orderId}`
    },
    body: JSON.stringify(body)
  });
  let response = await attempt(credentials.accessToken);
  if (response.status === 401) {
    const refreshed = await refreshCredentials(credentials.refreshToken);
    await saveCredentials(input.companyId, refreshed);
    response = await attempt(refreshed.accessToken);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Mercado Pago payment creation failed (${response.status}): ${detail}`);
  }
  const payment = await response.json();
  return { ...payment, applicationFee };
}

// server/integrations/uberDirect.ts
init_db();
var UBER_TOKEN_URL = "https://auth.uber.com/oauth/v2/token";
var UBER_API_BASE = "https://api.uber.com/v1";
var tokenCache = /* @__PURE__ */ new Map();
async function getAccessToken(companyId, credentials) {
  const cached = tokenCache.get(companyId);
  if (cached && cached.expiresAt > Date.now() + 3e4) return cached.accessToken;
  const response = await fetch(UBER_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "client_credentials",
      scope: "eats.deliveries"
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Uber Direct auth failed (${response.status}): ${detail}`);
  }
  const data = await response.json();
  tokenCache.set(companyId, { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1e3 });
  return data.access_token;
}
async function createDelivery(input) {
  const credentials = await getIntegrationCredentials(input.companyId, "uber_direct");
  if (!credentials) throw new Error("Uber Direct is not configured for this company");
  if (!input.pickupAddress) throw new Error("Company pickup address is not configured");
  const token = await getAccessToken(input.companyId, credentials);
  const response = await fetch(`${UBER_API_BASE}/customers/${credentials.customerId}/deliveries`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      pickup_address: input.pickupAddress,
      pickup_name: input.companyName,
      dropoff_address: input.dropoffAddress,
      dropoff_name: input.dropoffName,
      dropoff_phone_number: input.dropoffPhone,
      manifest_items: input.manifestItems.map((item) => ({ name: item.name, quantity: item.quantity })),
      external_id: `order-${input.orderId}`
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Uber Direct delivery creation failed (${response.status}): ${detail}`);
  }
  const data = await response.json();
  return { deliveryId: data.id, trackingUrl: data.tracking_url, status: data.status };
}

// server/integrations/lalamove.ts
init_db();
import { createHmac } from "node:crypto";
var LALAMOVE_BASE_URL = "https://rest.lalamove.com";
var LALAMOVE_MARKET = "BR";
function sign(secret, method, path, timestamp, body) {
  const raw = `${timestamp}\r
${method}\r
${path}\r
\r
${body}`;
  return createHmac("sha256", secret).update(raw).digest("hex");
}
async function lalamoveRequest(credentials, method, path, body = {}) {
  const timestamp = Date.now();
  const payload = method === "GET" ? "" : JSON.stringify(body);
  const signature = sign(credentials.apiSecret, method, path, timestamp, payload);
  const response = await fetch(`${LALAMOVE_BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `hmac ${credentials.apiKey}:${timestamp}:${signature}`,
      market: LALAMOVE_MARKET
    },
    body: method === "GET" ? void 0 : payload
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Lalamove request failed (${response.status}): ${detail}`);
  }
  return response.json();
}
async function createDelivery2(input) {
  const credentials = await getIntegrationCredentials(input.companyId, "lalamove");
  if (!credentials) throw new Error("Lalamove is not configured for this company");
  if (!input.pickupAddress) throw new Error("Company pickup address is not configured");
  const quotation = await lalamoveRequest(credentials, "POST", "/v3/quotations", {
    data: {
      serviceType: "MOTORCYCLE",
      language: "pt_BR",
      stops: [
        { address: input.pickupAddress },
        { address: input.dropoffAddress }
      ]
    }
  });
  const [pickupStop, dropoffStop] = quotation.data.stops;
  const order = await lalamoveRequest(credentials, "POST", "/v3/orders", {
    data: {
      quotationId: quotation.data.quotationId,
      sender: { stopId: pickupStop.stopId, name: "Cozinha", phone: input.dropoffPhone },
      recipients: [{ stopId: dropoffStop.stopId, name: input.dropoffName, phone: input.dropoffPhone }],
      metadata: { orderId: String(input.orderId) }
    }
  });
  return {
    deliveryId: order.data.orderId,
    trackingUrl: order.data.shareLink ?? "",
    status: order.data.status
  };
}

// server/routers.ts
async function requireCompanyBySlug(slug) {
  if (isTestMode()) return buildTestCompany(slug);
  const company = await getCompanyBySlug(slug);
  if (!company) throw new TRPCError2({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  return company;
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user ? { ...opts.ctx.user, isSuperAdmin: isOwnerEmail(opts.ctx.user.email) } : null)
  }),
  company: router({
    bySlug: publicProcedure.input(z2.object({ slug: z2.string() })).query(async ({ input }) => {
      if (isTestMode()) return buildTestCompany(input.slug);
      const company = await getCompanyBySlug(input.slug);
      return company ?? null;
    }),
    // The authenticated admin's own company (for the Admin/Integrações panels).
    mine: companyAdminProcedure.query(({ ctx }) => getCompanyById(ctx.companyId)),
    updateBranding: companyAdminProcedure.input(z2.object({
      name: z2.string().min(2).optional(),
      tagline: z2.string().optional(),
      logoUrl: z2.string().url().optional(),
      heroImageUrl: z2.string().url().optional(),
      primaryColor: z2.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      templateId: z2.enum(["classic", "modern", "cover", "premium"]).optional(),
      pickupAddress: z2.string().min(5).optional()
    })).mutation(({ ctx, input }) => updateCompanyBranding(ctx.companyId, input)),
    // Completes signup for an already-authenticated Supabase user (see client/src/pages/CompanySignUp.tsx
    // for why this is a second step rather than done at supabase.auth.signUp time).
    signUp: protectedProcedure.input(z2.object({
      name: z2.string().min(2),
      slug: z2.string().min(3).max(60)
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.companyId) throw new TRPCError2({ code: "BAD_REQUEST", message: "Esta conta j\xE1 est\xE1 vinculada a uma empresa." });
      if (!isSlugAvailableFormat(input.slug)) throw new TRPCError2({ code: "BAD_REQUEST", message: "Esse endere\xE7o n\xE3o \xE9 v\xE1lido ou est\xE1 reservado." });
      if (await getCompanyBySlug(input.slug)) throw new TRPCError2({ code: "CONFLICT", message: "Esse endere\xE7o j\xE1 est\xE1 em uso." });
      const company = await createCompany({ slug: input.slug, name: input.name });
      await upsertUser({ supabaseUserId: ctx.user.supabaseUserId, companyId: company.id, role: "admin" });
      return { slug: company.slug };
    }),
    checkSlug: publicProcedure.input(z2.object({ slug: z2.string() })).query(async ({ input }) => {
      if (!isSlugAvailableFormat(input.slug)) return { available: false };
      return { available: !await getCompanyBySlug(input.slug) };
    }),
    // Platform owner's view of every tenant.
    list: superAdminProcedure.query(() => listCompanies()),
    setStatus: superAdminProcedure.input(z2.object({ companyId: z2.number().int().positive(), status: z2.enum(["active", "suspended"]) })).mutation(({ input }) => setCompanyStatus(input.companyId, input.status))
  }),
  menu: router({
    list: publicProcedure.input(z2.object({ companySlug: z2.string() })).query(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      return listActiveMenu(company.id);
    })
  }),
  orders: router({
    recent: companyAdminProcedure.input(z2.object({ limit: z2.number().min(1).max(100).default(20) }).optional()).query(({ ctx, input }) => listRecentOrders(ctx.companyId, input?.limit ?? 20)),
    byId: publicProcedure.input(z2.object({ companySlug: z2.string(), id: z2.number().int().positive() })).query(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      return getOrderById(company.id, input.id);
    }),
    create: publicProcedure.input(z2.object({
      companySlug: z2.string(),
      name: z2.string().min(2),
      phone: z2.string().min(8),
      address: z2.string().min(5),
      subtotal: z2.number().nonnegative(),
      deliveryFee: z2.number().nonnegative(),
      total: z2.number().positive(),
      notes: z2.string().optional(),
      paymentMethod: z2.string().optional(),
      items: z2.array(z2.object({ menuItemId: z2.number().int().positive(), itemName: z2.string().min(1), quantity: z2.number().int().positive(), unitPrice: z2.number().nonnegative(), observation: z2.string().optional() })).min(1)
    })).mutation(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      if (company.status !== "active") throw new TRPCError2({ code: "FORBIDDEN", message: "Esta loja n\xE3o est\xE1 dispon\xEDvel no momento." });
      const { companySlug, ...orderInput } = input;
      return createCustomerOrder(company.id, orderInput);
    }),
    history: publicProcedure.input(z2.object({ companySlug: z2.string(), phone: z2.string().min(8) })).query(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      return listCustomerOrders(company.id, input.phone);
    }),
    advanceStatus: companyAdminProcedure.input(z2.object({ id: z2.number().int().positive(), status: z2.enum(ORDER_STATUS_FLOW) })).mutation(async ({ ctx, input }) => {
      const result = await advanceOrderStatus(ctx.companyId, input.id, input.status);
      if (input.status !== "ready" || !result.persisted) return { ...result, delivery: null };
      const provider = await getActiveDeliveryProvider(ctx.companyId);
      if (!provider) return { ...result, delivery: unavailableDeliveryResponse("uber_direct", "Nenhum provedor de entrega conectado. Configure em Integra\xE7\xF5es.") };
      if (provider === "own_courier") {
        return { ...result, delivery: { provider: "own_courier", available: true, trackingUrl: null } };
      }
      try {
        const [company, order] = await Promise.all([getCompanyById(ctx.companyId), getOrderById(ctx.companyId, input.id)]);
        if (!company?.pickupAddress) return { ...result, delivery: unavailableDeliveryResponse(provider, "Cadastre o endere\xE7o de retirada da empresa em Integra\xE7\xF5es.") };
        if (!order?.customer) return { ...result, delivery: unavailableDeliveryResponse(provider, "Pedido sem endere\xE7o de entrega associado.") };
        const deliveryInput = {
          companyId: ctx.companyId,
          pickupAddress: company.pickupAddress,
          orderId: input.id,
          dropoffAddress: order.customer.address ?? "",
          dropoffName: order.customer.name,
          dropoffPhone: order.customer.phone
        };
        const delivery = provider === "uber_direct" ? await createDelivery({ ...deliveryInput, companyName: company.name, manifestItems: order.items.map((item) => ({ name: item.itemName, quantity: item.quantity })) }) : await createDelivery2(deliveryInput);
        await setOrderDelivery(input.id, { trackingUrl: delivery.trackingUrl, externalDeliveryId: delivery.deliveryId });
        return { ...result, delivery: { provider, available: true, trackingUrl: delivery.trackingUrl } };
      } catch (error) {
        console.error(`[Delivery] ${provider} dispatch failed:`, error);
        return { ...result, delivery: unavailableDeliveryResponse(provider, "Falha ao acionar o despacho autom\xE1tico. Tente novamente ou acione manualmente.") };
      }
    })
  }),
  dashboard: router({
    summary: companyAdminProcedure.query(({ ctx }) => getDashboardSummary(ctx.companyId))
  }),
  adminMenu: router({
    list: companyAdminProcedure.query(({ ctx }) => listAdminMenu(ctx.companyId))
  }),
  inventory: router({
    list: companyAdminProcedure.query(({ ctx }) => listInventory(ctx.companyId))
  }),
  finance: router({
    recentExpenses: companyAdminProcedure.input(z2.object({ limit: z2.number().int().min(1).max(100).default(50) }).optional()).query(({ ctx, input }) => listRecentExpenses(ctx.companyId, input?.limit ?? 50))
  }),
  payments: router({
    // Public: the customer checkout needs to know whether to render the live
    // Payment Brick (Pix/crédito/débito) and the seller's
    // public key to initialize the Brick client-side. Never expose the access token.
    checkoutConfig: publicProcedure.input(z2.object({ companySlug: z2.string() })).query(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      const credentials = await getConnectedCredentials(company.id);
      return { connected: Boolean(credentials), publicKey: credentials?.publicKey ?? null };
    }),
    // Amount/description are derived from the persisted order — never trust
    // the client for the charge amount.
    create: publicProcedure.input(z2.object({
      companySlug: z2.string(),
      orderId: z2.number().int().positive(),
      payerEmail: z2.string().email(),
      payerFirstName: z2.string().optional(),
      paymentMethodId: z2.string().optional(),
      token: z2.string().optional(),
      installments: z2.number().int().positive().optional(),
      issuerId: z2.string().optional()
    })).mutation(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      const order = await getOrderById(company.id, input.orderId);
      if (!order) throw new TRPCError2({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado" });
      const payment = await createPayment({
        companyId: company.id,
        orderId: input.orderId,
        transactionAmount: Number(order.order.total),
        description: `Pedido #${input.orderId} \u2014 ${company.name}`,
        payer: { email: input.payerEmail, firstName: input.payerFirstName },
        paymentMethodId: input.paymentMethodId,
        token: input.token,
        installments: input.installments,
        issuerId: input.issuerId
      });
      const paymentStatus = payment.status === "approved" || payment.status === "rejected" ? payment.status : "pending";
      await setOrderPayment(input.orderId, { paymentStatus, externalPaymentId: String(payment.id), platformFeeAmount: payment.applicationFee.toFixed(2) });
      return payment;
    })
  }),
  integrations: router({
    status: companyAdminProcedure.query(async ({ ctx }) => {
      const persisted = await getIntegrationsStatus(ctx.companyId);
      return {
        mercadopago: { connected: persisted.mercadopago, configured: isMercadoPagoConfigured() },
        uberDirect: { connected: persisted.uber_direct },
        lalamove: { connected: persisted.lalamove },
        ownCourier: { connected: persisted.own_courier },
        ninetyNineDelivery: { connected: false, reason: "Sem API self-service p\xFAblica \u2014 depende de parceria comercial com a 99." },
        messaging: { connected: persisted.messaging }
      };
    }),
    mercadoPagoConnectUrl: companyAdminProcedure.query(({ ctx }) => {
      if (!isMercadoPagoConfigured()) throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: "Configure MP_CLIENT_ID, MP_CLIENT_SECRET e MP_REDIRECT_URI no servidor primeiro." });
      return { url: buildAuthorizeUrl(ctx.companyId) };
    }),
    setDeliveryProvider: companyAdminProcedure.input(z2.discriminatedUnion("provider", [
      z2.object({ provider: z2.literal("uber_direct"), clientId: z2.string().min(1), clientSecret: z2.string().min(1), customerId: z2.string().min(1) }),
      z2.object({ provider: z2.literal("lalamove"), apiKey: z2.string().min(1), apiSecret: z2.string().min(1) }),
      z2.object({ provider: z2.literal("own_courier"), name: z2.string().min(1), phone: z2.string().min(8) })
    ])).mutation(async ({ ctx, input }) => {
      const { provider, ...credentials } = input;
      await saveIntegrationCredentials(ctx.companyId, provider, credentials);
      return { success: true };
    }),
    saveMessagingCredentials: companyAdminProcedure.input(z2.object({ providerToken: z2.string().min(1), sender: z2.string().min(1) })).mutation(async ({ ctx, input }) => {
      await saveIntegrationCredentials(ctx.companyId, "messaging", { providerToken: input.providerToken, sender: input.sender });
      return { success: true };
    })
  })
});

// server/_core/context.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
var EXPECTED_AUTH_ERRORS = /* @__PURE__ */ new Set(["Missing bearer token", "Invalid session token"]);
async function createContext(opts) {
  let user = null;
  try {
    user = await authenticateRequest(opts.req);
  } catch (error) {
    if (!(error instanceof Error) || !EXPECTED_AUTH_ERRORS.has(error.message)) {
      console.error("[Auth] Falha ao sincronizar usu\xE1rio:", error);
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Falha ao acessar o banco de dados. Confira o schema marmitaria no Supabase (SETUP.md, passos 4 e 5)."
      });
    }
    user = null;
  }
  return { req: opts.req, res: opts.res, user };
}

// server/vercel-handler.ts
init_env();
async function handleMercadoPagoCallback(req, res) {
  const url = new URL(req.url ?? "", `https://${req.headers.host}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    res.writeHead(400).end("C\xF3digo de autoriza\xE7\xE3o ausente.");
    return;
  }
  let companyId;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    if (!Number.isInteger(parsed.companyId)) throw new Error("Invalid state");
    companyId = parsed.companyId;
  } catch {
    res.writeHead(400).end("Estado da autoriza\xE7\xE3o inv\xE1lido.");
    return;
  }
  const { getCompanyById: getCompanyById2 } = await Promise.resolve().then(() => (init_companies(), companies_exports));
  const { saveIntegrationCredentials: saveIntegrationCredentials2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const company = await getCompanyById2(companyId);
  const redirectBase = company ? `/${company.slug}/admin/integracoes` : "/admin-login";
  try {
    const clientId = process.env.MP_CLIENT_ID ?? "";
    const clientSecret = process.env.MP_CLIENT_SECRET ?? "";
    const redirectUri = process.env.MP_REDIRECT_URI ?? "";
    const tokenResp = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri })
    });
    if (!tokenResp.ok) {
      const err = await tokenResp.text().catch(() => "");
      throw new Error(`MP token exchange failed (${tokenResp.status}): ${err}`);
    }
    const data = await tokenResp.json();
    await saveIntegrationCredentials2(
      companyId,
      "mercadopago",
      { accessToken: data.access_token, refreshToken: data.refresh_token, publicKey: data.public_key, userId: data.user_id, liveMode: data.live_mode },
      { publicKey: data.public_key, userId: data.user_id, liveMode: data.live_mode }
    );
    res.writeHead(302, { Location: `${redirectBase}?mercadopago=connected` }).end();
  } catch (error) {
    console.error("[MercadoPago] OAuth callback failed:", error);
    res.writeHead(302, { Location: `${redirectBase}?mercadopago=error` }).end();
  }
}
async function handleMercadoPagoWebhook(req, res) {
  res.writeHead(200).end("ok");
  try {
    const url = new URL(req.url ?? "", `https://${req.headers.host}`);
    const companyId = Number(url.searchParams.get("companyId"));
    const body = await new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => {
        data += chunk.toString();
      });
      req.on("end", () => resolve(data));
    });
    const payload = body ? JSON.parse(body) : {};
    const paymentId = payload?.data?.id ?? url.searchParams.get("data.id");
    const topic = payload?.type ?? url.searchParams.get("type");
    if (topic && topic !== "payment") return;
    if (!paymentId || !companyId) return;
    const { getIntegrationCredentials: getIntegrationCredentials2, setOrderPayment: setOrderPayment2, findOrderByExternalPaymentId: findOrderByExternalPaymentId2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const credentials = await getIntegrationCredentials2(companyId, "mercadopago");
    if (!credentials?.accessToken) return;
    const paymentResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` }
    });
    if (!paymentResp.ok) return;
    const payment = await paymentResp.json();
    const MP_STATUS_MAP = {
      pending: "pending",
      in_process: "pending",
      authorized: "pending",
      approved: "approved",
      rejected: "rejected",
      cancelled: "rejected",
      refunded: "refunded",
      charged_back: "refunded"
    };
    const mappedStatus = MP_STATUS_MAP[payment.status] ?? "pending";
    const orderId = payment.external_reference ? Number(payment.external_reference) : void 0;
    if (!orderId) return;
    const existing = await findOrderByExternalPaymentId2(companyId, String(paymentId));
    if (!existing || existing.paymentStatus !== mappedStatus) {
      await setOrderPayment2(orderId, { paymentStatus: mappedStatus, externalPaymentId: String(paymentId) });
    }
  } catch (error) {
    console.error("[MercadoPago] Webhook processing failed:", error);
  }
}
async function handler(req, res) {
  try {
    assertRuntimeEnv();
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Configura\xE7\xE3o do servidor incompleta." }));
    return;
  }
  const url = req.url ?? "";
  if (url.startsWith("/api/mercadopago/oauth-callback")) {
    return handleMercadoPagoCallback(req, res);
  }
  if (url.startsWith("/api/webhooks/mercadopago") || url.startsWith("/api/mercadopago-webhook")) {
    return handleMercadoPagoWebhook(req, res);
  }
  const request = new Request(`https://${req.headers.host}${url}`, {
    method: req.method ?? "GET",
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v ?? ""])
    ),
    body: req.method !== "GET" && req.method !== "HEAD" ? await new Promise((resolve) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks)));
    }) : void 0
  });
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => createContext({ req, res })
  });
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  const buffer = await response.arrayBuffer();
  res.end(Buffer.from(buffer));
}
export {
  handler as default
};
