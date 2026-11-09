// Fala com o app (Vercel) para calcular e registrar pedidos com as mesmas regras do checkout.

type OrderItem = { menuItemId: number; quantity: number; observation?: string };
type BaseOrder = {
  companyId: number;
  items: OrderItem[];
  fulfillment: "delivery" | "pickup";
  address: string;
  addressNumber: string;
  complement: string;
  /** Define se a taxa de serviço (pagamento online) entra no total. */
  paymentMode?: "mercadopago_link" | "cash_on_delivery";
};

export class AppClient {
  constructor(private appUrl: string, private botKey: string) {}

  private async call<T>(procedure: string, input: unknown): Promise<T> {
    const response = await fetch(`${this.appUrl}/api/trpc/${procedure}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bot-key": this.botKey },
      body: JSON.stringify({ json: input }),
      signal: AbortSignal.timeout(25_000),
    });
    const payload = (await response.json().catch(() => null)) as
      | { result?: { data?: { json?: T } }; error?: { json?: { message?: string } } }
      | null;
    if (!response.ok || !payload?.result?.data)
      throw new Error(payload?.error?.json?.message ?? `O app respondeu ${response.status}.`);
    return payload.result.data.json as T;
  }

  quote(input: BaseOrder) {
    return this.call<{ subtotal: number; deliveryFee: number; serviceFee?: number; total: number; address: string | null }>("bot.quote", input);
  }

  createOrder(input: BaseOrder & { name: string; phone: string; paymentMode: "mercadopago_link" | "cash_on_delivery" }) {
    return this.call<{ orderId: number; total: number; deliveryFee: number; paymentLink: string | null; trackingUrl: string | null }>("bot.createOrder", input);
  }
}
