type DemoCategory = { id: number; companyId: number; name: string; description: string | null; sortOrder: number; active: boolean; createdAt: string };
type DemoMenuItem = { id: number; companyId: number; categoryId: number; name: string; description: string | null; price: string; imageUrl: string | null; active: boolean; featured: boolean; createdAt: string; updatedAt: string };
type DemoCustomer = { id: number; companyId: number; name: string; phone: string; address: string | null; createdAt: string; updatedAt: string };
type DemoOrderItem = { id: number; orderId: number; menuItemId: number; itemName: string; quantity: number; unitPrice: string; observation: string | null };
type DemoOrder = { id: number; companyId: number; customerId: number; status: string; paymentStatus: "pending" | "approved" | "rejected" | "refunded"; paymentMethod: string | null; subtotal: string; deliveryFee: string; total: string; platformFeeAmount: string | null; notes: string | null; trackingUrl: string | null; externalPaymentId: string | null; externalDeliveryId: string | null; createdAt: string; updatedAt: string };

const DEMO_COMPANY_ID = -1;
const now = () => new Date().toISOString();
const categories: DemoCategory[] = [
  { id: 1, companyId: DEMO_COMPANY_ID, name: "Mais pedidos", description: null, sortOrder: 1, active: true, createdAt: now() },
  { id: 2, companyId: DEMO_COMPANY_ID, name: "Leves & fit", description: null, sortOrder: 2, active: true, createdAt: now() },
  { id: 3, companyId: DEMO_COMPANY_ID, name: "Especiais", description: null, sortOrder: 3, active: true, createdAt: now() },
];
const menu: DemoMenuItem[] = [
  { id: 1, companyId: DEMO_COMPANY_ID, categoryId: 1, name: "Caseira da semana", description: "Arroz soltinho, feijão cremoso, frango grelhado, purê de batata e salada fresca.", price: "24.90", imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85", active: true, featured: true, createdAt: now(), updatedAt: now() },
  { id: 2, companyId: DEMO_COMPANY_ID, categoryId: 1, name: "Bife acebolado", description: "Bife macio na chapa, arroz, feijão, farofa crocante e vinagrete da casa.", price: "28.90", imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=85", active: true, featured: true, createdAt: now(), updatedAt: now() },
  { id: 3, companyId: DEMO_COMPANY_ID, categoryId: 2, name: "Frango tropical", description: "Frango ao molho de laranja, arroz integral, legumes tostados e folhas.", price: "26.90", imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85", active: true, featured: false, createdAt: now(), updatedAt: now() },
  { id: 4, companyId: DEMO_COMPANY_ID, categoryId: 2, name: "Bowl da horta", description: "Quinoa, grão-de-bico, abóbora assada, avocado e molho de ervas.", price: "25.90", imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85", active: true, featured: false, createdAt: now(), updatedAt: now() },
  { id: 5, companyId: DEMO_COMPANY_ID, categoryId: 3, name: "Parmegiana de domingo", description: "Frango empanado, molho de tomate assado, queijo gratinado e batatas rústicas.", price: "32.90", imageUrl: "https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?auto=format&fit=crop&w=900&q=85", active: true, featured: true, createdAt: now(), updatedAt: now() },
];
const customers: DemoCustomer[] = [];
const orders: Array<{ order: DemoOrder; customer: DemoCustomer; items: DemoOrderItem[] }> = [];
let nextCustomerId = 1;
let nextOrderId = 2000;
let nextOrderItemId = 1;

export function testListActiveMenu() { return menu.filter(item => item.active).map(item => ({ item, category: categories.find(category => category.id === item.categoryId) ?? null })); }
export function testListAdminMenu() { return menu; }
export function testListInventory() { return []; }
export function testListExpenses() { return []; }
export function testListRecentOrders(limit: number) { return orders.slice(-limit).reverse().map(({ order, customer }) => ({ order, customer })); }
export function testGetIntegrationsStatus() { return { mercadopago: false, uber_direct: false, lalamove: false, own_courier: false, messaging: false }; }

export function testCreateCustomerOrder(input: { name: string; phone: string; address: string; paymentMethod?: string; subtotal: number; deliveryFee: number; total: number; notes?: string; items: Array<{ menuItemId: number; itemName: string; quantity: number; unitPrice: number; observation?: string }> }) {
  const timestamp = now();
  let customer = customers.find(value => value.phone === input.phone);
  if (!customer) {
    customer = { id: nextCustomerId++, companyId: DEMO_COMPANY_ID, name: input.name, phone: input.phone, address: input.address, createdAt: timestamp, updatedAt: timestamp };
    customers.push(customer);
  } else {
    customer.name = input.name;
    customer.address = input.address;
    customer.updatedAt = timestamp;
  }
  const orderId = nextOrderId++;
  const order: DemoOrder = { id: orderId, companyId: DEMO_COMPANY_ID, customerId: customer.id, status: "received", paymentStatus: "pending", paymentMethod: input.paymentMethod ?? "pending", subtotal: input.subtotal.toFixed(2), deliveryFee: input.deliveryFee.toFixed(2), total: input.total.toFixed(2), platformFeeAmount: null, notes: input.notes ?? null, trackingUrl: null, externalPaymentId: null, externalDeliveryId: null, createdAt: timestamp, updatedAt: timestamp };
  const items = input.items.map(item => ({ id: nextOrderItemId++, orderId, menuItemId: item.menuItemId, itemName: item.itemName, quantity: item.quantity, unitPrice: item.unitPrice.toFixed(2), observation: item.observation ?? null }));
  orders.push({ order, customer, items });
  return { orderId, persisted: true as const };
}
export function testListCustomerOrders(phone: string) { return orders.filter(value => value.customer.phone === phone).slice(-20).reverse().map(({ order, customer }) => ({ order, customer })); }
export function testGetOrderById(id: number) { const found = orders.find(value => value.order.id === id); return found ? { order: found.order, customer: found.customer, items: found.items } : undefined; }
export function testAdvanceOrderStatus(orderId: number, status: string) { const found = orders.find(value => value.order.id === orderId); if (!found) return { orderId, status, persisted: false as const }; found.order.status = status; found.order.updatedAt = now(); return { orderId, status, persisted: true as const }; }
export function testSetOrderDelivery(orderId: number, input: { trackingUrl?: string | null; externalDeliveryId?: string | null }) { const found = orders.find(value => value.order.id === orderId); if (found) Object.assign(found.order, input, { updatedAt: now() }); }
export function testSetOrderPayment(orderId: number, input: { paymentStatus: DemoOrder["paymentStatus"]; externalPaymentId?: string | null; platformFeeAmount?: string | null }) { const found = orders.find(value => value.order.id === orderId); if (found) Object.assign(found.order, input, { updatedAt: now() }); }
export function testDashboardSummary() { const approved = orders.filter(value => value.order.paymentStatus === "approved"); const revenue = approved.reduce((sum, value) => sum + Number(value.order.total), 0); return { revenue, orders: approved.length, averageTicket: approved.length ? revenue / approved.length : 0 }; }
export function testFindOrderByExternalPaymentId(externalPaymentId: string) { return orders.find(value => value.order.externalPaymentId === externalPaymentId)?.order; }
