var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

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
      },
      // Link público do app (usado nos avisos ao cliente). Ex.: https://seu-app.vercel.app
      get publicAppUrl() {
        return (process.env.PUBLIC_APP_URL ?? process.env.VITE_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
      },
      // E-mails transacionais (opcional) via Resend — https://resend.com
      get resendApiKey() {
        return process.env.RESEND_API_KEY ?? "";
      },
      get emailFrom() {
        return process.env.EMAIL_FROM ?? "";
      }
      // Delivery provider credentials (Uber Direct, Lalamove) are per-company —
      // see `server/db.ts` `getIntegrationCredentials`, not env vars.
    };
  }
});

// shared/checkout.ts
function calculateDeliveryFee(subtotal, address, deliveryConfigured, addressNumber, quotedFee = 0) {
  if (subtotal <= 0 || !address?.trim() || !addressNumber?.trim() || !deliveryConfigured)
    return 0;
  if (!Number.isFinite(quotedFee) || quotedFee < 0) return 0;
  return Math.round(quotedFee * 100) / 100;
}
var init_checkout = __esm({
  "shared/checkout.ts"() {
    "use strict";
  }
});

// shared/finance.ts
function buildFinanceReport(from, to, sourceOrders, sourceExpenses, items) {
  const orders2 = sourceOrders.filter((order) => {
    const key = brazilDay(order.paymentApprovedAt || order.createdAt);
    return key >= from && key <= to;
  });
  const expenses2 = sourceExpenses.filter((expense) => {
    const key = brazilDay(expense.incurredAt);
    return key >= from && key <= to;
  });
  const approved = orders2.filter((order) => order.paymentStatus === "approved");
  const pending = orders2.filter((order) => order.paymentStatus === "pending");
  const revenue = approved.reduce((sum, order) => sum + amount(order.total), 0);
  const expensesTotal = expenses2.reduce((sum, expense) => sum + amount(expense.amount), 0);
  const pendingRevenue = pending.reduce((sum, order) => sum + amount(order.total), 0);
  const platformFees = approved.reduce((sum, order) => sum + amount(order.platformFeeAmount), 0);
  const days = Math.max(1, Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 864e5) + 1);
  const monthly = days > 90;
  const bucket = (date) => {
    const key = brazilDay(date);
    return monthly ? key.slice(0, 7) : key;
  };
  const buckets = /* @__PURE__ */ new Map();
  if (monthly) {
    let cursor = /* @__PURE__ */ new Date(`${from.slice(0, 7)}-01T12:00:00Z`);
    const last = `${to.slice(0, 7)}-01`;
    while (cursor.toISOString().slice(0, 10) <= last) {
      const key = cursor.toISOString().slice(0, 7);
      buckets.set(key, { date: key, label: dayLabel(key, true), revenue: 0, expenses: 0, orders: 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  } else {
    let cursor = /* @__PURE__ */ new Date(`${from}T12:00:00Z`);
    const last = Date.parse(`${to}T12:00:00Z`);
    while (cursor.getTime() <= last) {
      const key = cursor.toISOString().slice(0, 10);
      buckets.set(key, { date: key, label: dayLabel(key, false), revenue: 0, expenses: 0, orders: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  for (const order of approved) {
    const point = buckets.get(bucket(order.paymentApprovedAt || order.createdAt));
    if (point) {
      point.revenue += amount(order.total);
      point.orders += 1;
    }
  }
  for (const expense of expenses2) {
    const point = buckets.get(bucket(expense.incurredAt));
    if (point) point.expenses += amount(expense.amount);
  }
  const categories2 = /* @__PURE__ */ new Map();
  for (const expense of expenses2) {
    const name = expense.category?.trim() || "Outros";
    const value = categories2.get(name) ?? { name, value: 0, count: 0 };
    value.value += amount(expense.amount);
    value.count += 1;
    categories2.set(name, value);
  }
  const methods = /* @__PURE__ */ new Map();
  for (const order of approved) {
    const key = order.paymentMethod || "pending";
    const name = PAYMENT_LABELS[key] ?? key.replaceAll("_", " ");
    const value = methods.get(name) ?? { name, revenue: 0, count: 0 };
    value.revenue += amount(order.total);
    value.count += 1;
    methods.set(name, value);
  }
  const paidIds = new Set(approved.map((order) => order.id));
  const products = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (!paidIds.has(item.orderId)) continue;
    const value = products.get(item.itemName) ?? { name: item.itemName, units: 0, revenue: 0 };
    value.units += item.quantity;
    value.revenue += item.quantity * amount(item.unitPrice);
    products.set(item.itemName, value);
  }
  return {
    from,
    to,
    monthly,
    summary: { revenue, expenses: expensesTotal, operatingBalance: revenue - expensesTotal, approvedOrders: approved.length, averageTicket: approved.length ? revenue / approved.length : 0, pendingRevenue, pendingOrders: pending.length, platformFees, marginPercent: revenue ? (revenue - expensesTotal) / revenue * 100 : 0 },
    timeline: Array.from(buckets.values()).map((point) => ({ ...point, balance: point.revenue - point.expenses })),
    expenseCategories: Array.from(categories2.values()).sort((a, b) => b.value - a.value),
    paymentMethods: Array.from(methods.values()).sort((a, b) => b.revenue - a.revenue),
    topProducts: Array.from(products.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    recentExpenses: [...expenses2].sort((a, b) => b.incurredAt.localeCompare(a.incurredAt)).slice(0, 20)
  };
}
var amount, brazilDay, dayLabel, PAYMENT_LABELS;
var init_finance = __esm({
  "shared/finance.ts"() {
    "use strict";
    amount = (value) => {
      const parsed = Number(value ?? 0);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    brazilDay = (value) => {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return value.slice(0, 10);
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
      const get = (key) => parts.find((part) => part.type === key)?.value ?? "00";
      return `${get("year")}-${get("month")}-${get("day")}`;
    };
    dayLabel = (key, monthly) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...monthly ? { month: "short", year: "2-digit" } : { day: "2-digit", month: "short" } }).format(/* @__PURE__ */ new Date(`${monthly ? `${key}-01` : key}T12:00:00-03:00`));
    PAYMENT_LABELS = { pix: "Pix", credit_card: "Cart\xE3o de cr\xE9dito", debit_card: "Cart\xE3o de d\xE9bito", cash_on_delivery: "Dinheiro na entrega", mercadopago_link: "Link Mercado Pago", manual: "Manual", pending: "A definir" };
  }
});

// shared/payment-messages.ts
function isReadyForKitchen(order) {
  return order.paymentMethod !== "mercadopago" || order.paymentStatus === "approved";
}
var init_payment_messages = __esm({
  "shared/payment-messages.ts"() {
    "use strict";
  }
});

// shared/store-rules.ts
function isPickupOrder(order) {
  return order.deliveryAddress === PICKUP_ADDRESS;
}
function saoPauloClock(now2) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now2);
  const read = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      read("weekday")
    ),
    minutes: Number(read("hour")) * 60 + Number(read("minute"))
  };
}
function getStoreStatus(hours, now2 = /* @__PURE__ */ new Date()) {
  if (!Array.isArray(hours) || hours.length !== 7)
    return { open: true, label: null };
  const { day, minutes } = saoPauloClock(now2);
  const today = hours[day];
  const yesterday = hours[(day + 6) % 7];
  if (yesterday.enabled && toMinutes(yesterday.close) <= toMinutes(yesterday.open) && minutes < toMinutes(yesterday.close))
    return { open: true, label: `Aberto at\xE9 ${yesterday.close}` };
  if (today.enabled && minutes >= toMinutes(today.open)) {
    const crossesMidnight = toMinutes(today.close) <= toMinutes(today.open);
    if (crossesMidnight || minutes < toMinutes(today.close))
      return { open: true, label: `Aberto at\xE9 ${today.close}` };
  }
  if (today.enabled && minutes < toMinutes(today.open))
    return { open: false, label: `Fechado \xB7 abre hoje \xE0s ${today.open}` };
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = hours[(day + offset) % 7];
    if (!next.enabled) continue;
    const when = offset === 1 ? "amanh\xE3" : WEEKDAY_LABELS[(day + offset) % 7].toLowerCase();
    return { open: false, label: `Fechado \xB7 abre ${when} \xE0s ${next.open}` };
  }
  return { open: false, label: "Fechado no momento" };
}
var PICKUP_ADDRESS, WEEKDAY_LABELS, DEFAULT_OPENING_HOURS, toMinutes;
var init_store_rules = __esm({
  "shared/store-rules.ts"() {
    "use strict";
    PICKUP_ADDRESS = "Retirada na loja";
    WEEKDAY_LABELS = [
      "Domingo",
      "Segunda",
      "Ter\xE7a",
      "Quarta",
      "Quinta",
      "Sexta",
      "S\xE1bado"
    ];
    DEFAULT_OPENING_HOURS = WEEKDAY_LABELS.map(
      (_, day) => ({
        enabled: day >= 1 && day <= 5,
        open: "11:00",
        close: "14:30"
      })
    );
    toMinutes = (time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    };
  }
});

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
    openingHours: null,
    acceptsCashOnDelivery: slug === "loja-completa",
    pickupEnabled: slug === "loja-completa",
    deliveryBaseFee: null,
    deliveryIncludedKm: null,
    deliveryPricePerKm: null,
    deliveryMaxKm: null,
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
import { createHash } from "node:crypto";
function testListActiveMenu() {
  return menu.filter((item) => item.active).map((item) => ({
    item,
    category: categories.find((category) => category.id === item.categoryId) ?? null
  }));
}
function testListAdminMenu() {
  return menu;
}
function testListMenuCategories() {
  return categories;
}
function testCreateMenuCategory(input) {
  const category = {
    id: nextCategoryId++,
    companyId: DEMO_COMPANY_ID,
    name: input.name,
    description: null,
    sortOrder: categories.length + 1,
    active: true,
    createdAt: now()
  };
  categories.push(category);
  return category;
}
function testCreateMenuItem(input) {
  if (!categories.some((category) => category.id === input.categoryId))
    return void 0;
  const timestamp = now();
  const item = {
    id: nextMenuItemId++,
    companyId: DEMO_COMPANY_ID,
    categoryId: input.categoryId,
    name: input.name,
    description: input.description ?? null,
    price: input.price.toFixed(2),
    imageUrl: input.imageUrl ?? null,
    active: input.active ?? true,
    featured: input.featured ?? false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  menu.push(item);
  return item;
}
function testUpdateMenuItem(id, input) {
  const item = menu.find((value) => value.id === id);
  if (!item) return void 0;
  const { price, ...rest } = input;
  Object.assign(
    item,
    rest,
    price === void 0 ? {} : { price: price.toFixed(2) },
    { updatedAt: now() }
  );
  return item;
}
function testDeleteMenuItem(id) {
  const index = menu.findIndex((value) => value.id === id);
  if (index < 0) return false;
  menu.splice(index, 1);
  return true;
}
function testListRecipeIngredients() {
  return recipeLines;
}
function testSaveRecipe(input) {
  if (!menu.some((item) => item.id === input.menuItemId)) return false;
  recipeLines = [
    ...recipeLines.filter((line) => line.menuItemId !== input.menuItemId),
    ...input.lines.map((line) => ({ ...line, menuItemId: input.menuItemId }))
  ];
  return true;
}
function testListInventory() {
  return inventoryItems.filter((item) => item.active);
}
function testCreateInventoryItem(input) {
  const item = {
    id: nextInventoryItemId++,
    companyId: DEMO_COMPANY_ID,
    name: input.name,
    unit: input.unit,
    currentQuantity: "0.000",
    minimumQuantity: input.minimumQuantity.toFixed(3),
    costPerUnit: input.costPerUnit.toFixed(2),
    active: true,
    updatedAt: now()
  };
  inventoryItems.push(item);
  return item;
}
function testUpdateInventoryItem(input) {
  const item = inventoryItems.find((entry) => entry.id === input.itemId);
  if (!item) return false;
  if (input.lastSupplier !== void 0)
    Object.assign(item, { lastSupplier: input.lastSupplier });
  if (input.costPerUnit !== void 0)
    item.costPerUnit = input.costPerUnit.toFixed(2);
  if (input.minimumQuantity !== void 0)
    item.minimumQuantity = input.minimumQuantity.toFixed(3);
  if (input.active !== void 0) item.active = input.active;
  return true;
}
function testRecordInventoryMovement(input) {
  const item = inventoryItems.find(
    (value) => value.id === input.itemId && value.active
  );
  if (!item) return void 0;
  const current = Number(item.currentQuantity);
  if (input.type === "out" && input.quantity > current)
    throw new Error("Estoque insuficiente para essa sa\xEDda.");
  const next = input.type === "in" ? current + input.quantity : input.type === "out" ? current - input.quantity : input.quantity;
  item.currentQuantity = next.toFixed(3);
  item.updatedAt = now();
  inventoryMovements.unshift({
    id: nextMovementId++,
    inventoryItemId: item.id,
    type: input.type,
    quantity: input.quantity.toFixed(3),
    reason: input.reason,
    occurredAt: now()
  });
  return item;
}
function testListInventoryMovements(limit) {
  const names = new Map(inventoryItems.map((item) => [item.id, item]));
  return inventoryMovements.slice(0, limit).map((movement) => ({
    ...movement,
    itemName: names.get(movement.inventoryItemId)?.name ?? "Item removido",
    unit: names.get(movement.inventoryItemId)?.unit ?? "un"
  }));
}
function testListExpenses() {
  return [...expenses].sort((a, b) => b.incurredAt.localeCompare(a.incurredAt));
}
function testCreateExpense(input) {
  const expense = {
    id: nextExpenseId++,
    companyId: DEMO_COMPANY_ID,
    description: input.description,
    category: input.category,
    amount: input.amount.toFixed(2),
    incurredAt: `${input.date}T12:00:00`,
    notes: input.notes ?? null,
    createdAt: now()
  };
  expenses.push(expense);
  return expense;
}
function testFinanceReport(from, to) {
  const financeOrders = orders.map(({ order }) => ({
    id: order.id,
    createdAt: order.createdAt,
    paymentApprovedAt: order.paymentApprovedAt,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    total: order.total,
    platformFeeAmount: order.platformFeeAmount
  }));
  const financeItems = orders.flatMap(
    ({ items }) => items.map((item) => ({
      orderId: item.orderId,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    }))
  );
  return {
    ...buildFinanceReport(from, to, financeOrders, expenses, financeItems),
    financeDateBasis: "paymentApprovedAt"
  };
}
function testListRecentOrders(limit) {
  return orders.slice(-limit).reverse().map(({ order, customer }) => ({ order, customer }));
}
function testGetIntegrationsStatus() {
  return {
    mercadopago: false,
    uber_direct: false,
    lalamove: false,
    own_courier: false,
    messaging: false
  };
}
function testCreateCustomerOrder(input) {
  const timestamp = now();
  let customer = customers.find((value) => value.phone === input.phone);
  if (!customer) {
    customer = {
      id: nextCustomerId++,
      companyId: DEMO_COMPANY_ID,
      name: input.name,
      phone: input.phone,
      address: `${input.address.trim()}, n\xBA ${input.addressNumber.trim()}`,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    customers.push(customer);
  } else {
    customer.name = input.name;
    customer.address = `${input.address.trim()}, n\xBA ${input.addressNumber.trim()}`;
    customer.updatedAt = timestamp;
  }
  const pricedItems = input.items.map((line) => {
    const item = menu.find(
      (value) => value.id === line.menuItemId && value.active
    );
    if (!item) throw new Error("Item indispon\xEDvel");
    return { ...line, itemName: item.name, unitPrice: Number(item.price) };
  });
  const subtotal = pricedItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  const deliveryFee = calculateDeliveryFee(
    subtotal,
    input.address,
    false,
    input.addressNumber
  );
  const orderId = nextOrderId++;
  const order = {
    id: orderId,
    companyId: DEMO_COMPANY_ID,
    customerId: customer.id,
    status: "received",
    paymentStatus: "pending",
    paymentMethod: input.paymentMethod ?? "pending",
    subtotal: subtotal.toFixed(2),
    deliveryFee: deliveryFee.toFixed(2),
    total: (subtotal + deliveryFee).toFixed(2),
    deliveryAddress: input.pickup ? PICKUP_ADDRESS : `${input.address.trim()}, n\xBA ${input.addressNumber.trim()}`,
    customerAccessTokenHash: createHash("sha256").update(input.accessToken).digest("hex"),
    customerTrackingTokenHash: createHash("sha256").update(input.customerTrackingToken).digest("hex"),
    driverTrackingTokenHash: null,
    trackingLatitude: null,
    trackingLongitude: null,
    trackingUpdatedAt: null,
    platformFeeAmount: null,
    paymentApprovedAt: null,
    notes: input.notes ?? null,
    trackingUrl: null,
    externalPaymentId: null,
    externalDeliveryId: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const items = pricedItems.map((item) => ({
    id: nextOrderItemId++,
    orderId,
    menuItemId: item.menuItemId,
    itemName: item.itemName,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toFixed(2),
    observation: item.observation ?? null
  }));
  orders.push({ order, customer, items });
  return {
    orderId,
    persisted: true,
    customerTrackingToken: input.customerTrackingToken
  };
}
function testListCustomerOrders(phone, accessToken) {
  const hash = createHash("sha256").update(accessToken).digest("hex");
  return orders.filter(
    (value) => value.customer.phone === phone && value.order.customerAccessTokenHash === hash
  ).slice(-20).reverse().map(({ order, customer }) => ({ order, customer }));
}
function testGetOrderById(id, accessToken) {
  const hash = accessToken ? createHash("sha256").update(accessToken).digest("hex") : null;
  const found = orders.find(
    (value) => value.order.id === id && (!accessToken || Boolean(hash && value.order.customerAccessTokenHash === hash))
  );
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
function testIssueDriverTrackingToken(orderId, tokenHash) {
  const found = orders.find((value) => value.order.id === orderId);
  if (!found || !["ready", "out_for_delivery"].includes(found.order.status))
    return false;
  found.order.driverTrackingTokenHash = tokenHash;
  return true;
}
function testUpdateDriverLocation(tokenHash, latitude, longitude) {
  const found = orders.find(
    (value) => value.order.driverTrackingTokenHash === tokenHash && ["ready", "out_for_delivery"].includes(value.order.status)
  );
  if (!found) return false;
  Object.assign(found.order, {
    status: "out_for_delivery",
    trackingLatitude: String(latitude),
    trackingLongitude: String(longitude),
    trackingUpdatedAt: now()
  });
  return true;
}
function testGetCustomerTracking(tokenHash) {
  const found = orders.find(
    (value) => value.order.customerTrackingTokenHash === tokenHash
  );
  if (!found) return void 0;
  return {
    orderId: found.order.id,
    companyName: "Marmitaria Demo",
    status: found.order.status,
    paymentStatus: found.order.paymentStatus,
    paymentMethod: found.order.paymentMethod,
    pickup: isPickupOrder(found.order),
    trackingUrl: found.order.trackingUrl,
    location: found.order.trackingLatitude && found.order.trackingLongitude ? {
      latitude: Number(found.order.trackingLatitude),
      longitude: Number(found.order.trackingLongitude),
      updatedAt: found.order.trackingUpdatedAt ?? null
    } : null,
    deliveryCode: null
  };
}
function testGetDriverTrackingInfo(tokenHash) {
  const found = orders.find(
    (value) => value.order.driverTrackingTokenHash === tokenHash
  );
  if (!found) return void 0;
  return {
    orderId: found.order.id,
    companyName: "Marmitaria Demo",
    customerName: found.customer.name,
    customerPhone: found.customer.phone,
    address: found.order.deliveryAddress ?? "",
    status: found.order.status,
    location: found.order.trackingLatitude && found.order.trackingLongitude ? {
      latitude: Number(found.order.trackingLatitude),
      longitude: Number(found.order.trackingLongitude),
      updatedAt: found.order.trackingUpdatedAt ?? null
    } : null
  };
}
function testConfirmDriverDelivery(tokenHash, code) {
  const found = orders.find(
    (value) => value.order.driverTrackingTokenHash === tokenHash && value.order.status === "out_for_delivery"
  );
  if (!found || found.customer.phone.replace(/\D/g, "").slice(-4) !== code)
    return false;
  Object.assign(found.order, {
    status: "delivered",
    driverTrackingTokenHash: null,
    updatedAt: now()
  });
  return true;
}
function testSetOrderPayment(orderId, input) {
  const found = orders.find((value) => value.order.id === orderId);
  if (found)
    Object.assign(found.order, input, {
      paymentApprovedAt: input.paymentStatus === "approved" ? found.order.paymentApprovedAt ?? now() : found.order.paymentApprovedAt,
      updatedAt: now()
    });
}
function testDashboardSummary() {
  const approved = orders.filter(
    (value) => value.order.paymentStatus === "approved"
  );
  const revenue = approved.reduce(
    (sum, value) => sum + Number(value.order.total),
    0
  );
  return {
    revenue,
    orders: approved.length,
    averageTicket: approved.length ? revenue / approved.length : 0
  };
}
function testFindOrderByExternalPaymentId(externalPaymentId) {
  return orders.find(
    (value) => value.order.externalPaymentId === externalPaymentId
  )?.order;
}
function testGetWhatsappBot() {
  return whatsappBot;
}
function testPatchWhatsappBot(patch) {
  whatsappBot = { ...whatsappBot ?? blankBot(), ...patch, updatedAt: now() };
  return whatsappBot;
}
var DEMO_COMPANY_ID, now, categories, menu, customers, orders, inventoryItems, inventoryMovements, expenses, nextCustomerId, nextOrderId, nextOrderItemId, nextInventoryItemId, nextMovementId, nextExpenseId, nextCategoryId, nextMenuItemId, recipeLines, whatsappBot, blankBot;
var init_testStore = __esm({
  "server/testStore.ts"() {
    "use strict";
    init_checkout();
    init_finance();
    init_store_rules();
    DEMO_COMPANY_ID = -1;
    now = () => (/* @__PURE__ */ new Date()).toISOString();
    categories = [
      {
        id: 1,
        companyId: DEMO_COMPANY_ID,
        name: "Mais pedidos",
        description: null,
        sortOrder: 1,
        active: true,
        createdAt: now()
      },
      {
        id: 2,
        companyId: DEMO_COMPANY_ID,
        name: "Leves & fit",
        description: null,
        sortOrder: 2,
        active: true,
        createdAt: now()
      },
      {
        id: 3,
        companyId: DEMO_COMPANY_ID,
        name: "Especiais",
        description: null,
        sortOrder: 3,
        active: true,
        createdAt: now()
      }
    ];
    menu = [
      {
        id: 1,
        companyId: DEMO_COMPANY_ID,
        categoryId: 1,
        name: "Caseira da semana",
        description: "Arroz soltinho, feij\xE3o cremoso, frango grelhado, pur\xEA de batata e salada fresca.",
        price: "24.90",
        imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85",
        active: true,
        featured: true,
        createdAt: now(),
        updatedAt: now()
      },
      {
        id: 2,
        companyId: DEMO_COMPANY_ID,
        categoryId: 1,
        name: "Bife acebolado",
        description: "Bife macio na chapa, arroz, feij\xE3o, farofa crocante e vinagrete da casa.",
        price: "28.90",
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=85",
        active: true,
        featured: true,
        createdAt: now(),
        updatedAt: now()
      },
      {
        id: 3,
        companyId: DEMO_COMPANY_ID,
        categoryId: 2,
        name: "Frango tropical",
        description: "Frango ao molho de laranja, arroz integral, legumes tostados e folhas.",
        price: "26.90",
        imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85",
        active: true,
        featured: false,
        createdAt: now(),
        updatedAt: now()
      },
      {
        id: 4,
        companyId: DEMO_COMPANY_ID,
        categoryId: 2,
        name: "Bowl da horta",
        description: "Quinoa, gr\xE3o-de-bico, ab\xF3bora assada, avocado e molho de ervas.",
        price: "25.90",
        imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85",
        active: true,
        featured: false,
        createdAt: now(),
        updatedAt: now()
      },
      {
        id: 5,
        companyId: DEMO_COMPANY_ID,
        categoryId: 3,
        name: "Parmegiana de domingo",
        description: "Frango empanado, molho de tomate assado, queijo gratinado e batatas r\xFAsticas.",
        price: "32.90",
        imageUrl: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=900&q=85",
        active: true,
        featured: true,
        createdAt: now(),
        updatedAt: now()
      }
    ];
    customers = [];
    orders = [];
    inventoryItems = [];
    inventoryMovements = [];
    expenses = [];
    nextCustomerId = 1;
    nextOrderId = 2e3;
    nextOrderItemId = 1;
    nextInventoryItemId = 1;
    nextMovementId = 1;
    nextExpenseId = 1;
    nextCategoryId = 100;
    nextMenuItemId = 100;
    recipeLines = [];
    blankBot = () => ({
      companyId: DEMO_COMPANY_ID,
      desired: "disconnected",
      status: "idle",
      qr: null,
      phone: null,
      error: null,
      aiEnabled: true,
      instructions: null,
      heartbeatAt: null,
      updatedAt: now()
    });
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
  BOT_HEARTBEAT_MAX_AGE_MS: () => BOT_HEARTBEAT_MAX_AGE_MS,
  DEFAULT_MENU_CATEGORIES: () => DEFAULT_MENU_CATEGORIES,
  ORDER_STATUS_FLOW: () => ORDER_STATUS_FLOW,
  advanceOrderStatus: () => advanceOrderStatus,
  claimNotification: () => claimNotification,
  confirmDriverDelivery: () => confirmDriverDelivery,
  countRecentUnpaidOrders: () => countRecentUnpaidOrders,
  createCustomerOrder: () => createCustomerOrder,
  createExpense: () => createExpense,
  createInventoryItem: () => createInventoryItem,
  createMenuCategory: () => createMenuCategory,
  createMenuItem: () => createMenuItem,
  deleteMenuItem: () => deleteMenuItem,
  disconnectIntegration: () => disconnectIntegration,
  findOrderByDriverToken: () => findOrderByDriverToken,
  findOrderByExternalPaymentId: () => findOrderByExternalPaymentId,
  finishNotification: () => finishNotification,
  getActiveDeliveryProvider: () => getActiveDeliveryProvider,
  getCustomerOrderById: () => getCustomerOrderById,
  getCustomerTracking: () => getCustomerTracking,
  getDashboardSummary: () => getDashboardSummary,
  getDb: () => getDb,
  getDriverTrackingInfo: () => getDriverTrackingInfo,
  getFinanceReport: () => getFinanceReport,
  getIntegrationCredentials: () => getIntegrationCredentials,
  getIntegrationSettings: () => getIntegrationSettings,
  getIntegrationsStatus: () => getIntegrationsStatus,
  getNotificationContext: () => getNotificationContext,
  getOrderById: () => getOrderById,
  getTrackingForEmail: () => getTrackingForEmail,
  getUserBySupabaseId: () => getUserBySupabaseId,
  getWhatsappBot: () => getWhatsappBot,
  issueDriverTrackingToken: () => issueDriverTrackingToken,
  joinMenuWithCategories: () => joinMenuWithCategories,
  joinOrdersWithCustomers: () => joinOrdersWithCustomers,
  listActiveMenu: () => listActiveMenu,
  listAdminMenu: () => listAdminMenu,
  listCustomerOrders: () => listCustomerOrders,
  listInventory: () => listInventory,
  listInventoryMovements: () => listInventoryMovements,
  listMenuCategories: () => listMenuCategories,
  listOrdersForEmail: () => listOrdersForEmail,
  listRecentExpenses: () => listRecentExpenses,
  listRecentOrders: () => listRecentOrders,
  listRecipeIngredients: () => listRecipeIngredients,
  recordInventoryMovement: () => recordInventoryMovement,
  requestWhatsappConnect: () => requestWhatsappConnect,
  requestWhatsappDisconnect: () => requestWhatsappDisconnect,
  saveIntegrationCredentials: () => saveIntegrationCredentials,
  saveRecipe: () => saveRecipe,
  setOrderDelivery: () => setOrderDelivery,
  setOrderPayment: () => setOrderPayment,
  updateDriverLocation: () => updateDriverLocation,
  updateInventoryItem: () => updateInventoryItem,
  updateMenuItem: () => updateMenuItem,
  updateWhatsappSettings: () => updateWhatsappSettings,
  upsertUser: () => upsertUser
});
import { createClient } from "@supabase/supabase-js";
import { createHash as createHash2 } from "node:crypto";
function getDb() {
  if (!_db) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !key)
      throw new Error(
        "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY s\xE3o obrigat\xF3rios"
      );
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
  const { error } = await db.from("users").upsert(values, {
    onConflict: "supabaseUserId"
  });
  if (error) throw new Error(`[DB] Falha ao salvar usu\xE1rio: ${error.message}`);
}
async function getUserBySupabaseId(supabaseUserId) {
  const db = getDb();
  const { data, error } = await db.from("users").select("*").eq("supabaseUserId", supabaseUserId).limit(1).maybeSingle();
  if (error)
    throw new Error(`[DB] Falha ao consultar usu\xE1rio: ${error.message}`);
  return data ?? void 0;
}
function joinMenuWithCategories(items, categories2) {
  const byId = new Map(categories2.map((category) => [category.id, category]));
  return items.map((item) => ({
    item,
    category: byId.get(item.categoryId) ?? null
  }));
}
async function listActiveMenu(companyId) {
  if (isTestMode()) return testListActiveMenu();
  const db = getDb();
  const [items, categories2] = await Promise.all([
    db.from("menu_items").select("*").eq("companyId", companyId).eq("active", true).order("name"),
    db.from("menu_categories").select("*").eq("companyId", companyId)
  ]);
  if (items.error)
    throw new Error(`[DB] Falha ao listar o card\xE1pio: ${items.error.message}`);
  if (categories2.error)
    throw new Error(
      `[DB] Falha ao listar categorias: ${categories2.error.message}`
    );
  return joinMenuWithCategories(
    items.data ?? [],
    categories2.data ?? []
  );
}
function joinOrdersWithCustomers(orders2, customers2) {
  const byId = new Map(customers2.map((customer) => [customer.id, customer]));
  return orders2.map((order) => ({
    order,
    customer: byId.get(order.customerId) ?? null
  }));
}
async function loadCustomersFor(db, companyId, orders2) {
  const ids = Array.from(new Set(orders2.map((order) => order.customerId)));
  if (ids.length === 0) return [];
  const { data, error } = await db.from("customers").select("*").eq("companyId", companyId).in("id", ids);
  if (error)
    throw new Error(`[DB] Falha ao consultar clientes: ${error.message}`);
  return data ?? [];
}
async function listRecentOrders(companyId, limit = 20) {
  if (isTestMode())
    return testListRecentOrders(1e3).filter(({ order }) => isReadyForKitchen(order)).slice(0, limit);
  const db = getDb();
  const { data, error } = await db.from("orders").select("*").eq("companyId", companyId).or(
    "paymentMethod.is.null,paymentMethod.neq.mercadopago,paymentStatus.eq.approved"
  ).order("createdAt", { ascending: false }).limit(limit);
  if (error) throw new Error(`[DB] Falha ao listar pedidos: ${error.message}`);
  const orders2 = data ?? [];
  return joinOrdersWithCustomers(
    orders2,
    await loadCustomersFor(db, companyId, orders2)
  );
}
async function createCustomerOrder(companyId, input) {
  if (isTestMode()) return testCreateCustomerOrder(input);
  const db = getDb();
  if (!input.address.trim() || !input.addressNumber.trim())
    throw new Error("Informe o endere\xE7o e o n\xFAmero antes de criar o pedido.");
  const fullAddress = input.pickup ? PICKUP_ADDRESS : `${input.address.trim()}, n\xBA ${input.addressNumber.trim()}`;
  const quantities = input.items.reduce((acc, item) => acc + item.quantity, 0);
  if (quantities > 100 || input.items.some((item) => item.quantity > 50))
    throw new Error("Quantidade m\xE1xima excedida.");
  const ids = Array.from(new Set(input.items.map((item) => item.menuItemId)));
  const { data: menuRows, error: menuError } = await db.from("menu_items").select("id,name,price,active").eq("companyId", companyId).eq("active", true).in("id", ids);
  if (menuError)
    throw new Error(
      `[DB] Falha ao validar itens do card\xE1pio: ${menuError.message}`
    );
  const byId = new Map((menuRows ?? []).map((row) => [row.id, row]));
  if (byId.size !== ids.length)
    throw new Error("Um ou mais itens n\xE3o est\xE3o dispon\xEDveis.");
  const pricedItems = input.items.map((item) => {
    const menu2 = byId.get(item.menuItemId);
    return { ...item, itemName: menu2.name, unitPrice: Number(menu2.price) };
  });
  const subtotal = pricedItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
  const deliveryFee = calculateDeliveryFee(
    subtotal,
    input.address,
    !input.pickup,
    input.addressNumber,
    input.deliveryFee ?? 0
  );
  const total = subtotal + deliveryFee;
  const accessTokenHash = createHash2("sha256").update(input.accessToken).digest("hex");
  const customerTrackingTokenHash = createHash2("sha256").update(input.customerTrackingToken).digest("hex");
  const customerWrite = await db.from("customers").upsert(
    {
      companyId,
      name: input.name,
      phone: input.phone,
      address: fullAddress,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    { onConflict: "companyId,phone", ignoreDuplicates: true }
  );
  if (customerWrite.error)
    throw new Error(
      `[DB] Falha ao salvar cliente: ${customerWrite.error.message}`
    );
  const { data: customerData, error: customerReadError } = await db.from("customers").select("id").eq("companyId", companyId).eq("phone", input.phone).limit(1).single();
  if (customerReadError)
    throw new Error(
      `[DB] Falha ao consultar cliente: ${customerReadError.message}`
    );
  const customer = customerData;
  if (!customer) return { orderId: null, persisted: false };
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
    paymentMethod: input.paymentMethod ?? "pending"
  };
  let notificationColumns = {};
  try {
    notificationColumns = {
      customerEmail: input.customerEmail?.trim().toLowerCase() || null,
      customerTrackingTokenEnc: encryptJson(input.customerTrackingToken)
    };
  } catch {
    notificationColumns = {
      customerEmail: input.customerEmail?.trim().toLowerCase() || null
    };
  }
  let insertResult = await db.from("orders").insert({ ...baseOrder, ...notificationColumns }).select("id").single();
  if (insertResult.error && /customerEmail|customerTrackingTokenEnc/.test(insertResult.error.message)) {
    console.warn(
      "[DB] Migra\xE7\xE3o 0007 ainda n\xE3o aplicada; criando pedido sem e-mail/avisos."
    );
    insertResult = await db.from("orders").insert(baseOrder).select("id").single();
  }
  const { data: orderData, error: orderError } = insertResult;
  if (orderError)
    throw new Error(`[DB] Falha ao criar pedido: ${orderError.message}`);
  const order = orderData;
  if (!order) return { orderId: null, persisted: false };
  if (pricedItems.length) {
    const { error: itemsError } = await db.from("order_items").insert(
      pricedItems.map((item) => ({
        orderId: order.id,
        menuItemId: item.menuItemId,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        observation: item.observation
      }))
    );
    if (itemsError) {
      await db.from("orders").delete().eq("id", order.id).eq("companyId", companyId);
      throw new Error(
        `[DB] Falha ao salvar itens do pedido: ${itemsError.message}`
      );
    }
  }
  return {
    orderId: order.id,
    persisted: true,
    customerTrackingToken: input.customerTrackingToken
  };
}
async function countRecentUnpaidOrders(companyId, phone) {
  if (isTestMode()) return 0;
  const db = getDb();
  const { data: customer } = await db.from("customers").select("id").eq("companyId", companyId).eq("phone", phone).maybeSingle();
  if (!customer) return 0;
  const { count, error } = await db.from("orders").select("id", { count: "exact", head: true }).eq("companyId", companyId).eq("customerId", customer.id).neq("paymentStatus", "approved").gte("createdAt", new Date(Date.now() - 60 * 6e4).toISOString());
  if (error)
    throw new Error(`[DB] Falha ao validar pedidos recentes: ${error.message}`);
  return count ?? 0;
}
async function listCustomerOrders(companyId, phone, accessToken) {
  const accessTokenHash = createHash2("sha256").update(accessToken).digest("hex");
  if (isTestMode()) return testListCustomerOrders(phone, accessToken);
  const db = getDb();
  const { data: customerRows, error: customerError } = await db.from("customers").select("*").eq("companyId", companyId).eq("phone", phone).limit(1);
  if (customerError)
    throw new Error(
      `[DB] Falha ao consultar cliente: ${customerError.message}`
    );
  const customer = (customerRows ?? [])[0];
  if (!customer) return [];
  const { data, error } = await db.from("orders").select("*").eq("companyId", companyId).eq("customerId", customer.id).eq("customerAccessTokenHash", accessTokenHash).order("createdAt", { ascending: false }).limit(20);
  if (error) throw new Error(`[DB] Falha ao listar pedidos: ${error.message}`);
  return joinOrdersWithCustomers(data ?? [], [customer]);
}
async function getOrderById(companyId, id) {
  if (isTestMode()) return testGetOrderById(id);
  const db = getDb();
  const { data: orderRows, error } = await db.from("orders").select("*").eq("companyId", companyId).eq("id", id).limit(1);
  if (error)
    throw new Error(`[DB] Falha ao consultar pedido: ${error.message}`);
  const order = (orderRows ?? [])[0];
  if (!order) return void 0;
  const [customers2, itemsResult] = await Promise.all([
    loadCustomersFor(db, companyId, [order]),
    db.from("order_items").select("*").eq("orderId", id)
  ]);
  const items = itemsResult.data ?? [];
  return { order, customer: customers2[0] ?? null, items };
}
async function getCustomerOrderById(companyId, id, accessToken) {
  if (isTestMode()) return testGetOrderById(id, accessToken);
  const db = getDb();
  const hash = createHash2("sha256").update(accessToken).digest("hex");
  const { data, error } = await db.from("orders").select("id").eq("companyId", companyId).eq("id", id).eq("customerAccessTokenHash", hash).maybeSingle();
  if (error)
    throw new Error(`[DB] Falha ao validar acesso ao pedido: ${error.message}`);
  return data ? getOrderById(companyId, id) : void 0;
}
async function issueDriverTrackingToken(companyId, orderId, token) {
  const hash = createHash2("sha256").update(token).digest("hex");
  if (isTestMode()) return testIssueDriverTrackingToken(orderId, hash);
  const db = getDb();
  const { data, error } = await db.from("orders").update({
    driverTrackingTokenHash: hash,
    trackingLatitude: null,
    trackingLongitude: null,
    trackingUpdatedAt: null,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("companyId", companyId).eq("id", orderId).in("status", ["ready", "out_for_delivery"]).select("id").maybeSingle();
  if (error)
    throw new Error(`[DB] Falha ao emitir link do motoboy: ${error.message}`);
  return Boolean(data);
}
async function findOrderByDriverToken(token) {
  if (isTestMode()) return null;
  const hash = createHash2("sha256").update(token).digest("hex");
  const { data } = await getDb().from("orders").select("id,status").eq("driverTrackingTokenHash", hash).maybeSingle();
  return data ? { id: Number(data.id), status: String(data.status) } : null;
}
async function updateDriverLocation(token, latitude, longitude) {
  const hash = createHash2("sha256").update(token).digest("hex");
  if (isTestMode()) return testUpdateDriverLocation(hash, latitude, longitude);
  const db = getDb();
  const { data: order, error: lookupError } = await db.from("orders").select("id,status").eq("driverTrackingTokenHash", hash).maybeSingle();
  if (lookupError)
    throw new Error(`[DB] Falha ao localizar entrega: ${lookupError.message}`);
  if (!order || !["ready", "out_for_delivery"].includes(order.status))
    return false;
  const { error } = await db.from("orders").update({
    status: "out_for_delivery",
    trackingLatitude: latitude,
    trackingLongitude: longitude,
    trackingUpdatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", order.id);
  if (error)
    throw new Error(`[DB] Falha ao atualizar localiza\xE7\xE3o: ${error.message}`);
  return true;
}
async function buildTracking(db, order) {
  const [companyResult, customerResult, provider] = await Promise.all([
    db.from("companies").select("name,slug").eq("id", order.companyId).maybeSingle(),
    db.from("customers").select("phone").eq("companyId", order.companyId).eq("id", order.customerId).maybeSingle(),
    getActiveDeliveryProvider(order.companyId)
  ]);
  if (companyResult.error || customerResult.error)
    throw new Error("[DB] Falha ao carregar dados de rastreamento.");
  const phone = String(customerResult.data?.phone ?? "").replace(/\D/g, "");
  const deliveryCode = provider === "own_courier" && !isPickupOrder(order) && ["ready", "out_for_delivery", "delivered"].includes(String(order.status)) && phone.length >= 4 ? phone.slice(-4) : null;
  return {
    orderId: order.id,
    companyName: String(companyResult.data?.name ?? "Sua loja"),
    companySlug: String(companyResult.data?.slug ?? ""),
    status: String(order.status),
    paymentStatus: String(order.paymentStatus),
    paymentMethod: order.paymentMethod ?? null,
    pickup: isPickupOrder(order),
    trackingUrl: order.trackingUrl ?? null,
    updatedAt: order.updatedAt ?? null,
    createdAt: order.createdAt ?? null,
    location: order.trackingLatitude != null && order.trackingLongitude != null ? {
      latitude: Number(order.trackingLatitude),
      longitude: Number(order.trackingLongitude),
      updatedAt: order.trackingUpdatedAt
    } : null,
    deliveryCode
  };
}
async function getCustomerTracking(token) {
  const hash = createHash2("sha256").update(token).digest("hex");
  if (isTestMode()) return testGetCustomerTracking(hash);
  const db = getDb();
  const { data: order, error } = await db.from("orders").select(TRACKING_COLUMNS).eq("customerTrackingTokenHash", hash).maybeSingle();
  if (error)
    throw new Error(`[DB] Falha ao consultar rastreamento: ${error.message}`);
  if (!order) return void 0;
  return buildTracking(db, order);
}
async function listOrdersForEmail(companyId, email) {
  if (isTestMode()) return [];
  const db = getDb();
  const { data, error } = await db.from("orders").select(TRACKING_COLUMNS).eq("companyId", companyId).ilike("customerEmail", email.trim().toLowerCase()).order("createdAt", { ascending: false }).limit(15);
  if (error) {
    if (/customerEmail/.test(error.message)) return [];
    throw new Error(`[DB] Falha ao listar pedidos do cliente: ${error.message}`);
  }
  return Promise.all((data ?? []).map((order) => buildTracking(db, order)));
}
async function getTrackingForEmail(companyId, orderId, email) {
  if (isTestMode()) return void 0;
  const db = getDb();
  const { data: order, error } = await db.from("orders").select(TRACKING_COLUMNS).eq("companyId", companyId).eq("id", orderId).ilike("customerEmail", email.trim().toLowerCase()).maybeSingle();
  if (error) {
    if (/customerEmail/.test(error.message)) return void 0;
    throw new Error(`[DB] Falha ao consultar pedido: ${error.message}`);
  }
  return order ? buildTracking(db, order) : void 0;
}
async function getNotificationContext(orderId) {
  if (isTestMode()) return null;
  const db = getDb();
  const { data: order, error } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (error || !order) return null;
  const [company, customer, bot] = await Promise.all([
    db.from("companies").select("name,slug").eq("id", order.companyId).maybeSingle(),
    db.from("customers").select("name,phone").eq("id", order.customerId).maybeSingle(),
    db.from("whatsapp_bots").select("desired").eq("companyId", order.companyId).maybeSingle()
  ]);
  let trackingToken = null;
  try {
    if (order.customerTrackingTokenEnc)
      trackingToken = decryptJson(String(order.customerTrackingTokenEnc));
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
    email: order.customerEmail ?? null,
    trackingToken,
    total: String(order.total),
    botConnected: bot.data?.desired === "connected",
    pickup: isPickupOrder(order),
    cash: order.paymentMethod === "cash_on_delivery"
  };
}
async function claimNotification(input) {
  if (isTestMode()) return null;
  const db = getDb();
  const { data, error } = await db.from("order_notifications").upsert(input, {
    onConflict: "orderId,event,channel",
    ignoreDuplicates: true
  }).select("id");
  if (error) {
    console.error("[notifications] falha ao registrar aviso:", error.message);
    return null;
  }
  return (data ?? [])[0]?.id ?? null;
}
async function finishNotification(id, status, error) {
  if (isTestMode()) return;
  await getDb().from("order_notifications").update({
    status,
    error: error ?? null,
    sentAt: status === "sent" ? (/* @__PURE__ */ new Date()).toISOString() : null
  }).eq("id", id);
}
async function getDriverTrackingInfo(token) {
  const hash = createHash2("sha256").update(token).digest("hex");
  if (isTestMode()) return testGetDriverTrackingInfo(hash);
  const db = getDb();
  const { data: order, error } = await db.from("orders").select(
    "id,companyId,customerId,status,deliveryAddress,trackingLatitude,trackingLongitude,trackingUpdatedAt"
  ).eq("driverTrackingTokenHash", hash).maybeSingle();
  if (error)
    throw new Error(
      `[DB] Falha ao consultar rota do motoboy: ${error.message}`
    );
  if (!order) return void 0;
  const [company, customer] = await Promise.all([
    db.from("companies").select("name").eq("id", order.companyId).maybeSingle(),
    db.from("customers").select("name,phone").eq("companyId", order.companyId).eq("id", order.customerId).maybeSingle()
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
    location: order.trackingLatitude != null && order.trackingLongitude != null ? {
      latitude: Number(order.trackingLatitude),
      longitude: Number(order.trackingLongitude),
      updatedAt: order.trackingUpdatedAt
    } : null
  };
}
async function confirmDriverDelivery(token, code) {
  const hash = createHash2("sha256").update(token).digest("hex");
  if (isTestMode()) return testConfirmDriverDelivery(hash, code);
  const db = getDb();
  const { data: order, error } = await db.from("orders").select("id,companyId,customerId,status").eq("driverTrackingTokenHash", hash).maybeSingle();
  if (error) throw new Error(`[DB] Falha ao validar entrega: ${error.message}`);
  if (!order || order.status !== "out_for_delivery") return false;
  const { data: customer, error: customerError } = await db.from("customers").select("phone").eq("companyId", order.companyId).eq("id", order.customerId).maybeSingle();
  if (customerError)
    throw new Error(`[DB] Falha ao validar cliente: ${customerError.message}`);
  const phone = String(customer?.phone ?? "").replace(/\D/g, "");
  if (phone.length < 4 || phone.slice(-4) !== code) return false;
  const { error: updateError } = await db.from("orders").update({
    status: "delivered",
    driverTrackingTokenHash: null,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", order.id).eq("companyId", order.companyId);
  if (updateError)
    throw new Error(`[DB] Falha ao confirmar entrega: ${updateError.message}`);
  return true;
}
async function getDashboardSummary(companyId) {
  if (isTestMode()) return testDashboardSummary();
  const db = getDb();
  const { data } = await db.from("orders").select("total").eq("companyId", companyId).eq("paymentStatus", "approved");
  const rows = data ?? [];
  const revenue = rows.reduce((sum, r) => sum + Number(r.total), 0);
  const orderCount = rows.length;
  return {
    revenue,
    orders: orderCount,
    averageTicket: orderCount ? revenue / orderCount : 0
  };
}
async function listAdminMenu(companyId) {
  if (isTestMode()) return testListAdminMenu();
  const db = getDb();
  const { data } = await db.from("menu_items").select("*").eq("companyId", companyId).order("name");
  return data ?? [];
}
async function listMenuCategories(companyId) {
  if (isTestMode()) return testListMenuCategories();
  const db = getDb();
  const select = () => db.from("menu_categories").select("*").eq("companyId", companyId).order("sortOrder").order("name");
  const { data, error } = await select();
  if (error)
    throw new Error(`[DB] Falha ao listar categorias: ${error.message}`);
  if ((data ?? []).length > 0) return data;
  const { error: seedError } = await db.from("menu_categories").insert(
    DEFAULT_MENU_CATEGORIES.map((name, index) => ({
      companyId,
      name,
      sortOrder: index + 1,
      active: true
    }))
  );
  if (seedError)
    throw new Error(
      `[DB] Falha ao criar categorias padr\xE3o: ${seedError.message}`
    );
  const seeded = await select();
  if (seeded.error)
    throw new Error(`[DB] Falha ao listar categorias: ${seeded.error.message}`);
  return seeded.data ?? [];
}
async function createMenuCategory(companyId, input) {
  const existing = await listMenuCategories(companyId);
  const duplicate = existing.find(
    (category) => category.name.trim().toLowerCase() === input.name.trim().toLowerCase()
  );
  if (duplicate) return duplicate;
  if (isTestMode()) return testCreateMenuCategory(input);
  const db = getDb();
  const { data, error } = await db.from("menu_categories").insert({
    companyId,
    name: input.name,
    sortOrder: existing.length + 1,
    active: true
  }).select("*").single();
  if (error) throw new Error(`[DB] Falha ao criar categoria: ${error.message}`);
  return data;
}
async function createMenuItem(companyId, input) {
  if (isTestMode()) return testCreateMenuItem(input);
  const db = getDb();
  const categories2 = await listMenuCategories(companyId);
  if (!categories2.some((category) => category.id === input.categoryId))
    return void 0;
  const { data, error } = await db.from("menu_items").insert({
    companyId,
    categoryId: input.categoryId,
    name: input.name,
    description: input.description ?? null,
    price: input.price.toFixed(2),
    imageUrl: input.imageUrl ?? null,
    active: input.active ?? true,
    featured: input.featured ?? false
  }).select("*").single();
  if (error) throw new Error(`[DB] Falha ao criar item: ${error.message}`);
  return data;
}
async function updateMenuItem(companyId, id, input) {
  if (isTestMode())
    return testUpdateMenuItem(id, input);
  const db = getDb();
  if (input.categoryId !== void 0) {
    const categories2 = await listMenuCategories(companyId);
    if (!categories2.some((category) => category.id === input.categoryId))
      return void 0;
  }
  const { price, ...rest } = input;
  const patch = {
    ...rest,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (price !== void 0) patch.price = price.toFixed(2);
  const { data, error } = await db.from("menu_items").update(patch).eq("id", id).eq("companyId", companyId).select("*");
  if (error) throw new Error(`[DB] Falha ao atualizar item: ${error.message}`);
  return (data ?? [])[0];
}
async function deleteMenuItem(companyId, id) {
  if (isTestMode()) return testDeleteMenuItem(id);
  const db = getDb();
  const { data, error } = await db.from("menu_items").delete().eq("id", id).eq("companyId", companyId).select("id");
  if (error) throw new Error(`[DB] Falha ao excluir item: ${error.message}`);
  return (data ?? []).length > 0;
}
async function listInventory(companyId) {
  if (isTestMode()) return testListInventory();
  const db = getDb();
  const { data } = await db.from("inventory_items").select("*").eq("companyId", companyId).eq("active", true).order("name");
  return data ?? [];
}
async function listRecentExpenses(companyId, limit = 50) {
  if (isTestMode()) return testListExpenses();
  const db = getDb();
  const { data } = await db.from("expenses").select("*").eq("companyId", companyId).order("incurredAt", { ascending: false }).limit(limit);
  return data ?? [];
}
async function createInventoryItem(companyId, input) {
  if (isTestMode()) return testCreateInventoryItem(input);
  const db = getDb();
  const { data, error } = await db.from("inventory_items").insert({
    companyId,
    name: input.name,
    unit: input.unit,
    currentQuantity: "0.000",
    minimumQuantity: input.minimumQuantity.toFixed(3),
    costPerUnit: input.costPerUnit.toFixed(2),
    ...input.lastSupplier ? { lastSupplier: input.lastSupplier } : {},
    active: true,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).select("*").single();
  if (error)
    throw new Error(
      `[DB] Falha ao cadastrar item de estoque: ${error.message}`
    );
  return data;
}
async function updateInventoryItem(companyId, input) {
  if (isTestMode()) return testUpdateInventoryItem(input);
  const db = getDb();
  const { data, error } = await db.from("inventory_items").update({
    ...input.costPerUnit === void 0 ? {} : { costPerUnit: input.costPerUnit.toFixed(2) },
    ...input.minimumQuantity === void 0 ? {} : { minimumQuantity: input.minimumQuantity.toFixed(3) },
    ...input.lastSupplier === void 0 ? {} : { lastSupplier: input.lastSupplier },
    ...input.active === void 0 ? {} : { active: input.active },
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", input.itemId).eq("companyId", companyId).select("id");
  if (error)
    throw new Error(`[DB] Falha ao atualizar item de estoque: ${error.message}`);
  return (data ?? []).length > 0;
}
async function recordInventoryMovement(companyId, input) {
  if (isTestMode()) return testRecordInventoryMovement(input);
  const db = getDb();
  const { data, error } = await db.rpc("record_inventory_movement", {
    p_company_id: companyId,
    p_item_id: input.itemId,
    p_type: input.type,
    p_quantity: input.quantity,
    p_reason: input.reason
  });
  if (error) {
    if (/not found/i.test(error.message)) return void 0;
    throw new Error(
      `[DB] Falha ao registrar movimenta\xE7\xE3o de estoque: ${error.message}`
    );
  }
  return data;
}
async function listRecipeIngredients(companyId) {
  if (isTestMode()) return testListRecipeIngredients();
  const db = getDb();
  const { data, error } = await db.from("recipe_ingredients").select("menuItemId,inventoryItemId,quantity,unit,lossPercent").eq("companyId", companyId);
  if (error)
    throw new Error(`[DB] Falha ao listar fichas t\xE9cnicas: ${error.message}`);
  return data ?? [];
}
async function saveRecipe(companyId, input) {
  if (isTestMode()) return testSaveRecipe(input);
  const db = getDb();
  const { data: dish } = await db.from("menu_items").select("id").eq("id", input.menuItemId).eq("companyId", companyId).maybeSingle();
  if (!dish) return false;
  if (input.lines.length) {
    const { error } = await db.from("recipe_ingredients").upsert(
      input.lines.map((line) => ({
        companyId,
        menuItemId: input.menuItemId,
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity.toFixed(3),
        unit: line.unit,
        lossPercent: line.lossPercent?.toFixed(2) ?? null,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      })),
      { onConflict: "menuItemId,inventoryItemId" }
    );
    if (error)
      throw new Error(`[DB] Falha ao salvar ficha t\xE9cnica: ${error.message}`);
  }
  let removal = db.from("recipe_ingredients").delete().eq("companyId", companyId).eq("menuItemId", input.menuItemId);
  if (input.lines.length)
    removal = removal.not(
      "inventoryItemId",
      "in",
      `(${input.lines.map((line) => line.inventoryItemId).join(",")})`
    );
  const { error: removalError } = await removal;
  if (removalError)
    throw new Error(
      `[DB] Falha ao atualizar ficha t\xE9cnica: ${removalError.message}`
    );
  return true;
}
async function listInventoryMovements(companyId, limit = 100) {
  if (isTestMode()) return testListInventoryMovements(limit);
  const db = getDb();
  const items = await listInventory(companyId);
  const byId = new Map(items.map((item) => [Number(item.id), item]));
  if (!byId.size) return [];
  const { data, error } = await db.from("inventory_movements").select("*").in("inventoryItemId", Array.from(byId.keys())).order("occurredAt", { ascending: false }).limit(limit);
  if (error)
    throw new Error(
      `[DB] Falha ao listar movimenta\xE7\xF5es de estoque: ${error.message}`
    );
  return (data ?? []).map(
    (movement) => {
      const item = byId.get(Number(movement.inventoryItemId));
      return {
        id: Number(movement.id),
        itemName: String(item?.name ?? "Item removido"),
        unit: String(item?.unit ?? "un"),
        type: movement.type,
        quantity: String(movement.quantity),
        reason: String(movement.reason),
        occurredAt: String(movement.occurredAt)
      };
    }
  );
}
async function createExpense(companyId, input) {
  if (isTestMode()) return testCreateExpense(input);
  const db = getDb();
  const { data, error } = await db.from("expenses").insert({
    companyId,
    description: input.description,
    category: input.category,
    amount: input.amount.toFixed(2),
    incurredAt: `${input.date}T12:00:00`,
    notes: input.notes ?? null
  }).select("*").single();
  if (error) throw new Error(`[DB] Falha ao lan\xE7ar despesa: ${error.message}`);
  return data;
}
function brazilDateBounds(from, to) {
  const dayAfter = /* @__PURE__ */ new Date(`${to}T12:00:00Z`);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  return {
    start: `${from}T03:00:00`,
    end: `${dayAfter.toISOString().slice(0, 10)}T03:00:00`
  };
}
async function getFinanceReport(companyId, from, to) {
  if (isTestMode()) return testFinanceReport(from, to);
  const db = getDb();
  const { start, end } = brazilDateBounds(from, to);
  const readPages = async (build) => {
    const rows = [];
    for (let offset = 0; ; offset += 1e3) {
      const { data, error } = await build().range(offset, offset + 999);
      if (error)
        throw new Error(
          `[DB] Falha ao carregar relat\xF3rio financeiro: ${error.message}`
        );
      const page = data ?? [];
      rows.push(...page);
      if (page.length < 1e3) return rows;
    }
  };
  let usedCreatedAtFallback = false;
  let orders2;
  try {
    orders2 = await readPages(
      () => db.from("orders").select(
        "id,createdAt,paymentApprovedAt,paymentStatus,paymentMethod,total,platformFeeAmount"
      ).eq("companyId", companyId).neq("status", "cancelled").or(
        `and(paymentStatus.eq.approved,paymentApprovedAt.gte.${start},paymentApprovedAt.lt.${end}),and(paymentStatus.eq.approved,paymentApprovedAt.is.null,createdAt.gte.${start},createdAt.lt.${end}),and(paymentStatus.eq.pending,createdAt.gte.${start},createdAt.lt.${end})`
      ).order("id", { ascending: true })
    );
  } catch (error) {
    if (!(error instanceof Error) || !/column orders\.paymentApprovedAt does not exist/i.test(error.message))
      throw error;
    usedCreatedAtFallback = true;
    const legacyOrders = await readPages(
      () => db.from("orders").select(
        "id,createdAt,paymentStatus,paymentMethod,total,platformFeeAmount"
      ).eq("companyId", companyId).neq("status", "cancelled").in("paymentStatus", ["approved", "pending"]).gte("createdAt", start).lt("createdAt", end).order("id", { ascending: true })
    );
    orders2 = legacyOrders.map((order) => ({ ...order, paymentApprovedAt: null }));
  }
  const expenses2 = await readPages(
    () => db.from("expenses").select("id,description,category,amount,incurredAt,notes").eq("companyId", companyId).gte("incurredAt", start).lt("incurredAt", end).order("id", { ascending: true })
  );
  const paidIds = orders2.filter((order) => order.paymentStatus === "approved").map((order) => order.id);
  const orderItems = [];
  for (let index = 0; index < paidIds.length; index += 20) {
    const ids = paidIds.slice(index, index + 20);
    const { data, error } = await db.from("order_items").select("orderId,itemName,quantity,unitPrice").in("orderId", ids).order("id", { ascending: true });
    if (error)
      throw new Error(
        `[DB] Falha ao carregar produtos vendidos: ${error.message}`
      );
    orderItems.push(...data ?? []);
  }
  return {
    ...buildFinanceReport(from, to, orders2, expenses2, orderItems),
    financeDateBasis: usedCreatedAtFallback ? "createdAt" : "paymentApprovedAt"
  };
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
  const now2 = (/* @__PURE__ */ new Date()).toISOString();
  const patch = {
    ...input,
    ...input.paymentStatus === "approved" ? { paymentApprovedAt: now2 } : {},
    updatedAt: now2
  };
  const { error } = await db.from("orders").update(patch).eq("id", orderId);
  if (error)
    throw new Error(
      `[DB] Falha ao atualizar pagamento do pedido: ${error.message}`
    );
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
    console.error(
      `[Integrations] Failed to decrypt credentials for company ${companyId}/${provider}:`,
      error
    );
    return void 0;
  }
}
async function saveIntegrationCredentials(companyId, provider, credentials, metadata) {
  if (isTestMode()) return;
  const db = getDb();
  const encrypted = encryptJson(credentials);
  const now2 = (/* @__PURE__ */ new Date()).toISOString();
  await db.from("integration_settings").upsert(
    {
      companyId,
      provider,
      connected: true,
      credentials: encrypted,
      metadata: metadata ? JSON.stringify(metadata) : null,
      connectedAt: now2,
      updatedAt: now2
    },
    { onConflict: "companyId,provider" }
  );
}
async function disconnectIntegration(companyId, provider) {
  if (isTestMode()) return;
  const db = getDb();
  await db.from("integration_settings").update({
    connected: false,
    credentials: null,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("companyId", companyId).eq("provider", provider);
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
async function getWhatsappBot(companyId) {
  if (isTestMode()) return testGetWhatsappBot();
  const db = getDb();
  const { data, error } = await db.from("whatsapp_bots").select("*").eq("companyId", companyId).limit(1);
  if (error)
    throw new Error(
      `[DB] Falha ao consultar o bot de WhatsApp: ${error.message}`
    );
  return (data ?? [])[0];
}
async function patchWhatsappBot(companyId, patch) {
  if (isTestMode())
    return testPatchWhatsappBot(patch);
  const db = getDb();
  const { data, error } = await db.from("whatsapp_bots").upsert(
    { companyId, ...patch, updatedAt: (/* @__PURE__ */ new Date()).toISOString() },
    { onConflict: "companyId" }
  ).select("*").single();
  if (error)
    throw new Error(`[DB] Falha ao salvar o bot de WhatsApp: ${error.message}`);
  return data;
}
var SCHEMA, _db, TRACKING_COLUMNS, DEFAULT_MENU_CATEGORIES, ORDER_STATUS_FLOW, BOT_HEARTBEAT_MAX_AGE_MS, requestWhatsappConnect, requestWhatsappDisconnect, updateWhatsappSettings;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_checkout();
    init_finance();
    init_payment_messages();
    init_store_rules();
    init_testData();
    init_testStore();
    init_crypto();
    SCHEMA = "marmitaria";
    _db = null;
    TRACKING_COLUMNS = "id,companyId,customerId,status,paymentStatus,paymentMethod,deliveryAddress,trackingLatitude,trackingLongitude,trackingUpdatedAt,trackingUrl,updatedAt,createdAt";
    DEFAULT_MENU_CATEGORIES = [
      "Mais vendidos",
      "Principais",
      "Bebidas",
      "Sobremesas"
    ];
    ORDER_STATUS_FLOW = [
      "received",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered"
    ];
    BOT_HEARTBEAT_MAX_AGE_MS = 12e4;
    requestWhatsappConnect = (companyId) => patchWhatsappBot(companyId, {
      desired: "connected",
      status: "starting",
      qr: null,
      error: null
    });
    requestWhatsappDisconnect = (companyId) => patchWhatsappBot(companyId, { desired: "disconnected" });
    updateWhatsappSettings = (companyId, input) => patchWhatsappBot(companyId, input);
  }
});

// server/notifications.ts
var notifications_exports = {};
__export(notifications_exports, {
  eventForStatus: () => eventForStatus,
  isForwardMove: () => isForwardMove,
  normalizeBrPhone: () => normalizeBrPhone,
  notifyOrderEvent: () => notifyOrderEvent
});
function isForwardMove(from, to) {
  return (RANK[to] ?? -1) > (RANK[from ?? "received"] ?? 0);
}
function eventForStatus(status) {
  return status === "preparing" || status === "ready" || status === "out_for_delivery" || status === "delivered" ? status : null;
}
function normalizeBrPhone(raw) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55\d{10,11}$/.test(digits)) return null;
  return digits;
}
function messageFor(event, ctx, link, ordersLink = null) {
  const first = ctx.customerName.trim().split(/\s+/)[0];
  const hi = first ? `Ol\xE1, ${first}!` : "Ol\xE1!";
  const head = `${ctx.companyName} \xB7 Pedido #${ctx.orderId}`;
  const tail = (link ? `

Acompanhe aqui: ${link}` : "") + (ordersLink ? `
Ver todos os seus pedidos (entre s\xF3 com seu e-mail): ${ordersLink}` : "");
  switch (event) {
    case "paid":
      return {
        subject: `Pedido #${ctx.orderId} confirmado \u2014 ${ctx.companyName}`,
        text: `${hi} \u2705 ${ctx.cash ? `Recebemos seu pedido! O pagamento \xE9 feito na ${ctx.pickup ? "retirada" : "entrega"}.` : "Pagamento confirmado! Recebemos seu pedido."}
${head}${tail}`
      };
    case "preparing":
      return {
        subject: `Seu pedido #${ctx.orderId} est\xE1 em preparo`,
        text: `${hi} \u{1F469}\u200D\u{1F373} Seu pedido j\xE1 est\xE1 em preparo.
${head}${tail}`
      };
    case "ready":
      return {
        subject: `Seu pedido #${ctx.orderId} est\xE1 pronto`,
        text: `${hi} \u{1F4E6} ${ctx.pickup ? "Seu pedido est\xE1 pronto para retirada." : "Seu pedido est\xE1 pronto e aguardando o entregador."}
${head}${tail}`
      };
    case "out_for_delivery":
      return {
        subject: `Seu pedido #${ctx.orderId} saiu para entrega`,
        text: `${hi} \u{1F6F5} Seu pedido saiu para entrega! Acompanhe o motoboy no mapa.
${head}${tail}`
      };
    case "delivered":
      return {
        subject: `Pedido #${ctx.orderId} entregue`,
        text: `${hi} \u{1F389} Pedido entregue. Bom apetite!
${head}`
      };
  }
}
async function sendEmail(to, subject, text) {
  if (!ENV.resendApiKey || !ENV.emailFrom) return { ok: false, error: "e-mail n\xE3o configurado" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${ENV.resendApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: ENV.emailFrom,
      to: [to],
      subject,
      text
    })
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    return { ok: false, error: `Resend ${response.status}: ${detail}` };
  }
  return { ok: true };
}
async function notifyOrderEvent(orderId, event) {
  try {
    const ctx = await getNotificationContext(orderId);
    if (!ctx) return;
    const base = ENV.publicAppUrl;
    const link = base && ctx.trackingToken ? `${base}/rastrear/${encodeURIComponent(ctx.companySlug)}/${ctx.trackingToken}` : base ? `${base}/${encodeURIComponent(ctx.companySlug)}/pedidos` : null;
    const ordersLink = base ? `${base}/${encodeURIComponent(ctx.companySlug)}/pedidos` : null;
    const { subject, text } = messageFor(event, ctx, link, ordersLink);
    const phone = normalizeBrPhone(ctx.phone);
    if (phone && ctx.botConnected) {
      await claimNotification({
        companyId: ctx.companyId,
        orderId,
        event,
        channel: "whatsapp",
        recipient: phone,
        message: text
      });
    }
    if (ctx.email && ENV.resendApiKey && ENV.emailFrom) {
      const id = await claimNotification({
        companyId: ctx.companyId,
        orderId,
        event,
        channel: "email",
        recipient: ctx.email,
        message: text
      });
      if (id) {
        const result = await sendEmail(ctx.email, subject, text);
        await finishNotification(id, result.ok ? "sent" : "failed", result.ok ? void 0 : result.error);
        if (!result.ok) console.error("[notifications] e-mail falhou:", result.error);
      }
    }
  } catch (error) {
    console.error("[notifications] erro:", error instanceof Error ? error.message : error);
  }
}
var RANK;
var init_notifications = __esm({
  "server/notifications.ts"() {
    "use strict";
    init_env();
    init_db();
    RANK = {
      received: 0,
      preparing: 1,
      ready: 2,
      out_for_delivery: 3,
      delivered: 4
    };
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
  updateCompanyBranding: () => updateCompanyBranding,
  updateCompanyOrdering: () => updateCompanyOrdering
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
async function updateCompanyOrdering(companyId, input) {
  const db = getDb();
  const { error } = await db.from("companies").update(input).eq("id", companyId);
  if (error) throw new Error(`[DB] Falha ao salvar as regras de pedido: ${error.message}`);
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
init_notifications();
import { TRPCError as TRPCError2 } from "@trpc/server";

// server/_core/rateLimit.ts
var MAX_TRACKED_KEYS = 5e3;
function createRateLimiter(limit, windowMs) {
  const hits = /* @__PURE__ */ new Map();
  return (key, now2 = Date.now()) => {
    if (hits.size > MAX_TRACKED_KEYS) hits.clear();
    const recent = (hits.get(key) ?? []).filter((time) => now2 - time < windowMs);
    const allowed = recent.length < limit;
    if (allowed) recent.push(now2);
    hits.set(key, recent);
    return allowed;
  };
}
function clientIp(req) {
  const raw = req.headers["x-forwarded-for"];
  const forwarded = Array.isArray(raw) ? raw[0] : raw;
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

// server/routers.ts
init_payment_messages();
init_store_rules();

// shared/production-plan.ts
var UNIT_FAMILIES = {
  mass: { g: 1, kg: 1e3 },
  volume: { ml: 1, L: 1e3 }
};
var familyOf = (unit) => Object.values(UNIT_FAMILIES).find((family) => unit in family);
function compatibleUnits(stockUnit) {
  const family = familyOf(stockUnit);
  return family ? Object.keys(family) : [stockUnit];
}
var MAX_LOSS_PERCENT = 90;

// shared/delivery.ts
function calculateOwnCourierFee(distanceKm, pricePerKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || !Number.isFinite(pricePerKm) || pricePerKm < 0) {
    throw new Error("Dist\xE2ncia e tarifa por km precisam ser valores v\xE1lidos.");
  }
  return Math.round(distanceKm * pricePerKm * 100) / 100;
}
var DEFAULT_DELIVERY_PRICING = {
  baseFee: 7.5,
  includedKm: 3,
  pricePerKm: 1.5,
  maxKm: 15
};
function estimateDeliveryFee(distanceKm, pricing) {
  const extraKm = Math.max(0, distanceKm - pricing.includedKm);
  return Math.round((pricing.baseFee + extraKm * pricing.pricePerKm) * 100) / 100;
}
function minorUnitsToBRL(value, currency) {
  if (currency.toUpperCase() !== "BRL" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Cota\xE7\xE3o inv\xE1lida: esperado um valor em centavos de BRL.");
  }
  return value / 100;
}
function unavailableDeliveryResponse(provider, reason) {
  return {
    provider,
    available: false,
    trackingUrl: null,
    reason: reason ?? "Conecte um provedor de entrega em Integra\xE7\xF5es para ativar o despacho autom\xE1tico."
  };
}

// server/routers.ts
import { createHash as createHash3, randomUUID } from "node:crypto";
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
init_testData();
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
var verifiedEmailCache = /* @__PURE__ */ new Map();
async function isSupabaseEmailConfirmed(req, expectedEmail) {
  if (isTestMode()) return true;
  const token = getBearerToken(req);
  if (!token) return false;
  const claims = await verifySupabaseJwt(token);
  const email = expectedEmail.trim().toLowerCase();
  if (!claims || claims.email?.toLowerCase() !== email) return false;
  const cacheKey = `${claims.sub}:${email}`;
  if ((verifiedEmailCache.get(cacheKey) ?? 0) > Date.now()) return true;
  const baseUrl = (ENV.supabaseUrl || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!baseUrl || !serviceKey) throw new Error("Supabase Auth service credentials are not configured.");
  const response = await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(claims.sub)}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  });
  if (!response.ok) throw new Error(`Supabase Auth confirmation check failed (${response.status}).`);
  const authUser = await response.json();
  const verified = Boolean(authUser.email_confirmed_at && authUser.email?.toLowerCase() === email);
  if (verified) verifiedEmailCache.set(cacheKey, Date.now() + 12e4);
  return verified;
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
    await upsertUser({ supabaseUserId: claims.sub, email: claims.email ?? null, lastSignedIn: (/* @__PURE__ */ new Date()).toISOString() });
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
init_db();

// server/integrations/mercadoPago.ts
init_env();
init_db();
var MP_AUTHORIZE_URL = "https://auth.mercadopago.com/authorization";
var MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
var MP_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";
var MP_PREFERENCES_URL = "https://api.mercadopago.com/checkout/preferences";
function isBoletoPaymentMethod(paymentMethodId) {
  return /(?:boleto|ticket|bolbradesco|^pec$)/i.test(
    paymentMethodId?.trim() ?? ""
  );
}
function isMercadoPagoConfigured() {
  return Boolean(ENV.mpClientId && ENV.mpClientSecret && ENV.mpRedirectUri);
}
function buildAuthorizeUrl(companyId) {
  const url = new URL(MP_AUTHORIZE_URL);
  url.searchParams.set("client_id", ENV.mpClientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", ENV.mpRedirectUri);
  url.searchParams.set(
    "state",
    Buffer.from(
      JSON.stringify({ companyId, nonce: Math.random().toString(36).slice(2) })
    ).toString("base64")
  );
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
    throw new Error(
      `Mercado Pago token refresh failed (${response.status}): ${detail}`
    );
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
  return getIntegrationCredentials(
    companyId,
    "mercadopago"
  );
}
async function saveCredentials(companyId, credentials) {
  await saveIntegrationCredentials(companyId, "mercadopago", credentials, {
    publicKey: credentials.publicKey,
    userId: credentials.userId,
    liveMode: credentials.liveMode
  });
}
function buildPayerDetails(input) {
  const [firstName, ...rest] = (input.payer.name ?? "").trim().split(/\s+/);
  const names = {
    ...firstName ? { first_name: firstName } : {},
    ...rest.length ? { last_name: rest.join(" ") } : {}
  };
  const digits = (input.payer.phone ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return {
    payer: { email: input.payer.email, ...names },
    additional_info: {
      payer: {
        ...names,
        ...digits.length >= 10 ? { phone: { area_code: digits.slice(0, 2), number: digits.slice(2) } } : {}
      },
      items: (input.items ?? []).map((item) => ({
        id: String(item.id),
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unitPrice
      }))
    }
  };
}
function payerFieldsFor(input) {
  return input.paymentMethodId === "pix" ? { payer: { email: input.payer.email } } : buildPayerDetails(input);
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
    ...applicationFee > 0 ? { application_fee: applicationFee } : {},
    description: input.description,
    payment_method_id: input.paymentMethodId,
    token: input.token,
    installments: input.installments ?? 1,
    issuer_id: input.issuerId,
    ...payerFieldsFor(input),
    external_reference: String(input.orderId),
    notification_url: ENV.mpRedirectUri ? `${new URL("/api/webhooks/mercadopago", ENV.mpRedirectUri).toString()}?companyId=${input.companyId}` : void 0
  };
  const idempotencySuffix = Math.random().toString(36).slice(2, 10);
  const attempt = async (accessToken) => fetch(MP_PAYMENTS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": `order-${input.orderId}-${idempotencySuffix}`
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
    console.error("[mercadopago] payment failed", response.status, detail, {
      orderId: input.orderId,
      amount: input.transactionAmount,
      applicationFee,
      method: input.paymentMethodId
    });
    let reason = detail.slice(0, 300);
    try {
      const parsed = JSON.parse(detail);
      const cause = parsed.cause?.[0];
      reason = [cause?.code, cause?.description || parsed.message || parsed.error].filter(Boolean).join(" \xB7 ") || reason;
    } catch {
    }
    throw new Error(`Mercado Pago recusou o pagamento (${response.status}): ${reason}`);
  }
  const payment = await response.json();
  return { ...payment, applicationFee };
}
async function sellerPaymentRequest(companyId, paymentId, init) {
  const credentials = await getConnectedCredentials(companyId);
  if (!credentials) throw new Error("Mercado Pago is not connected");
  const url = `${MP_PAYMENTS_URL}/${encodeURIComponent(paymentId)}`;
  const attempt = (accessToken) => fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    }
  });
  const response = await attempt(credentials.accessToken);
  if (response.status !== 401) return response;
  const refreshed = await refreshCredentials(credentials.refreshToken);
  await saveCredentials(companyId, refreshed);
  return attempt(refreshed.accessToken);
}
async function getPayment(companyId, paymentId) {
  const response = await sellerPaymentRequest(companyId, paymentId);
  if (!response.ok)
    throw new Error(`Falha ao consultar pagamento (${response.status})`);
  return await response.json();
}
async function cancelPayment(companyId, paymentId) {
  const response = await sellerPaymentRequest(companyId, paymentId, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" })
  });
  return response.ok;
}
function paymentLinkUrl(preference, liveMode) {
  return liveMode ? preference.init_point : preference.sandbox_init_point || preference.init_point;
}
async function createPaymentLink(input) {
  const credentials = await getConnectedCredentials(input.companyId);
  if (!credentials)
    throw new Error("Mercado Pago n\xE3o est\xE1 conectado para esta loja.");
  const applicationFee = computeApplicationFee(input.transactionAmount);
  const body = {
    items: [
      {
        id: `order-${input.orderId}`,
        title: input.description.slice(0, 250),
        quantity: 1,
        currency_id: "BRL",
        unit_price: input.transactionAmount
      }
    ],
    external_reference: String(input.orderId),
    marketplace_fee: applicationFee,
    notification_url: ENV.mpRedirectUri ? `${new URL("/api/webhooks/mercadopago", ENV.mpRedirectUri).toString()}?companyId=${input.companyId}` : void 0,
    ...input.payerEmail ? { payer: { email: input.payerEmail } } : {}
  };
  const attempt = async (accessToken) => fetch(MP_PREFERENCES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": `manual-order-link-${input.orderId}`
    },
    body: JSON.stringify(body)
  });
  let response = await attempt(credentials.accessToken);
  let current = credentials;
  if (response.status === 401) {
    current = await refreshCredentials(credentials.refreshToken);
    await saveCredentials(input.companyId, current);
    response = await attempt(current.accessToken);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Mercado Pago link creation failed (${response.status}): ${detail}`
    );
  }
  const preference = await response.json();
  if (!preference.id || !preference.init_point)
    throw new Error("Mercado Pago n\xE3o retornou um link de pagamento v\xE1lido.");
  return {
    id: preference.id,
    url: paymentLinkUrl(preference, current.liveMode),
    applicationFee
  };
}
async function getPaymentLink(companyId, preferenceId) {
  let credentials = await getConnectedCredentials(companyId);
  if (!credentials)
    throw new Error("Mercado Pago n\xE3o est\xE1 conectado para esta loja.");
  const request = (accessToken) => fetch(`${MP_PREFERENCES_URL}/${encodeURIComponent(preferenceId)}`, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  let response = await request(credentials.accessToken);
  if (response.status === 401) {
    credentials = await refreshCredentials(credentials.refreshToken);
    await saveCredentials(companyId, credentials);
    response = await request(credentials.accessToken);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Mercado Pago preference lookup failed (${response.status}): ${detail}`
    );
  }
  const preference = await response.json();
  if (!preference.id || !preference.init_point)
    throw new Error("Mercado Pago n\xE3o retornou um link de pagamento v\xE1lido.");
  return paymentLinkUrl(preference, credentials.liveMode);
}

// server/integrations/uberDirect.ts
init_db();
var UBER_TOKEN_URL = "https://auth.uber.com/oauth/v2/token";
var UBER_API_BASE = "https://api.uber.com/v1";
var tokenCache = /* @__PURE__ */ new Map();
async function getAccessToken(companyId, credentials) {
  const cached = tokenCache.get(companyId);
  if (cached && cached.expiresAt > Date.now() + 3e4)
    return cached.accessToken;
  const response = await fetch(UBER_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "client_credentials",
      scope: "eats.deliveries"
    }),
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok)
    throw new Error(`Uber Direct auth failed (${response.status})`);
  const data = await response.json();
  tokenCache.set(companyId, {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1e3
  });
  return data.access_token;
}
function serializeAddress(address) {
  return JSON.stringify({ street_address: [address], country: "BR" });
}
async function quoteDelivery(input) {
  const credentials = await getIntegrationCredentials(
    input.companyId,
    "uber_direct"
  );
  if (!credentials)
    throw new Error("Uber Direct n\xE3o est\xE1 configurado para esta empresa.");
  if (!input.pickupAddress || !input.dropoffAddress)
    throw new Error("Informe os endere\xE7os de retirada e entrega.");
  const token = await getAccessToken(input.companyId, credentials);
  const response = await fetch(
    `${UBER_API_BASE}/customers/${encodeURIComponent(credentials.customerId)}/delivery_quotes`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        pickup_address: serializeAddress(input.pickupAddress),
        dropoff_address: serializeAddress(input.dropoffAddress)
      }),
      signal: AbortSignal.timeout(12e3)
    }
  );
  if (!response.ok) {
    throw new Error(
      `Uber Direct n\xE3o conseguiu cotar essa entrega (${response.status}). Confira o endere\xE7o e a configura\xE7\xE3o em Integra\xE7\xF5es.`
    );
  }
  const data = await response.json();
  const currency = String(
    data.currency_type ?? data.currency ?? ""
  ).toUpperCase();
  if (!data.id || !Number.isSafeInteger(data.fee) || data.fee < 0)
    throw new Error("A Uber retornou uma cota\xE7\xE3o incompleta.");
  if (currency !== "BRL")
    throw new Error(
      `A cota\xE7\xE3o Uber veio em ${currency || "moeda desconhecida"}; n\xE3o \xE9 poss\xEDvel cobrar esse valor como reais.`
    );
  const expiresAt = data.expires ? Date.parse(data.expires) : Date.now() + 15 * 6e4;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
    throw new Error(
      "A cota\xE7\xE3o da Uber j\xE1 expirou. Atualize o endere\xE7o para pedir outra."
    );
  return {
    quoteId: data.id,
    fee: minorUnitsToBRL(data.fee, currency),
    currency,
    expiresAt
  };
}
async function createDelivery(input) {
  const credentials = await getIntegrationCredentials(
    input.companyId,
    "uber_direct"
  );
  if (!credentials)
    throw new Error("Uber Direct n\xE3o est\xE1 configurado para esta empresa");
  if (!input.pickupAddress || !input.quoteId)
    throw new Error("Endere\xE7o de retirada ou cota\xE7\xE3o da Uber ausente");
  const token = await getAccessToken(input.companyId, credentials);
  const response = await fetch(
    `${UBER_API_BASE}/customers/${encodeURIComponent(credentials.customerId)}/deliveries`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        quote_id: input.quoteId,
        pickup_address: serializeAddress(input.pickupAddress),
        pickup_name: input.companyName,
        dropoff_address: serializeAddress(input.dropoffAddress),
        dropoff_name: input.dropoffName,
        dropoff_phone_number: input.dropoffPhone,
        manifest_items: input.manifestItems.map((item) => ({
          name: item.name,
          quantity: item.quantity
        })),
        external_id: `order-${input.orderId}`
      }),
      signal: AbortSignal.timeout(15e3)
    }
  );
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 400);
    throw new Error(
      `Uber Direct delivery creation failed (${response.status}): ${detail}`
    );
  }
  const data = await response.json();
  return {
    deliveryId: data.id,
    trackingUrl: data.tracking_url,
    status: data.status
  };
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

// server/integrations/deliveryPricing.ts
var geocodeCache = /* @__PURE__ */ new Map();
var geocodeQueue = Promise.resolve();
var lastGeocodeAt = 0;
async function geocode(address) {
  const key = address.trim().toLocaleLowerCase("pt-BR");
  const cached = geocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.coordinates;
  let releaseQueue;
  const nextSlot = new Promise((resolve) => releaseQueue = resolve);
  const previousSlot = geocodeQueue;
  geocodeQueue = previousSlot.then(
    () => nextSlot,
    () => nextSlot
  );
  await previousSlot;
  const queuedCache = geocodeCache.get(key);
  if (queuedCache && queuedCache.expiresAt > Date.now()) {
    releaseQueue();
    return queuedCache.coordinates;
  }
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("q", address);
  let response;
  try {
    const delay = Math.max(0, 1100 - (Date.now() - lastGeocodeAt));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastGeocodeAt = Date.now();
    response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "MarmitariaApp/1.0",
        "accept-language": "pt-BR,pt;q=0.9"
      },
      signal: AbortSignal.timeout(8e3)
    });
  } finally {
    releaseQueue();
  }
  if (!response.ok)
    throw new Error("N\xE3o foi poss\xEDvel localizar esse endere\xE7o agora.");
  const results = await response.json();
  const first = results[0];
  if (!first?.lat || !first.lon)
    throw new Error(
      "N\xE3o encontramos esse endere\xE7o. Confira rua, n\xFAmero e cidade."
    );
  const coordinates = {
    latitude: Number(first.lat),
    longitude: Number(first.lon)
  };
  geocodeCache.set(key, {
    coordinates,
    expiresAt: Date.now() + 6 * 60 * 60 * 1e3
  });
  if (geocodeCache.size > 500)
    geocodeCache.delete(geocodeCache.keys().next().value);
  return coordinates;
}
async function geocodeLoose(address) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", address);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    headers: { accept: "application/geo+json", "user-agent": "MarmitariaApp/1.0" },
    signal: AbortSignal.timeout(6e3)
  });
  if (!response.ok)
    throw new Error("N\xE3o foi poss\xEDvel localizar esse endere\xE7o agora.");
  const payload = await response.json();
  const point = payload.features?.[0]?.geometry?.coordinates;
  if (!point)
    throw new Error(
      "N\xE3o encontramos esse endere\xE7o. Confira rua, n\xFAmero e cidade."
    );
  return { latitude: point[1], longitude: point[0] };
}
async function locate(address) {
  try {
    return await geocode(address);
  } catch {
    return geocodeLoose(address);
  }
}
function straightLineMeters(origin, destination) {
  const radians = (value) => value * Math.PI / 180;
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.sqrt(a)) * ROAD_DETOUR_FACTOR;
}
var ROAD_DETOUR_FACTOR = 1.35;
function routableAddress(address) {
  return address.replace(/,?\s*Referência:.*?(?=,\s*nº|$)/i, "").replace(/,?\s*(apto|apartamento|ap|bloco|bl|casa|sala|fundos)\b[^,]*/gi, "").trim();
}
async function distanceBetweenAddresses(pickupAddress, dropoffAddress) {
  const origin = await locate(pickupAddress);
  const destination = await locate(routableAddress(dropoffAddress));
  const meters = await getRoadDistanceMeters(origin, destination).catch(
    () => straightLineMeters(origin, destination)
  );
  return Math.ceil(meters / 100) / 10;
}
async function getRoadDistanceMeters(origin, destination) {
  const pair = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${pair}?overview=false&alternatives=false&steps=false`,
    {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8e3)
    }
  );
  if (!response.ok)
    throw new Error(
      "N\xE3o foi poss\xEDvel calcular a rota de entrega. Tente novamente em instantes."
    );
  const payload = await response.json();
  const meters = payload.routes?.[0]?.distance;
  if (payload.code !== "Ok" || !Number.isFinite(meters) || !meters || meters <= 0) {
    throw new Error(
      "N\xE3o encontramos uma rota rodovi\xE1ria entre a loja e esse endere\xE7o."
    );
  }
  return meters;
}
async function quoteOwnCourier(input) {
  const origin = {
    latitude: input.pickupLatitude,
    longitude: input.pickupLongitude
  };
  const routableAddress2 = input.dropoffAddress.replace(/,?\s*Referência:.*$/i, "").trim();
  const destination = await geocode(routableAddress2);
  const distanceMeters = await getRoadDistanceMeters(origin, destination);
  const distanceKm = Math.ceil(distanceMeters / 100) / 10;
  return {
    fee: calculateOwnCourierFee(distanceKm, input.pricePerKm),
    distanceKm,
    origin,
    destination
  };
}

// server/routers.ts
init_crypto();
function deliveryAddressHash(companyId, provider, address, addressNumber, pickupAddress) {
  return createHash3("sha256").update(
    JSON.stringify([
      companyId,
      provider,
      address.trim(),
      addressNumber.trim(),
      pickupAddress.trim()
    ])
  ).digest("hex");
}
var addressSearchCache = /* @__PURE__ */ new Map();
function requireCustomerAccessToken(req) {
  const raw = req.headers["x-customer-access-token"];
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    token
  )) {
    throw new TRPCError2({
      code: "UNAUTHORIZED",
      message: "Acesso a este pedido n\xE3o autorizado."
    });
  }
  return token;
}
async function requireCompanyBySlug(slug) {
  if (isTestMode()) return buildTestCompany(slug);
  const company = await getCompanyBySlug(slug);
  if (!company)
    throw new TRPCError2({
      code: "NOT_FOUND",
      message: "Empresa n\xE3o encontrada."
    });
  return company;
}
async function createManualPaymentLink(companyId, orderId, payerEmail) {
  const found = await getOrderById(companyId, orderId);
  if (!found)
    throw new TRPCError2({
      code: "NOT_FOUND",
      message: "Pedido n\xE3o encontrado."
    });
  if (found.order.paymentMethod !== "mercadopago_link")
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Este pedido n\xE3o foi configurado para pagamento por link."
    });
  if (found.order.paymentStatus === "approved")
    throw new TRPCError2({
      code: "CONFLICT",
      message: "Este pedido j\xE1 est\xE1 pago."
    });
  if (found.order.externalPaymentId?.startsWith("pref:")) {
    return {
      orderId,
      paymentLink: await getPaymentLink(
        companyId,
        found.order.externalPaymentId.slice(5)
      )
    };
  }
  if (found.order.externalPaymentId)
    throw new TRPCError2({
      code: "CONFLICT",
      message: "Este pedido j\xE1 tem um pagamento em andamento."
    });
  const company = await getCompanyById(companyId);
  const link = await createPaymentLink({
    companyId,
    orderId,
    transactionAmount: Number(found.order.total),
    description: `Pedido #${orderId} \u2014 ${company?.name ?? "Sua loja"}`,
    payerEmail
  });
  await setOrderPayment(orderId, {
    paymentStatus: "pending",
    externalPaymentId: `pref:${link.id}`,
    platformFeeAmount: link.applicationFee.toFixed(2)
  });
  return { orderId, paymentLink: link.url };
}
var menuItemInput = z2.object({
  categoryId: z2.number().int().positive(),
  name: z2.string().trim().min(2).max(160),
  description: z2.string().trim().max(1e3).nullish(),
  price: z2.number().positive().max(1e5),
  imageUrl: z2.string().url().nullish(),
  active: z2.boolean().optional(),
  featured: z2.boolean().optional()
});
function deliveryPricingOf(company) {
  const value = (raw, fallback) => {
    const parsed = Number(raw);
    return raw === null || raw === void 0 || !Number.isFinite(parsed) ? fallback : parsed;
  };
  const base = DEFAULT_DELIVERY_PRICING;
  return {
    baseFee: value(company.deliveryBaseFee, base.baseFee),
    includedKm: value(company.deliveryIncludedKm, base.includedKm),
    pricePerKm: value(company.deliveryPricePerKm, base.pricePerKm),
    maxKm: value(company.deliveryMaxKm, base.maxKm)
  };
}
async function quoteModeFor(company) {
  const provider = await getActiveDeliveryProvider(company.id);
  if (provider === "uber_direct" || provider === "own_courier") return provider;
  return company.pickupAddress && !isTestMode() ? "estimate" : void 0;
}
async function estimateFor(company, dropoffAddress) {
  const pricing = deliveryPricingOf(company);
  const distanceKm = await distanceBetweenAddresses(
    company.pickupAddress ?? "",
    dropoffAddress
  );
  if (distanceKm > pricing.maxKm)
    throw new Error(
      `Entregamos at\xE9 ${pricing.maxKm} km. Este endere\xE7o fica a ${distanceKm.toFixed(1).replace(".", ",")} km.`
    );
  return { fee: estimateDeliveryFee(distanceKm, pricing), distanceKm };
}
var orderRateLimiter = createRateLimiter(8, 10 * 6e4);
var MAX_UNPAID_ORDERS_PER_HOUR = 5;
async function lookupCep(cep) {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(5e3)
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (data.erro || !data.localidade) return [];
    const street = data.logradouro || data.localidade;
    return [
      {
        name: street,
        street,
        housenumber: "",
        city: data.localidade,
        state: data.estado || data.uf || "",
        postcode: data.cep ?? cep,
        countrycode: "BR",
        type: "street",
        district: data.bairro ?? ""
      }
    ];
  } catch {
    return [];
  }
}
var openingHoursInput = z2.array(
  z2.object({
    enabled: z2.boolean(),
    open: z2.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    close: z2.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  })
).length(7).nullable();
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(
      (opts) => opts.ctx.user ? { ...opts.ctx.user, isSuperAdmin: isOwnerEmail(opts.ctx.user.email) } : null
    )
  }),
  address: router({
    suggestions: publicProcedure.input(z2.object({ q: z2.string().trim().min(4).max(120) })).query(async ({ input }) => {
      const normalizedQuery = input.q.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
      const cached = addressSearchCache.get(normalizedQuery);
      if (cached && cached.expiresAt > Date.now()) return cached.value;
      const cep = input.q.replace(/\D/g, "");
      if (/^\d{5}-?\d{3}$/.test(input.q)) {
        const value2 = await lookupCep(cep);
        addressSearchCache.set(normalizedQuery, {
          expiresAt: Date.now() + 15 * 6e4,
          value: value2
        });
        return value2;
      }
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q", input.q);
      url.searchParams.set("limit", "8");
      let response;
      try {
        response = await fetch(url, {
          headers: {
            accept: "application/geo+json",
            "user-agent": "MarmitariaApp/1.0"
          },
          signal: AbortSignal.timeout(5e3)
        });
      } catch {
        throw new TRPCError2({
          code: "BAD_GATEWAY",
          message: "A busca de endere\xE7os est\xE1 temporariamente indispon\xEDvel. Voc\xEA pode preencher o endere\xE7o manualmente."
        });
      }
      if (!response.ok)
        throw new TRPCError2({
          code: "BAD_GATEWAY",
          message: "O servi\xE7o de endere\xE7os n\xE3o respondeu. Voc\xEA ainda pode preencher o endere\xE7o manualmente."
        });
      const payload = await response.json();
      const value = (payload.features ?? []).map(
        ({ properties = {} }) => ({
          name: properties.name ?? properties.street ?? "",
          street: properties.street ?? properties.name ?? "",
          housenumber: properties.housenumber ?? "",
          city: properties.city ?? properties.town ?? properties.village ?? properties.county ?? "",
          state: properties.state ?? "",
          postcode: properties.postcode ?? "",
          countrycode: (properties.countrycode ?? "").toUpperCase(),
          type: properties.type ?? "",
          district: properties.district ?? properties.suburb ?? properties.locality ?? ""
        })
      ).filter(
        (item) => item.countrycode === "BR" && (item.street || item.name)
      );
      addressSearchCache.set(normalizedQuery, {
        expiresAt: Date.now() + 15 * 6e4,
        value
      });
      if (addressSearchCache.size > 500) {
        const oldest = addressSearchCache.keys().next().value;
        if (oldest) addressSearchCache.delete(oldest);
      }
      return value;
    })
  }),
  company: router({
    bySlug: publicProcedure.input(z2.object({ slug: z2.string() })).query(async ({ input }) => {
      if (isTestMode()) return buildTestCompany(input.slug);
      const company = await getCompanyBySlug(input.slug);
      return company ?? null;
    }),
    // The authenticated admin's own company (for the Admin/Integrações panels).
    mine: companyAdminProcedure.query(
      ({ ctx }) => getCompanyById(ctx.companyId)
    ),
    updateBranding: companyAdminProcedure.input(
      z2.object({
        name: z2.string().min(2).optional(),
        tagline: z2.string().optional(),
        logoUrl: z2.string().url().optional(),
        heroImageUrl: z2.string().url().optional(),
        primaryColor: z2.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        templateId: z2.enum(["classic", "modern", "cover", "premium"]).optional(),
        pickupAddress: z2.string().min(5).optional()
      })
    ).mutation(
      ({ ctx, input }) => updateCompanyBranding(ctx.companyId, input)
    ),
    updateOrdering: companyAdminProcedure.input(
      z2.object({
        openingHours: openingHoursInput,
        acceptsCashOnDelivery: z2.boolean(),
        pickupEnabled: z2.boolean(),
        pickupAddress: z2.string().trim().min(5).optional(),
        deliveryBaseFee: z2.number().min(0).max(1e3).optional(),
        deliveryIncludedKm: z2.number().min(0).max(100).optional(),
        deliveryPricePerKm: z2.number().min(0).max(100).optional(),
        deliveryMaxKm: z2.number().positive().max(200).optional()
      })
    ).mutation(
      ({ ctx, input }) => updateCompanyOrdering(ctx.companyId, input)
    ),
    // Completes signup for an already-authenticated Supabase user (see client/src/pages/CompanySignUp.tsx
    // for why this is a second step rather than done at supabase.auth.signUp time).
    signUp: protectedProcedure.input(
      z2.object({
        name: z2.string().min(2),
        slug: z2.string().min(3).max(60)
      })
    ).mutation(async ({ ctx, input }) => {
      if (ctx.user.companyId)
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "Esta conta j\xE1 est\xE1 vinculada a uma empresa."
        });
      if (!isSlugAvailableFormat(input.slug))
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "Esse endere\xE7o n\xE3o \xE9 v\xE1lido ou est\xE1 reservado."
        });
      if (await getCompanyBySlug(input.slug))
        throw new TRPCError2({
          code: "CONFLICT",
          message: "Esse endere\xE7o j\xE1 est\xE1 em uso."
        });
      const company = await createCompany({
        slug: input.slug,
        name: input.name
      });
      await upsertUser({
        supabaseUserId: ctx.user.supabaseUserId,
        companyId: company.id,
        role: "admin"
      });
      return { slug: company.slug };
    }),
    checkSlug: publicProcedure.input(z2.object({ slug: z2.string() })).query(async ({ input }) => {
      if (!isSlugAvailableFormat(input.slug))
        return { available: false };
      return { available: !await getCompanyBySlug(input.slug) };
    }),
    // Platform owner's view of every tenant.
    list: superAdminProcedure.query(() => listCompanies()),
    setStatus: superAdminProcedure.input(
      z2.object({
        companyId: z2.number().int().positive(),
        status: z2.enum(["active", "suspended"])
      })
    ).mutation(({ input }) => setCompanyStatus(input.companyId, input.status))
  }),
  menu: router({
    list: publicProcedure.input(z2.object({ companySlug: z2.string() })).query(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      return listActiveMenu(company.id);
    })
  }),
  orders: router({
    recent: companyAdminProcedure.input(
      z2.object({ limit: z2.number().min(1).max(100).default(20) }).optional()
    ).query(
      ({ ctx, input }) => listRecentOrders(ctx.companyId, input?.limit ?? 20)
    ),
    byId: publicProcedure.input(
      z2.object({ companySlug: z2.string(), id: z2.number().int().positive() })
    ).query(async ({ ctx, input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      return getCustomerOrderById(
        company.id,
        input.id,
        requireCustomerAccessToken(ctx.req)
      );
    }),
    create: publicProcedure.input(
      z2.object({
        companySlug: z2.string(),
        email: z2.string().email(),
        name: z2.string().trim().min(2).max(160),
        phone: z2.string().min(8).max(30),
        address: z2.string().trim().min(5).max(500),
        addressNumber: z2.string().trim().min(1).max(32),
        notes: z2.string().max(2e3).optional(),
        paymentMethod: z2.enum(["mercadopago", "cash_on_delivery"]).default("mercadopago"),
        fulfillment: z2.enum(["delivery", "pickup"]).default("delivery"),
        deliveryQuoteToken: z2.string().max(5e3).optional(),
        items: z2.array(
          z2.object({
            menuItemId: z2.number().int().positive(),
            quantity: z2.number().int().positive().max(50),
            observation: z2.string().max(300).optional()
          })
        ).min(1).max(30)
      })
    ).mutation(async ({ ctx, input }) => {
      if (!ctx.user || ctx.user.email?.toLowerCase() !== input.email.trim().toLowerCase())
        throw new TRPCError2({
          code: "UNAUTHORIZED",
          message: "Confirme o e-mail e entre na conta de comprador antes de criar o pedido."
        });
      if (!await isSupabaseEmailConfirmed(ctx.req, input.email))
        throw new TRPCError2({
          code: "UNAUTHORIZED",
          message: "Confirme seu e-mail antes de criar o pedido."
        });
      if (!isTestMode() && !orderRateLimiter(clientIp(ctx.req)))
        throw new TRPCError2({
          code: "TOO_MANY_REQUESTS",
          message: "Muitos pedidos em pouco tempo. Aguarde alguns minutos."
        });
      const company = await requireCompanyBySlug(input.companySlug);
      if (company.status !== "active")
        throw new TRPCError2({
          code: "FORBIDDEN",
          message: "Esta loja n\xE3o est\xE1 dispon\xEDvel no momento."
        });
      const storeStatus = getStoreStatus(company.openingHours);
      if (!storeStatus.open)
        throw new TRPCError2({
          code: "PRECONDITION_FAILED",
          message: storeStatus.label ?? "A loja est\xE1 fechada no momento."
        });
      const pickup = input.fulfillment === "pickup";
      if (pickup && !(company.pickupEnabled && company.pickupAddress))
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "Esta loja n\xE3o oferece retirada."
        });
      if (input.paymentMethod === "cash_on_delivery" && !company.acceptsCashOnDelivery)
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "Esta loja n\xE3o aceita pagamento na entrega."
        });
      const unpaidOrders = await countRecentUnpaidOrders(
        company.id,
        input.phone
      );
      if (unpaidOrders >= MAX_UNPAID_ORDERS_PER_HOUR)
        throw new TRPCError2({
          code: "TOO_MANY_REQUESTS",
          message: "Este telefone tem muitos pedidos sem pagamento. Tente de novo mais tarde."
        });
      const provider = pickup ? void 0 : await quoteModeFor(company);
      let fee = 0;
      let quoteId = null;
      if (provider) {
        if (!input.deliveryQuoteToken)
          throw new TRPCError2({
            code: "PRECONDITION_FAILED",
            message: "Atualize a cota\xE7\xE3o da entrega antes de pagar."
          });
        try {
          const quote = decryptJson(
            input.deliveryQuoteToken
          );
          if (quote.companyId !== company.id || quote.provider !== provider || quote.expiresAt <= Date.now() || quote.addressHash !== deliveryAddressHash(
            company.id,
            provider,
            input.address,
            input.addressNumber,
            company.pickupAddress ?? ""
          )) {
            throw new Error("invalid quote");
          }
          fee = quote.fee;
          quoteId = quote.quoteId;
        } catch {
          throw new TRPCError2({
            code: "PRECONDITION_FAILED",
            message: "A cota\xE7\xE3o da entrega expirou ou o endere\xE7o mudou. Aguarde a nova cota\xE7\xE3o."
          });
        }
      }
      const {
        companySlug,
        deliveryQuoteToken: _token,
        fulfillment: _fulfillment,
        ...orderInput
      } = input;
      const created = await createCustomerOrder(company.id, {
        ...orderInput,
        pickup,
        deliveryFee: fee,
        deliveryQuoteId: quoteId,
        accessToken: requireCustomerAccessToken(ctx.req),
        customerTrackingToken: randomUUID(),
        customerEmail: input.email
      });
      if (created.orderId && input.paymentMethod === "cash_on_delivery")
        await notifyOrderEvent(created.orderId, "paid");
      return created;
    }),
    createManual: companyAdminProcedure.input(
      z2.object({
        name: z2.string().trim().min(2).max(160),
        phone: z2.string().min(8).max(30),
        address: z2.string().trim().min(5).max(500),
        addressNumber: z2.string().trim().min(1).max(32),
        items: z2.array(
          z2.object({
            menuItemId: z2.number().int().positive(),
            quantity: z2.number().int().positive().max(50),
            observation: z2.string().max(300).optional()
          })
        ).min(1).max(30),
        notes: z2.string().max(2e3).optional(),
        paymentMode: z2.enum(["cash_on_delivery", "mercadopago_link"]).default("cash_on_delivery"),
        payerEmail: z2.string().email().max(254).optional()
      })
    ).mutation(async ({ ctx, input }) => {
      const { paymentMode, payerEmail, ...orderInput } = input;
      const company = await getCompanyById(ctx.companyId);
      const provider = company ? await quoteModeFor(company) : void 0;
      let deliveryFee = 0;
      let deliveryQuoteId = null;
      if (provider) {
        if (!company?.pickupAddress)
          throw new TRPCError2({
            code: "PRECONDITION_FAILED",
            message: "Cadastre o endere\xE7o de retirada da loja antes de lan\xE7ar o pedido."
          });
        const dropoffAddress = `${input.address}, n\xBA ${input.addressNumber}`;
        if (provider === "uber_direct") {
          const quote = await quoteDelivery({
            companyId: ctx.companyId,
            pickupAddress: company.pickupAddress,
            dropoffAddress
          });
          deliveryFee = quote.fee;
          deliveryQuoteId = quote.quoteId;
        } else if (provider === "own_courier") {
          const config = await getIntegrationCredentials(ctx.companyId, "own_courier");
          if (!config)
            throw new TRPCError2({
              code: "PRECONDITION_FAILED",
              message: "Configure tarifa/km e coordenadas do motoboy pr\xF3prio."
            });
          const quote = await quoteOwnCourier({
            pickupAddress: company.pickupAddress,
            pickupLatitude: config.pickupLatitude,
            pickupLongitude: config.pickupLongitude,
            dropoffAddress,
            pricePerKm: config.pricePerKm
          });
          deliveryFee = quote.fee;
        } else {
          deliveryFee = await estimateFor(company, dropoffAddress).then((quote) => quote.fee).catch(() => 0);
        }
      }
      const created = await createCustomerOrder(ctx.companyId, {
        ...orderInput,
        deliveryFee,
        deliveryQuoteId,
        accessToken: randomUUID(),
        customerTrackingToken: randomUUID(),
        paymentMethod: paymentMode
      });
      if (paymentMode !== "mercadopago_link" || !created.persisted || !created.orderId)
        return { ...created, paymentLink: null };
      try {
        return {
          ...created,
          ...await createManualPaymentLink(
            ctx.companyId,
            created.orderId,
            payerEmail
          )
        };
      } catch {
        return {
          ...created,
          paymentLink: null,
          paymentLinkError: "O pedido foi criado, mas n\xE3o foi poss\xEDvel gerar o link. Use \u2018Gerar link\u2019 para tentar novamente."
        };
      }
    }),
    createManualPaymentLink: companyAdminProcedure.input(z2.object({ orderId: z2.number().int().positive() })).mutation(
      ({ ctx, input }) => createManualPaymentLink(ctx.companyId, input.orderId)
    ),
    markCashReceived: companyAdminProcedure.input(z2.object({ orderId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const found = await getOrderById(ctx.companyId, input.orderId);
      if (!found)
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "Pedido n\xE3o encontrado."
        });
      if (found.order.paymentMethod !== "cash_on_delivery")
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "S\xF3 pedidos configurados para pagamento em dinheiro podem ser marcados como recebidos aqui."
        });
      if (found.order.paymentStatus !== "approved")
        await setOrderPayment(input.orderId, {
          paymentStatus: "approved",
          platformFeeAmount: "0.00"
        });
      return { orderId: input.orderId, paymentStatus: "approved" };
    }),
    history: publicProcedure.input(z2.object({ companySlug: z2.string(), phone: z2.string().min(8) })).query(async ({ ctx, input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      return listCustomerOrders(
        company.id,
        input.phone,
        requireCustomerAccessToken(ctx.req)
      );
    }),
    // Exclusão lógica: some da cozinha e do financeiro, mas o registro fica para
    // o cliente ver o cancelamento e para conferir um pagamento que precise de estorno.
    remove: companyAdminProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const result = await advanceOrderStatus(
        ctx.companyId,
        input.id,
        "cancelled"
      );
      if (!result.persisted)
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "Pedido n\xE3o encontrado."
        });
      return { removed: true };
    }),
    advanceStatus: companyAdminProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        status: z2.enum(ORDER_STATUS_FLOW)
      })
    ).mutation(async ({ ctx, input }) => {
      const before = await getOrderById(ctx.companyId, input.id);
      if (before && !isReadyForKitchen(before.order))
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "Este pedido ainda n\xE3o foi pago."
        });
      if (input.status === "delivered") {
        const current = before;
        if (current?.order.driverTrackingTokenHash)
          throw new TRPCError2({
            code: "BAD_REQUEST",
            message: "O motoboy precisa confirmar a entrega com o c\xF3digo do cliente."
          });
      }
      const result = await advanceOrderStatus(
        ctx.companyId,
        input.id,
        input.status
      );
      const event = eventForStatus(input.status);
      if (result.persisted && event && before && isForwardMove(before.order.status, input.status))
        await notifyOrderEvent(input.id, event);
      if (input.status !== "ready" || !result.persisted || !isForwardMove(before?.order.status, "ready") || before && isPickupOrder(before.order))
        return { ...result, delivery: null };
      const provider = await getActiveDeliveryProvider(ctx.companyId);
      if (!provider)
        return {
          ...result,
          delivery: unavailableDeliveryResponse(
            "uber_direct",
            "Nenhum provedor de entrega conectado. Configure em Integra\xE7\xF5es."
          )
        };
      if (provider === "own_courier") {
        const driverToken = randomUUID();
        const issued = await issueDriverTrackingToken(
          ctx.companyId,
          input.id,
          driverToken
        );
        if (!issued)
          return {
            ...result,
            delivery: unavailableDeliveryResponse(
              "own_courier",
              "O link do motoboy s\xF3 pode ser emitido quando o pedido estiver pronto."
            )
          };
        return {
          ...result,
          delivery: {
            provider: "own_courier",
            available: true,
            trackingUrl: null,
            driverToken
          }
        };
      }
      try {
        const [company, order] = await Promise.all([
          getCompanyById(ctx.companyId),
          getOrderById(ctx.companyId, input.id)
        ]);
        if (!company?.pickupAddress)
          return {
            ...result,
            delivery: unavailableDeliveryResponse(
              provider,
              "Cadastre o endere\xE7o de retirada da empresa em Integra\xE7\xF5es."
            )
          };
        if (!order?.customer)
          return {
            ...result,
            delivery: unavailableDeliveryResponse(
              provider,
              "Pedido sem endere\xE7o de entrega associado."
            )
          };
        const deliveryInput = {
          companyId: ctx.companyId,
          pickupAddress: company.pickupAddress,
          orderId: input.id,
          dropoffAddress: order.order.deliveryAddress ?? order.customer.address ?? "",
          dropoffName: order.customer.name,
          dropoffPhone: order.customer.phone
        };
        const delivery = provider === "uber_direct" ? await createDelivery({
          ...deliveryInput,
          companyName: company.name,
          quoteId: order.order.deliveryQuoteId ?? (await quoteDelivery({
            companyId: ctx.companyId,
            pickupAddress: company.pickupAddress,
            dropoffAddress: deliveryInput.dropoffAddress
          })).quoteId,
          manifestItems: order.items.map((item) => ({
            name: item.itemName,
            quantity: item.quantity
          }))
        }) : await createDelivery2(deliveryInput);
        await setOrderDelivery(input.id, {
          trackingUrl: delivery.trackingUrl,
          externalDeliveryId: delivery.deliveryId
        });
        return {
          ...result,
          delivery: {
            provider,
            available: true,
            trackingUrl: delivery.trackingUrl
          }
        };
      } catch (error) {
        console.error(`[Delivery] ${provider} dispatch failed:`, error);
        return {
          ...result,
          delivery: unavailableDeliveryResponse(
            provider,
            "Falha ao acionar o despacho autom\xE1tico. Tente novamente ou acione manualmente."
          )
        };
      }
    })
  }),
  dashboard: router({
    summary: companyAdminProcedure.query(
      ({ ctx }) => getDashboardSummary(ctx.companyId)
    )
  }),
  adminMenu: router({
    list: companyAdminProcedure.query(
      ({ ctx }) => listAdminMenu(ctx.companyId)
    ),
    categories: companyAdminProcedure.query(
      ({ ctx }) => listMenuCategories(ctx.companyId)
    ),
    createCategory: companyAdminProcedure.input(z2.object({ name: z2.string().trim().min(2).max(120) })).mutation(({ ctx, input }) => createMenuCategory(ctx.companyId, input)),
    create: companyAdminProcedure.input(menuItemInput).mutation(async ({ ctx, input }) => {
      const item = await createMenuItem(ctx.companyId, input);
      if (!item)
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "Categoria inv\xE1lida."
        });
      return item;
    }),
    update: companyAdminProcedure.input(
      z2.object({
        id: z2.number().int().positive(),
        data: menuItemInput.partial()
      })
    ).mutation(async ({ ctx, input }) => {
      const item = await updateMenuItem(ctx.companyId, input.id, input.data);
      if (!item)
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "Item n\xE3o encontrado."
        });
      return item;
    }),
    delete: companyAdminProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (!await deleteMenuItem(ctx.companyId, input.id))
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "Item n\xE3o encontrado."
        });
      return { success: true };
    })
  }),
  whatsapp: router({
    // Nunca devolve segredos: só o que a tela precisa (status, QR para escanear, preferências).
    status: companyAdminProcedure.query(async ({ ctx }) => {
      const bot = await getWhatsappBot(ctx.companyId);
      const heartbeat = bot?.heartbeatAt ? new Date(
        bot.heartbeatAt.endsWith("Z") ? bot.heartbeatAt : `${bot.heartbeatAt}Z`
      ).getTime() : 0;
      return {
        desired: bot?.desired ?? "disconnected",
        status: bot?.status ?? "idle",
        qr: bot?.status === "qr" ? bot.qr : null,
        phone: bot?.phone ?? null,
        error: bot?.error ?? null,
        aiEnabled: bot?.aiEnabled ?? true,
        instructions: bot?.instructions ?? "",
        serviceOnline: Date.now() - heartbeat < BOT_HEARTBEAT_MAX_AGE_MS
      };
    }),
    connect: companyAdminProcedure.mutation(async ({ ctx }) => {
      await requestWhatsappConnect(ctx.companyId);
      return { success: true };
    }),
    disconnect: companyAdminProcedure.mutation(async ({ ctx }) => {
      await requestWhatsappDisconnect(ctx.companyId);
      return { success: true };
    }),
    updateSettings: companyAdminProcedure.input(
      z2.object({
        aiEnabled: z2.boolean().optional(),
        instructions: z2.string().trim().max(1500).nullish()
      })
    ).mutation(async ({ ctx, input }) => {
      await updateWhatsappSettings(ctx.companyId, input);
      return { success: true };
    })
  }),
  recipes: router({
    list: companyAdminProcedure.query(
      ({ ctx }) => listRecipeIngredients(ctx.companyId)
    ),
    save: companyAdminProcedure.input(
      z2.object({
        menuItemId: z2.number().int().positive(),
        lines: z2.array(
          z2.object({
            inventoryItemId: z2.number().int().positive(),
            quantity: z2.number().positive().max(1e6),
            unit: z2.string().min(1).max(20),
            lossPercent: z2.number().min(0).max(MAX_LOSS_PERCENT).nullable()
          })
        ).max(60)
      })
    ).mutation(async ({ ctx, input }) => {
      const stock = await listInventory(ctx.companyId);
      const units = new Map(
        stock.map((item) => [Number(item.id), String(item.unit)])
      );
      for (const line of input.lines) {
        const stockUnit = units.get(line.inventoryItemId);
        if (!stockUnit)
          throw new TRPCError2({
            code: "BAD_REQUEST",
            message: "Um dos insumos n\xE3o pertence ao seu estoque."
          });
        if (!compatibleUnits(stockUnit).includes(line.unit))
          throw new TRPCError2({
            code: "BAD_REQUEST",
            message: `A unidade ${line.unit} n\xE3o combina com ${stockUnit}.`
          });
      }
      const saved = await saveRecipe(ctx.companyId, input);
      if (!saved)
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "Prato n\xE3o encontrado."
        });
      return { saved: true };
    })
  }),
  inventory: router({
    list: companyAdminProcedure.query(
      ({ ctx }) => listInventory(ctx.companyId)
    ),
    movements: companyAdminProcedure.input(
      z2.object({ limit: z2.number().int().min(1).max(100).default(100) }).optional()
    ).query(
      ({ ctx, input }) => listInventoryMovements(ctx.companyId, input?.limit ?? 100)
    ),
    createItem: companyAdminProcedure.input(
      z2.object({
        name: z2.string().trim().min(2).max(160),
        unit: z2.enum(["un", "kg", "g", "L", "ml", "cx", "pct"]),
        minimumQuantity: z2.number().min(0).max(1e9),
        costPerUnit: z2.number().min(0).max(1e8),
        lastSupplier: z2.string().trim().max(160).optional()
      })
    ).mutation(({ ctx, input }) => createInventoryItem(ctx.companyId, input)),
    updateItem: companyAdminProcedure.input(
      z2.object({
        itemId: z2.number().int().positive(),
        costPerUnit: z2.number().min(0).max(1e8).optional(),
        minimumQuantity: z2.number().min(0).max(1e9).optional(),
        lastSupplier: z2.string().trim().max(160).optional(),
        active: z2.boolean().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      const updated = await updateInventoryItem(ctx.companyId, input);
      if (!updated)
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "Item de estoque n\xE3o encontrado."
        });
      return { updated: true };
    }),
    recordMovement: companyAdminProcedure.input(
      z2.object({
        itemId: z2.number().int().positive(),
        type: z2.enum(["in", "out", "adjustment"]),
        quantity: z2.number().min(0).max(1e9),
        reason: z2.string().trim().min(1).max(160)
      })
    ).mutation(async ({ ctx, input }) => {
      if (input.type !== "adjustment" && input.quantity <= 0)
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "A quantidade precisa ser maior que zero."
        });
      try {
        const item = await recordInventoryMovement(ctx.companyId, input);
        if (!item)
          throw new TRPCError2({
            code: "NOT_FOUND",
            message: "Item de estoque n\xE3o encontrado."
          });
        return item;
      } catch (error) {
        if (error instanceof TRPCError2) throw error;
        if (error instanceof Error && /insufficient inventory|Estoque insuficiente/i.test(error.message))
          throw new TRPCError2({
            code: "BAD_REQUEST",
            message: "Estoque insuficiente para essa sa\xEDda."
          });
        throw error;
      }
    })
  }),
  finance: router({
    recentExpenses: companyAdminProcedure.input(
      z2.object({ limit: z2.number().int().min(1).max(100).default(50) }).optional()
    ).query(
      ({ ctx, input }) => listRecentExpenses(ctx.companyId, input?.limit ?? 50)
    ),
    createExpense: companyAdminProcedure.input(
      z2.object({
        description: z2.string().trim().min(2).max(200),
        category: z2.string().trim().min(1).max(80),
        amount: z2.number().positive().max(1e8),
        date: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
          (value) => Number.isFinite(Date.parse(`${value}T12:00:00Z`)),
          "Data inv\xE1lida."
        ),
        notes: z2.string().trim().max(500).optional()
      })
    ).mutation(({ ctx, input }) => createExpense(ctx.companyId, input)),
    report: companyAdminProcedure.input(
      z2.object({
        from: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      }).refine(
        ({ from, to }) => from <= to && (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 864e5 <= 730,
        "Selecione um per\xEDodo de at\xE9 dois anos."
      )
    ).query(
      ({ ctx, input }) => getFinanceReport(ctx.companyId, input.from, input.to)
    )
  }),
  payments: router({
    // Public: the customer checkout needs to know whether to render the live
    // Payment Brick (Pix/crédito/débito) and the seller's
    // public key to initialize the Brick client-side. Never expose the access token.
    checkoutConfig: publicProcedure.input(z2.object({ companySlug: z2.string() })).query(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      const [credentials, deliveryProvider] = await Promise.all([
        getConnectedCredentials(company.id),
        quoteModeFor(company)
      ]);
      return {
        connected: Boolean(credentials),
        publicKey: credentials?.publicKey ?? null,
        deliveryProvider: deliveryProvider ?? null
      };
    }),
    deliveryQuote: publicProcedure.input(
      z2.object({
        companySlug: z2.string(),
        address: z2.string().trim().min(5).max(500),
        addressNumber: z2.string().trim().min(1).max(32)
      })
    ).mutation(async ({ input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      const provider = await quoteModeFor(company);
      if (!provider)
        return {
          provider: null,
          fee: 0,
          currency: "BRL",
          quoteToken: null,
          distanceKm: null,
          expiresAt: null
        };
      if (!company.pickupAddress)
        throw new TRPCError2({
          code: "PRECONDITION_FAILED",
          message: "A loja ainda n\xE3o cadastrou o endere\xE7o de retirada."
        });
      const dropoffAddress = `${input.address.trim()}, n\xBA ${input.addressNumber.trim()}`;
      try {
        let fee;
        let quoteId = null;
        let expiresAt;
        let distanceKm = null;
        if (provider === "uber_direct") {
          const quote = await quoteDelivery({
            companyId: company.id,
            pickupAddress: company.pickupAddress,
            dropoffAddress
          });
          fee = quote.fee;
          quoteId = quote.quoteId;
          expiresAt = quote.expiresAt;
        } else if (provider === "own_courier") {
          const config = await getIntegrationCredentials(company.id, "own_courier");
          if (!config || !Number.isFinite(config.pricePerKm) || !Number.isFinite(config.pickupLatitude) || !Number.isFinite(config.pickupLongitude)) {
            throw new Error(
              "Configure a tarifa por km e as coordenadas da loja em Integra\xE7\xF5es."
            );
          }
          const quote = await quoteOwnCourier({
            pickupAddress: company.pickupAddress,
            pickupLatitude: config.pickupLatitude,
            pickupLongitude: config.pickupLongitude,
            dropoffAddress,
            pricePerKm: config.pricePerKm
          });
          fee = quote.fee;
          distanceKm = quote.distanceKm;
          expiresAt = Date.now() + 5 * 6e4;
        } else {
          const quote = await estimateFor(company, dropoffAddress);
          fee = quote.fee;
          distanceKm = quote.distanceKm;
          expiresAt = Date.now() + 5 * 6e4;
        }
        const payload = {
          companyId: company.id,
          provider,
          fee,
          quoteId,
          addressHash: deliveryAddressHash(
            company.id,
            provider,
            input.address,
            input.addressNumber,
            company.pickupAddress
          ),
          expiresAt,
          ...distanceKm === null ? {} : { distanceKm }
        };
        return {
          provider,
          fee,
          currency: "BRL",
          quoteToken: encryptJson(payload),
          distanceKm,
          expiresAt
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel calcular a entrega.";
        throw new TRPCError2({ code: "BAD_GATEWAY", message });
      }
    }),
    // Amount/description are derived from the persisted order — never trust
    // the client for the charge amount.
    create: publicProcedure.input(
      z2.object({
        companySlug: z2.string(),
        orderId: z2.number().int().positive(),
        payerEmail: z2.string().email(),
        paymentMethodId: z2.string().optional(),
        token: z2.string().optional(),
        installments: z2.number().int().positive().optional(),
        issuerId: z2.string().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      if (!ctx.user || ctx.user.email?.toLowerCase() !== input.payerEmail.trim().toLowerCase())
        throw new TRPCError2({
          code: "UNAUTHORIZED",
          message: "Confirme seu e-mail antes de pagar."
        });
      if (!await isSupabaseEmailConfirmed(ctx.req, input.payerEmail))
        throw new TRPCError2({
          code: "UNAUTHORIZED",
          message: "Confirme seu e-mail antes de pagar."
        });
      if (isBoletoPaymentMethod(input.paymentMethodId)) {
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "Pagamento por boleto n\xE3o est\xE1 dispon\xEDvel. Escolha Pix ou cart\xE3o."
        });
      }
      const order = await getCustomerOrderById(
        company.id,
        input.orderId,
        requireCustomerAccessToken(ctx.req)
      );
      if (!order)
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "Pedido n\xE3o encontrado"
        });
      if (order.order.paymentStatus === "approved" || order.order.externalPaymentId && order.order.paymentStatus === "pending") {
        throw new TRPCError2({
          code: "CONFLICT",
          message: "Este pedido j\xE1 tem um pagamento em andamento ou aprovado."
        });
      }
      const payment = await createPayment({
        companyId: company.id,
        orderId: input.orderId,
        transactionAmount: Number(order.order.total),
        description: `Pedido #${input.orderId} \u2014 ${company.name}`,
        payer: {
          email: input.payerEmail,
          name: order.customer?.name,
          phone: order.customer?.phone
        },
        items: order.items.map((item) => ({
          id: item.menuItemId,
          title: item.itemName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice)
        })),
        paymentMethodId: input.paymentMethodId,
        token: input.token,
        installments: input.installments,
        issuerId: input.issuerId
      });
      const paymentStatus = payment.status === "approved" || payment.status === "rejected" ? payment.status : "pending";
      await setOrderPayment(input.orderId, {
        paymentStatus,
        externalPaymentId: String(payment.id),
        platformFeeAmount: payment.applicationFee.toFixed(2)
      });
      if (paymentStatus === "approved")
        await notifyOrderEvent(input.orderId, "paid");
      return payment;
    }),
    // Segunda via do webhook: a cozinha só vê pedido pago, então um aviso perdido
    // do Mercado Pago não pode deixar um pedido pago de fora.
    syncPending: publicProcedure.input(
      z2.object({
        companySlug: z2.string(),
        orderId: z2.number().int().positive()
      })
    ).mutation(async ({ ctx, input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      const found = await getCustomerOrderById(
        company.id,
        input.orderId,
        requireCustomerAccessToken(ctx.req)
      );
      if (!found)
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "Pedido n\xE3o encontrado"
        });
      const paymentId = found.order.externalPaymentId;
      if (found.order.paymentStatus !== "pending" || !paymentId)
        return { paymentStatus: found.order.paymentStatus };
      const current = await getPayment(company.id, paymentId);
      if (current.status === "approved") {
        await setOrderPayment(input.orderId, {
          paymentStatus: "approved",
          externalPaymentId: paymentId
        });
        await notifyOrderEvent(input.orderId, "paid");
        return { paymentStatus: "approved" };
      }
      if (current.status === "rejected" || current.status === "cancelled") {
        await setOrderPayment(input.orderId, {
          paymentStatus: "rejected",
          externalPaymentId: paymentId
        });
        return { paymentStatus: "rejected" };
      }
      return { paymentStatus: "pending" };
    }),
    // Libera o pedido para outra forma de pagamento. Consulta o Mercado Pago
    // antes e depois de cancelar para nunca descartar um Pix que acabou de ser pago.
    cancelPending: publicProcedure.input(
      z2.object({
        companySlug: z2.string(),
        orderId: z2.number().int().positive()
      })
    ).mutation(async ({ ctx, input }) => {
      const company = await requireCompanyBySlug(input.companySlug);
      const found = await getCustomerOrderById(
        company.id,
        input.orderId,
        requireCustomerAccessToken(ctx.req)
      );
      if (!found)
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "Pedido n\xE3o encontrado"
        });
      if (found.order.paymentStatus === "approved")
        return { status: "approved" };
      const paymentId = found.order.externalPaymentId;
      if (!paymentId || found.order.paymentStatus !== "pending")
        return { status: "cancelled" };
      const markApproved = async () => {
        await setOrderPayment(input.orderId, {
          paymentStatus: "approved",
          externalPaymentId: paymentId
        });
        await notifyOrderEvent(input.orderId, "paid");
        return { status: "approved" };
      };
      const current = await getPayment(company.id, paymentId);
      if (current.status === "approved") return markApproved();
      if (current.payment_method_id !== "pix")
        throw new TRPCError2({
          code: "CONFLICT",
          message: "Este pagamento est\xE1 em an\xE1lise e n\xE3o pode ser trocado."
        });
      if (current.status === "pending" && !await cancelPayment(company.id, paymentId)) {
        const latest = await getPayment(company.id, paymentId);
        if (latest.status === "approved") return markApproved();
        if (latest.status === "pending")
          throw new TRPCError2({
            code: "CONFLICT",
            message: "N\xE3o foi poss\xEDvel cancelar este Pix. Tente de novo."
          });
      }
      await setOrderPayment(input.orderId, {
        paymentStatus: "rejected",
        externalPaymentId: null
      });
      return { status: "cancelled" };
    })
  }),
  tracking: router({
    customer: publicProcedure.input(z2.object({ token: z2.string().uuid() })).query(async ({ input }) => {
      const tracking = await getCustomerTracking(input.token);
      if (!tracking)
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "Link de rastreamento inv\xE1lido ou expirado."
        });
      return tracking;
    }),
    /** Pedidos do comprador logado (e-mail confirmado por código) nesta loja. */
    myOrders: publicProcedure.input(z2.object({ companySlug: z2.string() })).query(async ({ ctx, input }) => {
      if (!ctx.user?.email)
        throw new TRPCError2({
          code: "UNAUTHORIZED",
          message: "Confirme seu e-mail para ver seus pedidos."
        });
      if (!await isSupabaseEmailConfirmed(ctx.req, ctx.user.email))
        throw new TRPCError2({
          code: "UNAUTHORIZED",
          message: "Confirme seu e-mail para ver seus pedidos."
        });
      const company = await requireCompanyBySlug(input.companySlug);
      return listOrdersForEmail(company.id, ctx.user.email);
    }),
    mine: publicProcedure.input(z2.object({ companySlug: z2.string(), orderId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
      if (!ctx.user?.email)
        throw new TRPCError2({ code: "UNAUTHORIZED", message: "Entre com seu e-mail." });
      const company = await requireCompanyBySlug(input.companySlug);
      const tracking = await getTrackingForEmail(company.id, input.orderId, ctx.user.email);
      if (!tracking)
        throw new TRPCError2({ code: "NOT_FOUND", message: "Pedido n\xE3o encontrado." });
      return tracking;
    }),
    driver: publicProcedure.input(z2.object({ token: z2.string().uuid() })).query(async ({ input }) => {
      const tracking = await getDriverTrackingInfo(input.token);
      if (!tracking)
        throw new TRPCError2({
          code: "NOT_FOUND",
          message: "Link privado do motoboy inv\xE1lido ou expirado."
        });
      return tracking;
    }),
    updateDriverLocation: publicProcedure.input(
      z2.object({
        token: z2.string().uuid(),
        latitude: z2.number().min(-90).max(90),
        longitude: z2.number().min(-180).max(180)
      })
    ).mutation(async ({ input }) => {
      const before = await findOrderByDriverToken(input.token);
      const updated = await updateDriverLocation(
        input.token,
        input.latitude,
        input.longitude
      );
      if (!updated)
        throw new TRPCError2({
          code: "FORBIDDEN",
          message: "Link inv\xE1lido ou entrega n\xE3o est\xE1 em andamento."
        });
      if (before && before.status === "ready")
        await notifyOrderEvent(before.id, "out_for_delivery");
      return { updated: true };
    }),
    confirmDelivery: publicProcedure.input(
      z2.object({
        token: z2.string().uuid(),
        code: z2.string().regex(/^\d{4}$/)
      })
    ).mutation(async ({ input }) => {
      const deliveringOrder = await findOrderByDriverToken(input.token);
      const delivered = await confirmDriverDelivery(input.token, input.code);
      if (!delivered)
        throw new TRPCError2({
          code: "BAD_REQUEST",
          message: "C\xF3digo incorreto ou entrega n\xE3o est\xE1 em andamento."
        });
      if (deliveringOrder) await notifyOrderEvent(deliveringOrder.id, "delivered");
      return { delivered: true };
    })
  }),
  integrations: router({
    status: companyAdminProcedure.query(async ({ ctx }) => {
      const persisted = await getIntegrationsStatus(ctx.companyId);
      return {
        mercadopago: {
          connected: persisted.mercadopago,
          configured: isMercadoPagoConfigured()
        },
        uberDirect: { connected: persisted.uber_direct },
        lalamove: { connected: persisted.lalamove },
        ownCourier: { connected: persisted.own_courier },
        ninetyNineDelivery: {
          connected: false,
          reason: "Sem API self-service p\xFAblica \u2014 depende de parceria comercial com a 99."
        },
        messaging: { connected: persisted.messaging }
      };
    }),
    mercadoPagoConnectUrl: companyAdminProcedure.query(({ ctx }) => {
      if (!isMercadoPagoConfigured())
        throw new TRPCError2({
          code: "INTERNAL_SERVER_ERROR",
          message: "Configure MP_CLIENT_ID, MP_CLIENT_SECRET e MP_REDIRECT_URI no servidor primeiro."
        });
      return { url: buildAuthorizeUrl(ctx.companyId) };
    }),
    setDeliveryProvider: companyAdminProcedure.input(
      z2.discriminatedUnion("provider", [
        z2.object({
          provider: z2.literal("uber_direct"),
          clientId: z2.string().min(1),
          clientSecret: z2.string().min(1),
          customerId: z2.string().min(1)
        }),
        z2.object({
          provider: z2.literal("lalamove"),
          apiKey: z2.string().min(1),
          apiSecret: z2.string().min(1)
        }),
        z2.object({
          provider: z2.literal("own_courier"),
          name: z2.string().trim().min(1).max(120),
          phone: z2.string().min(8).max(30),
          pricePerKm: z2.number().positive().max(1e4),
          pickupLatitude: z2.number().min(-90).max(90),
          pickupLongitude: z2.number().min(-180).max(180)
        })
      ])
    ).mutation(async ({ ctx, input }) => {
      const { provider, ...credentials } = input;
      await saveIntegrationCredentials(ctx.companyId, provider, credentials);
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
    const { getIntegrationCredentials: getIntegrationCredentials2, setOrderPayment: setOrderPayment2, findOrderByExternalPaymentId: findOrderByExternalPaymentId2, getOrderById: getOrderById2 } = await Promise.resolve().then(() => (init_db(), db_exports));
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
    if (!orderId || !Number.isSafeInteger(orderId)) return;
    if (credentials.userId && String(payment.collector_id) !== String(credentials.userId)) return;
    const paymentIdOrder = await findOrderByExternalPaymentId2(companyId, String(paymentId));
    let existingOrder = paymentIdOrder;
    if (!existingOrder && payment.preference_id) {
      const preferenceOrder = await getOrderById2(companyId, orderId);
      if (preferenceOrder?.order.externalPaymentId === `pref:${payment.preference_id}`) existingOrder = preferenceOrder.order;
    }
    if (!existingOrder || existingOrder.id !== orderId || existingOrder.companyId !== companyId || Number(payment.transaction_amount).toFixed(2) !== Number(existingOrder.total).toFixed(2)) return;
    if (existingOrder.paymentStatus !== mappedStatus) {
      await setOrderPayment2(orderId, { paymentStatus: mappedStatus, externalPaymentId: String(paymentId) });
      if (mappedStatus === "approved") {
        const { notifyOrderEvent: notifyOrderEvent2 } = await Promise.resolve().then(() => (init_notifications(), notifications_exports));
        await notifyOrderEvent2(orderId, "paid");
      }
    }
  } catch (error) {
    console.error("[MercadoPago] Webhook processing failed:", error);
  } finally {
    if (!res.headersSent) res.writeHead(200).end("ok");
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
