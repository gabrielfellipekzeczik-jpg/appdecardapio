import { createHash } from "node:crypto";
import { calculateDeliveryFee } from "@shared/checkout";
import { buildFinanceReport } from "@shared/finance";
import { PICKUP_ADDRESS, isPickupOrder } from "@shared/store-rules";
type DemoCategory = {
  id: number;
  companyId: number;
  name: string;
  description: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
};
type DemoMenuItem = {
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
type DemoCustomer = {
  id: number;
  companyId: number;
  name: string;
  phone: string;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};
type DemoOrderItem = {
  id: number;
  orderId: number;
  menuItemId: number;
  itemName: string;
  quantity: number;
  unitPrice: string;
  observation: string | null;
};
type DemoOrder = {
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
  paymentApprovedAt: string | null;
  notes: string | null;
  trackingUrl: string | null;
  externalPaymentId: string | null;
  externalDeliveryId: string | null;
  deliveryQuoteId?: string | null;
  customerAccessTokenHash?: string;
  customerTrackingTokenHash?: string | null;
  driverTrackingTokenHash?: string | null;
  trackingLatitude?: string | null;
  trackingLongitude?: string | null;
  trackingUpdatedAt?: string | null;
  deliveryAddress?: string | null;
  createdAt: string;
  updatedAt: string;
};

const DEMO_COMPANY_ID = -1;
const now = () => new Date().toISOString();
const categories: DemoCategory[] = [
  {
    id: 1,
    companyId: DEMO_COMPANY_ID,
    name: "Mais pedidos",
    description: null,
    sortOrder: 1,
    active: true,
    createdAt: now(),
  },
  {
    id: 2,
    companyId: DEMO_COMPANY_ID,
    name: "Leves & fit",
    description: null,
    sortOrder: 2,
    active: true,
    createdAt: now(),
  },
  {
    id: 3,
    companyId: DEMO_COMPANY_ID,
    name: "Especiais",
    description: null,
    sortOrder: 3,
    active: true,
    createdAt: now(),
  },
];
const menu: DemoMenuItem[] = [
  {
    id: 1,
    companyId: DEMO_COMPANY_ID,
    categoryId: 1,
    name: "Caseira da semana",
    description:
      "Arroz soltinho, feijão cremoso, frango grelhado, purê de batata e salada fresca.",
    price: "24.90",
    imageUrl:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85",
    active: true,
    featured: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 2,
    companyId: DEMO_COMPANY_ID,
    categoryId: 1,
    name: "Bife acebolado",
    description:
      "Bife macio na chapa, arroz, feijão, farofa crocante e vinagrete da casa.",
    price: "28.90",
    imageUrl:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=85",
    active: true,
    featured: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 3,
    companyId: DEMO_COMPANY_ID,
    categoryId: 2,
    name: "Frango tropical",
    description:
      "Frango ao molho de laranja, arroz integral, legumes tostados e folhas.",
    price: "26.90",
    imageUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85",
    active: true,
    featured: false,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 4,
    companyId: DEMO_COMPANY_ID,
    categoryId: 2,
    name: "Bowl da horta",
    description:
      "Quinoa, grão-de-bico, abóbora assada, avocado e molho de ervas.",
    price: "25.90",
    imageUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85",
    active: true,
    featured: false,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 5,
    companyId: DEMO_COMPANY_ID,
    categoryId: 3,
    name: "Parmegiana de domingo",
    description:
      "Frango empanado, molho de tomate assado, queijo gratinado e batatas rústicas.",
    price: "32.90",
    imageUrl:
      "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=900&q=85",
    active: true,
    featured: true,
    createdAt: now(),
    updatedAt: now(),
  },
];
const customers: DemoCustomer[] = [];
const orders: Array<{
  order: DemoOrder;
  customer: DemoCustomer;
  items: DemoOrderItem[];
}> = [];
type DemoInventoryItem = {
  id: number;
  companyId: number;
  name: string;
  unit: string;
  currentQuantity: string;
  minimumQuantity: string;
  costPerUnit: string;
  active: boolean;
  updatedAt: string;
};
type DemoMovement = {
  id: number;
  inventoryItemId: number;
  type: "in" | "out" | "adjustment";
  quantity: string;
  reason: string;
  occurredAt: string;
};
type DemoExpense = {
  id: number;
  companyId: number;
  description: string;
  category: string;
  amount: string;
  incurredAt: string;
  notes: string | null;
  createdAt: string;
};
const inventoryItems: DemoInventoryItem[] = [];
const inventoryMovements: DemoMovement[] = [];
const expenses: DemoExpense[] = [];
let nextCustomerId = 1;
let nextOrderId = 2000;
let nextOrderItemId = 1;
let nextInventoryItemId = 1;
let nextMovementId = 1;
let nextExpenseId = 1;

export function testListActiveMenu() {
  return menu
    .filter(item => item.active)
    .map(item => ({
      item,
      category:
        categories.find(category => category.id === item.categoryId) ?? null,
    }));
}
export function testListAdminMenu() {
  return menu;
}
export function testListMenuCategories() {
  return categories;
}
let nextCategoryId = 100;
let nextMenuItemId = 100;
export function testCreateMenuCategory(input: { name: string }) {
  const category: DemoCategory = {
    id: nextCategoryId++,
    companyId: DEMO_COMPANY_ID,
    name: input.name,
    description: null,
    sortOrder: categories.length + 1,
    active: true,
    createdAt: now(),
  };
  categories.push(category);
  return category;
}
export function testCreateMenuItem(input: {
  categoryId: number;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  active?: boolean;
  featured?: boolean;
}) {
  if (!categories.some(category => category.id === input.categoryId))
    return undefined;
  const timestamp = now();
  const item: DemoMenuItem = {
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
    updatedAt: timestamp,
  };
  menu.push(item);
  return item;
}
export function testUpdateMenuItem(
  id: number,
  input: {
    categoryId?: number;
    name?: string;
    description?: string | null;
    price?: number;
    imageUrl?: string | null;
    active?: boolean;
    featured?: boolean;
  }
) {
  const item = menu.find(value => value.id === id);
  if (!item) return undefined;
  const { price, ...rest } = input;
  Object.assign(
    item,
    rest,
    price === undefined ? {} : { price: price.toFixed(2) },
    { updatedAt: now() }
  );
  return item;
}
export function testDeleteMenuItem(id: number) {
  const index = menu.findIndex(value => value.id === id);
  if (index < 0) return false;
  menu.splice(index, 1);
  return true;
}
type DemoRecipeLine = {
  menuItemId: number;
  inventoryItemId: number;
  quantity: number;
  unit: string;
  lossPercent: number | null;
};
let recipeLines: DemoRecipeLine[] = [];
export function testListRecipeIngredients() {
  return recipeLines;
}
export function testSaveRecipe(input: {
  menuItemId: number;
  lines: Omit<DemoRecipeLine, "menuItemId">[];
}) {
  if (!menu.some(item => item.id === input.menuItemId)) return false;
  recipeLines = [
    ...recipeLines.filter(line => line.menuItemId !== input.menuItemId),
    ...input.lines.map(line => ({ ...line, menuItemId: input.menuItemId })),
  ];
  return true;
}
export function testListInventory() {
  return inventoryItems.filter(item => item.active);
}
export function testCreateInventoryItem(input: {
  name: string;
  unit: string;
  minimumQuantity: number;
  costPerUnit: number;
}) {
  const item: DemoInventoryItem = {
    id: nextInventoryItemId++,
    companyId: DEMO_COMPANY_ID,
    name: input.name,
    unit: input.unit,
    currentQuantity: "0.000",
    minimumQuantity: input.minimumQuantity.toFixed(3),
    costPerUnit: input.costPerUnit.toFixed(2),
    active: true,
    updatedAt: now(),
  };
  inventoryItems.push(item);
  return item;
}
export function testUpdateInventoryItem(input: {
  itemId: number;
  costPerUnit?: number;
  minimumQuantity?: number;
  lastSupplier?: string;
  active?: boolean;
}) {
  const item = inventoryItems.find(entry => entry.id === input.itemId);
  if (!item) return false;
  if (input.lastSupplier !== undefined)
    Object.assign(item, { lastSupplier: input.lastSupplier });
  if (input.costPerUnit !== undefined)
    item.costPerUnit = input.costPerUnit.toFixed(2);
  if (input.minimumQuantity !== undefined)
    item.minimumQuantity = input.minimumQuantity.toFixed(3);
  if (input.active !== undefined) item.active = input.active;
  return true;
}
export function testRecordInventoryMovement(input: {
  itemId: number;
  type: "in" | "out" | "adjustment";
  quantity: number;
  reason: string;
}) {
  const item = inventoryItems.find(
    value => value.id === input.itemId && value.active
  );
  if (!item) return undefined;
  const current = Number(item.currentQuantity);
  if (input.type === "out" && input.quantity > current)
    throw new Error("Estoque insuficiente para essa saída.");
  const next =
    input.type === "in"
      ? current + input.quantity
      : input.type === "out"
        ? current - input.quantity
        : input.quantity;
  item.currentQuantity = next.toFixed(3);
  item.updatedAt = now();
  inventoryMovements.unshift({
    id: nextMovementId++,
    inventoryItemId: item.id,
    type: input.type,
    quantity: input.quantity.toFixed(3),
    reason: input.reason,
    occurredAt: now(),
  });
  return item;
}
export function testListInventoryMovements(limit: number) {
  const names = new Map(inventoryItems.map(item => [item.id, item]));
  return inventoryMovements.slice(0, limit).map(movement => ({
    ...movement,
    itemName: names.get(movement.inventoryItemId)?.name ?? "Item removido",
    unit: names.get(movement.inventoryItemId)?.unit ?? "un",
  }));
}
export function testListExpenses() {
  return [...expenses].sort((a, b) => b.incurredAt.localeCompare(a.incurredAt));
}
export function testCreateExpense(input: {
  description: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
}) {
  const expense: DemoExpense = {
    id: nextExpenseId++,
    companyId: DEMO_COMPANY_ID,
    description: input.description,
    category: input.category,
    amount: input.amount.toFixed(2),
    incurredAt: `${input.date}T12:00:00`,
    notes: input.notes ?? null,
    createdAt: now(),
  };
  expenses.push(expense);
  return expense;
}
export function testFinanceReport(from: string, to: string) {
  const financeOrders = orders.map(({ order }) => ({
    id: order.id,
    createdAt: order.createdAt,
    paymentApprovedAt: order.paymentApprovedAt,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    total: order.total,
    platformFeeAmount: order.platformFeeAmount,
  }));
  const financeItems = orders.flatMap(({ items }) =>
    items.map(item => ({
      orderId: item.orderId,
      itemName: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }))
  );
  return {
    ...buildFinanceReport(from, to, financeOrders, expenses, financeItems),
    financeDateBasis: "paymentApprovedAt" as const,
  };
}
export function testListRecentOrders(limit: number) {
  return orders
    .slice(-limit)
    .reverse()
    .map(({ order, customer }) => ({ order, customer }));
}
export function testGetIntegrationsStatus() {
  return {
    mercadopago: false,
    uber_direct: false,
    lalamove: false,
    own_courier: false,
    messaging: false,
  };
}

export function testCreateCustomerOrder(input: {
  name: string;
  phone: string;
  address: string;
  addressNumber: string;
  accessToken: string;
  customerTrackingToken: string;
  paymentMethod?: string;
  pickup?: boolean;
  notes?: string;
  items: Array<{ menuItemId: number; quantity: number; observation?: string }>;
}) {
  const timestamp = now();
  let customer = customers.find(value => value.phone === input.phone);
  if (!customer) {
    customer = {
      id: nextCustomerId++,
      companyId: DEMO_COMPANY_ID,
      name: input.name,
      phone: input.phone,
      address: `${input.address.trim()}, nº ${input.addressNumber.trim()}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    customers.push(customer);
  } else {
    customer.name = input.name;
    customer.address = `${input.address.trim()}, nº ${input.addressNumber.trim()}`;
    customer.updatedAt = timestamp;
  }
  const pricedItems = input.items.map(line => {
    const item = menu.find(
      value => value.id === line.menuItemId && value.active
    );
    if (!item) throw new Error("Item indisponível");
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
  const order: DemoOrder = {
    id: orderId,
    companyId: DEMO_COMPANY_ID,
    customerId: customer.id,
    status: "received",
    paymentStatus: "pending",
    paymentMethod: input.paymentMethod ?? "pending",
    subtotal: subtotal.toFixed(2),
    deliveryFee: deliveryFee.toFixed(2),
    total: (subtotal + deliveryFee).toFixed(2),
    deliveryAddress: input.pickup
      ? PICKUP_ADDRESS
      : `${input.address.trim()}, nº ${input.addressNumber.trim()}`,
    customerAccessTokenHash: createHash("sha256")
      .update(input.accessToken)
      .digest("hex"),
    customerTrackingTokenHash: createHash("sha256")
      .update(input.customerTrackingToken)
      .digest("hex"),
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
    updatedAt: timestamp,
  };
  const items = pricedItems.map(item => ({
    id: nextOrderItemId++,
    orderId,
    menuItemId: item.menuItemId,
    itemName: item.itemName,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toFixed(2),
    observation: item.observation ?? null,
  }));
  orders.push({ order, customer, items });
  return {
    orderId,
    persisted: true as const,
    customerTrackingToken: input.customerTrackingToken,
  };
}
export function testListCustomerOrders(phone: string, accessToken: string) {
  const hash = createHash("sha256").update(accessToken).digest("hex");
  return orders
    .filter(
      value =>
        value.customer.phone === phone &&
        value.order.customerAccessTokenHash === hash
    )
    .slice(-20)
    .reverse()
    .map(({ order, customer }) => ({ order, customer }));
}
export function testGetOrderById(id: number, accessToken?: string) {
  const hash = accessToken
    ? createHash("sha256").update(accessToken).digest("hex")
    : null;
  const found = orders.find(
    value =>
      value.order.id === id &&
      (!accessToken ||
        Boolean(hash && value.order.customerAccessTokenHash === hash))
  );
  return found
    ? { order: found.order, customer: found.customer, items: found.items }
    : undefined;
}
export function testAdvanceOrderStatus(orderId: number, status: string) {
  const found = orders.find(value => value.order.id === orderId);
  if (!found) return { orderId, status, persisted: false as const };
  found.order.status = status;
  found.order.updatedAt = now();
  return { orderId, status, persisted: true as const };
}
export function testSetOrderDelivery(
  orderId: number,
  input: { trackingUrl?: string | null; externalDeliveryId?: string | null }
) {
  const found = orders.find(value => value.order.id === orderId);
  if (found) Object.assign(found.order, input, { updatedAt: now() });
}
export function testIssueDriverTrackingToken(
  orderId: number,
  tokenHash: string
) {
  const found = orders.find(value => value.order.id === orderId);
  if (!found || !["ready", "out_for_delivery"].includes(found.order.status))
    return false;
  found.order.driverTrackingTokenHash = tokenHash;
  return true;
}
export function testUpdateDriverLocation(
  tokenHash: string,
  latitude: number,
  longitude: number
) {
  const found = orders.find(
    value =>
      value.order.driverTrackingTokenHash === tokenHash &&
      ["ready", "out_for_delivery"].includes(value.order.status)
  );
  if (!found) return false;
  Object.assign(found.order, {
    status: "out_for_delivery",
    trackingLatitude: String(latitude),
    trackingLongitude: String(longitude),
    trackingUpdatedAt: now(),
  });
  return true;
}
export function testGetCustomerTracking(tokenHash: string) {
  const found = orders.find(
    value => value.order.customerTrackingTokenHash === tokenHash
  );
  if (!found) return undefined;
  return {
    orderId: found.order.id,
    companyName: "Marmitaria Demo",
    status: found.order.status,
    paymentStatus: found.order.paymentStatus,
    paymentMethod: found.order.paymentMethod,
    pickup: isPickupOrder(found.order),
    trackingUrl: found.order.trackingUrl,
    location:
      found.order.trackingLatitude && found.order.trackingLongitude
        ? {
            latitude: Number(found.order.trackingLatitude),
            longitude: Number(found.order.trackingLongitude),
            updatedAt: found.order.trackingUpdatedAt ?? null,
          }
        : null,
    deliveryCode: null,
  };
}
export function testGetDriverTrackingInfo(tokenHash: string) {
  const found = orders.find(
    value => value.order.driverTrackingTokenHash === tokenHash
  );
  if (!found) return undefined;
  return {
    orderId: found.order.id,
    companyName: "Marmitaria Demo",
    customerName: found.customer.name,
    customerPhone: found.customer.phone,
    address: found.order.deliveryAddress ?? "",
    status: found.order.status,
    location:
      found.order.trackingLatitude && found.order.trackingLongitude
        ? {
            latitude: Number(found.order.trackingLatitude),
            longitude: Number(found.order.trackingLongitude),
            updatedAt: found.order.trackingUpdatedAt ?? null,
          }
        : null,
  };
}
export function testConfirmDriverDelivery(tokenHash: string, code: string) {
  const found = orders.find(
    value =>
      value.order.driverTrackingTokenHash === tokenHash &&
      value.order.status === "out_for_delivery"
  );
  if (!found || found.customer.phone.replace(/\D/g, "").slice(-4) !== code)
    return false;
  Object.assign(found.order, {
    status: "delivered",
    driverTrackingTokenHash: null,
    updatedAt: now(),
  });
  return true;
}
export function testSetOrderPayment(
  orderId: number,
  input: {
    paymentStatus: DemoOrder["paymentStatus"];
    externalPaymentId?: string | null;
    platformFeeAmount?: string | null;
  }
) {
  const found = orders.find(value => value.order.id === orderId);
  if (found)
    Object.assign(found.order, input, {
      paymentApprovedAt:
        input.paymentStatus === "approved"
          ? (found.order.paymentApprovedAt ?? now())
          : found.order.paymentApprovedAt,
      updatedAt: now(),
    });
}
export function testDashboardSummary() {
  const approved = orders.filter(
    value => value.order.paymentStatus === "approved"
  );
  const revenue = approved.reduce(
    (sum, value) => sum + Number(value.order.total),
    0
  );
  return {
    revenue,
    orders: approved.length,
    averageTicket: approved.length ? revenue / approved.length : 0,
  };
}
export function testFindOrderByExternalPaymentId(externalPaymentId: string) {
  return orders.find(
    value => value.order.externalPaymentId === externalPaymentId
  )?.order;
}

type DemoWhatsappBot = {
  companyId: number;
  desired: string;
  status: string;
  qr: string | null;
  phone: string | null;
  error: string | null;
  aiEnabled: boolean;
  instructions: string | null;
  heartbeatAt: string | null;
  updatedAt: string;
};
let whatsappBot: DemoWhatsappBot | undefined;
const blankBot = (): DemoWhatsappBot => ({
  companyId: DEMO_COMPANY_ID,
  desired: "disconnected",
  status: "idle",
  qr: null,
  phone: null,
  error: null,
  aiEnabled: true,
  instructions: null,
  heartbeatAt: null,
  updatedAt: now(),
});
export function testGetWhatsappBot() {
  return whatsappBot;
}
export function testPatchWhatsappBot(patch: Partial<DemoWhatsappBot>) {
  whatsappBot = { ...(whatsappBot ?? blankBot()), ...patch, updatedAt: now() };
  return whatsappBot;
}
