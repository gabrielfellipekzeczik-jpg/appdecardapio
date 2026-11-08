// Pedido pelo WhatsApp: o Gemini só coleta os dados; preços, taxa, link e status vêm do app.
// Módulo puro (sem Baileys/Supabase) para ser testável.

export type CatalogEntry = { id: number; name: string; price: number };

export type OrderRequest = {
  items: { name: string; quantity: number; note?: string }[];
  fulfillment: "delivery" | "pickup";
  /** CEP ou endereço completo, como o cliente escreveu. */
  address: string;
  number: string;
  complement: string;
  customerName: string;
  payment: "link" | "cash";
};

export type QuotedOrder = {
  request: OrderRequest;
  items: { menuItemId: number; name: string; quantity: number; note: string }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  address: string | null;
};

const normalize = (text: string) =>
  text
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Acha o item do cardápio pelo nome que o cliente usou. Ambíguo ou desconhecido = null. */
export function matchCatalogItem(name: string, catalog: CatalogEntry[]) {
  const wanted = normalize(name);
  if (!wanted) return null;
  const exact = catalog.filter(item => normalize(item.name) === wanted);
  if (exact.length === 1) return exact[0];
  const partial = catalog.filter(item => {
    const candidate = normalize(item.name);
    return candidate.includes(wanted) || wanted.includes(candidate);
  });
  return partial.length === 1 ? partial[0] : null;
}

/** Converte o pedido do Gemini em itens do cardápio. Devolve os nomes que não deram para identificar. */
export function resolveItems(request: OrderRequest, catalog: CatalogEntry[]) {
  const unknown: string[] = [];
  const items: QuotedOrder["items"] = [];
  for (const entry of request.items) {
    const match = matchCatalogItem(entry.name, catalog);
    const quantity = Math.max(1, Math.min(50, Math.round(entry.quantity) || 1));
    if (!match) unknown.push(entry.name);
    else
      items.push({
        menuItemId: match.id,
        name: match.name,
        quantity,
        note: (entry.note ?? "").slice(0, 300),
      });
  }
  return { items, unknown };
}

/** Telefone do WhatsApp sem o 55, como o checkout grava. */
export function phoneFromJid(jid: string | null | undefined) {
  if (!jid || !jid.endsWith("@s.whatsapp.net")) return null;
  const digits = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
  return digits.length >= 12 && digits.startsWith("55") ? digits.slice(2) : digits;
}

const money = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

export function quoteMessage(order: QuotedOrder) {
  const lines = order.items.map(
    item => `${item.quantity}x ${item.name}${item.note ? ` (${item.note})` : ""}`
  );
  const where =
    order.request.fulfillment === "pickup"
      ? "Retirada na loja"
      : `Entrega em: ${order.address ?? order.request.address}, ${order.request.number}${order.request.complement ? `, ${order.request.complement}` : ""}`;
  const payment =
    order.request.payment === "cash"
      ? "Pagamento na entrega"
      : "Pagamento por link (Pix ou cartão)";
  return [
    "Confere o pedido:",
    ...lines,
    where,
    `Subtotal: ${money(order.subtotal)}`,
    ...(order.deliveryFee > 0 ? [`Entrega: ${money(order.deliveryFee)}`] : []),
    `Total: ${money(order.total)}`,
    payment,
    "",
    "Posso confirmar?",
  ].join("\n");
}

export function createdMessage(input: {
  orderId: number;
  total: number;
  paymentLink: string | null;
  trackingUrl: string | null;
  payment: "link" | "cash";
}) {
  return [
    `Pedido #${input.orderId} registrado, total ${money(input.total)}.`,
    input.payment === "link" && input.paymentLink
      ? `Pague por aqui (Pix ou cartão): ${input.paymentLink}\nAssim que o pagamento cair, a cozinha começa.`
      : "O pagamento é feito na entrega.",
    ...(input.trackingUrl ? [`Acompanhe: ${input.trackingUrl}`] : []),
  ].join("\n");
}

const STATUS_TEXT: Record<string, string> = {
  received: "recebido",
  preparing: "em preparo",
  ready: "pronto",
  out_for_delivery: "saiu para entrega",
  delivered: "entregue",
  cancelled: "cancelado",
};

export function statusMessage(
  orders: { id: number; status: string; paymentStatus: string; paymentMethod: string | null }[]
) {
  if (!orders.length)
    return "Não encontrei pedidos neste número. Se pediu por outro telefone, me diga qual.";
  const [latest] = orders;
  const waitingPayment =
    latest.paymentStatus !== "approved" &&
    latest.paymentMethod !== "cash_on_delivery" &&
    latest.status !== "cancelled";
  return waitingPayment
    ? `Seu pedido #${latest.id} está aguardando o pagamento. Assim que ele cair, a cozinha começa.`
    : `Seu pedido #${latest.id} está ${STATUS_TEXT[latest.status] ?? latest.status}.`;
}
