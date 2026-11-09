export type FinanceOrderRow = { id: number; createdAt: string; paymentApprovedAt?: string | null; paymentStatus: string; paymentMethod: string | null; total: number | string; platformFeeAmount?: number | string | null };
export type FinanceExpenseRow = { id: number; description: string; category: string; amount: number | string; incurredAt: string; notes?: string | null };
export type FinanceOrderItemRow = { orderId: number; itemName: string; quantity: number; unitPrice: number | string };

const amount = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const brazilDay = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value.slice(0, 10);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (key: string) => parts.find((part) => part.type === key)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const dayLabel = (key: string, monthly: boolean) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...(monthly ? { month: "short", year: "2-digit" } : { day: "2-digit", month: "short" }) }).format(new Date(`${monthly ? `${key}-01` : key}T12:00:00-03:00`));
const PAYMENT_LABELS: Record<string, string> = { pix: "Pix", credit_card: "Cartão de crédito", debit_card: "Cartão de débito", cash_on_delivery: "Dinheiro na entrega", mercadopago_link: "Link Mercado Pago", manual: "Manual", pending: "A definir" };

export function buildFinanceReport(from: string, to: string, sourceOrders: FinanceOrderRow[], sourceExpenses: FinanceExpenseRow[], items: FinanceOrderItemRow[]) {
  const orders = sourceOrders.filter((order) => { const key = brazilDay(order.paymentApprovedAt || order.createdAt); return key >= from && key <= to; });
  const expenses = sourceExpenses.filter((expense) => { const key = brazilDay(expense.incurredAt); return key >= from && key <= to; });
  const approved = orders.filter((order) => order.paymentStatus === "approved");
  const pending = orders.filter((order) => order.paymentStatus === "pending");
  // A taxa de serviço é paga pelo cliente e vai para a plataforma: não é receita da loja.
  const revenue = approved.reduce((sum, order) => sum + amount(order.total) - amount(order.platformFeeAmount), 0);
  const expensesTotal = expenses.reduce((sum, expense) => sum + amount(expense.amount), 0);
  const pendingRevenue = pending.reduce((sum, order) => sum + amount(order.total) - amount(order.platformFeeAmount), 0);
  const platformFees = approved.reduce((sum, order) => sum + amount(order.platformFeeAmount), 0);
  const days = Math.max(1, Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1);
  const monthly = days > 90;
  const bucket = (date: string) => { const key = brazilDay(date); return monthly ? key.slice(0, 7) : key; };
  const buckets = new Map<string, { date: string; label: string; revenue: number; expenses: number; orders: number }>();
  if (monthly) {
    let cursor = new Date(`${from.slice(0, 7)}-01T12:00:00Z`);
    const last = `${to.slice(0, 7)}-01`;
    while (cursor.toISOString().slice(0, 10) <= last) {
      const key = cursor.toISOString().slice(0, 7);
      buckets.set(key, { date: key, label: dayLabel(key, true), revenue: 0, expenses: 0, orders: 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  } else {
    let cursor = new Date(`${from}T12:00:00Z`);
    const last = Date.parse(`${to}T12:00:00Z`);
    while (cursor.getTime() <= last) {
      const key = cursor.toISOString().slice(0, 10);
      buckets.set(key, { date: key, label: dayLabel(key, false), revenue: 0, expenses: 0, orders: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  for (const order of approved) { const point = buckets.get(bucket(order.paymentApprovedAt || order.createdAt)); if (point) { point.revenue += amount(order.total) - amount(order.platformFeeAmount); point.orders += 1; } }
  for (const expense of expenses) { const point = buckets.get(bucket(expense.incurredAt)); if (point) point.expenses += amount(expense.amount); }
  const categories = new Map<string, { name: string; value: number; count: number }>();
  for (const expense of expenses) { const name = expense.category?.trim() || "Outros"; const value = categories.get(name) ?? { name, value: 0, count: 0 }; value.value += amount(expense.amount); value.count += 1; categories.set(name, value); }
  const methods = new Map<string, { name: string; revenue: number; count: number }>();
  for (const order of approved) { const key = order.paymentMethod || "pending"; const name = PAYMENT_LABELS[key] ?? key.replaceAll("_", " "); const value = methods.get(name) ?? { name, revenue: 0, count: 0 }; value.revenue += amount(order.total) - amount(order.platformFeeAmount); value.count += 1; methods.set(name, value); }
  const paidIds = new Set(approved.map((order) => order.id));
  const products = new Map<string, { name: string; units: number; revenue: number }>();
  for (const item of items) { if (!paidIds.has(item.orderId)) continue; const value = products.get(item.itemName) ?? { name: item.itemName, units: 0, revenue: 0 }; value.units += item.quantity; value.revenue += item.quantity * amount(item.unitPrice); products.set(item.itemName, value); }
  return {
    from, to, monthly,
    summary: { revenue, expenses: expensesTotal, operatingBalance: revenue - expensesTotal, approvedOrders: approved.length, averageTicket: approved.length ? revenue / approved.length : 0, pendingRevenue, pendingOrders: pending.length, platformFees, marginPercent: revenue ? ((revenue - expensesTotal) / revenue) * 100 : 0 },
    timeline: Array.from(buckets.values()).map((point) => ({ ...point, balance: point.revenue - point.expenses })),
    expenseCategories: Array.from(categories.values()).sort((a, b) => b.value - a.value),
    paymentMethods: Array.from(methods.values()).sort((a, b) => b.revenue - a.revenue),
    topProducts: Array.from(products.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    recentExpenses: [...expenses].sort((a, b) => b.incurredAt.localeCompare(a.incurredAt)).slice(0, 20),
  };
}
