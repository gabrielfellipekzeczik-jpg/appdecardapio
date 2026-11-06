// Avisos ao cliente sobre o pedido: WhatsApp (enviado pelo serviço /bot) e e-mail (Resend).
// Nunca lança erro: falha de aviso não pode derrubar pagamento nem troca de status.
import { ENV } from "./_core/env";
import {
  claimNotification,
  finishNotification,
  getNotificationContext,
} from "./db";

export type OrderEvent =
  | "paid"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered";

/** Ordem do fluxo; só avisamos quando o pedido AVANÇA (voltar status não manda mensagem). */
const RANK: Record<string, number> = {
  received: 0,
  preparing: 1,
  ready: 2,
  out_for_delivery: 3,
  delivered: 4,
};
export function isForwardMove(from: string | undefined, to: string) {
  return (RANK[to] ?? -1) > (RANK[from ?? "received"] ?? 0);
}
export function eventForStatus(status: string): OrderEvent | null {
  return status === "preparing" ||
    status === "ready" ||
    status === "out_for_delivery" ||
    status === "delivered"
    ? status
    : null;
}

/** Telefone BR -> dígitos com DDI (55). Retorna null se não parecer um celular/fixo válido. */
export function normalizeBrPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55\d{10,11}$/.test(digits)) return null;
  return digits;
}

function messageFor(
  event: OrderEvent,
  ctx: {
    companyName: string;
    customerName: string;
    orderId: number;
    pickup: boolean;
    cash: boolean;
  },
  link: string | null,
  ordersLink: string | null = null
) {
  const first = ctx.customerName.trim().split(/\s+/)[0];
  const hi = first ? `Olá, ${first}!` : "Olá!";
  const head = `${ctx.companyName} · Pedido #${ctx.orderId}`;
  const tail =
    (link ? `\n\nAcompanhe aqui: ${link}` : "") +
    (ordersLink
      ? `\nVer todos os seus pedidos (entre só com seu e-mail): ${ordersLink}`
      : "");
  switch (event) {
    case "paid":
      return {
        subject: `Pedido #${ctx.orderId} confirmado — ${ctx.companyName}`,
        text: `${hi} ✅ ${ctx.cash ? `Recebemos seu pedido! O pagamento é feito na ${ctx.pickup ? "retirada" : "entrega"}.` : "Pagamento confirmado! Recebemos seu pedido."}\n${head}${tail}`,
      };
    case "preparing":
      return {
        subject: `Seu pedido #${ctx.orderId} está em preparo`,
        text: `${hi} 👩‍🍳 Seu pedido já está em preparo.\n${head}${tail}`,
      };
    case "ready":
      return {
        subject: `Seu pedido #${ctx.orderId} está pronto`,
        text: `${hi} 📦 ${ctx.pickup ? "Seu pedido está pronto para retirada." : "Seu pedido está pronto e aguardando o entregador."}\n${head}${tail}`,
      };
    case "out_for_delivery":
      return {
        subject: `Seu pedido #${ctx.orderId} saiu para entrega`,
        text: `${hi} 🛵 Seu pedido saiu para entrega! Acompanhe o motoboy no mapa.\n${head}${tail}`,
      };
    case "delivered":
      return {
        subject: `Pedido #${ctx.orderId} entregue`,
        text: `${hi} 🎉 Pedido entregue. Bom apetite!\n${head}`,
      };
  }
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!ENV.resendApiKey || !ENV.emailFrom) return { ok: false, error: "e-mail não configurado" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${ENV.resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.emailFrom,
      to: [to],
      subject,
      text,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    return { ok: false, error: `Resend ${response.status}: ${detail}` };
  }
  return { ok: true as const };
}

export async function notifyOrderEvent(orderId: number, event: OrderEvent) {
  try {
    const ctx = await getNotificationContext(orderId);
    if (!ctx) return;
    const base = ENV.publicAppUrl;
    const link =
      base && ctx.trackingToken
        ? `${base}/rastrear/${encodeURIComponent(ctx.companySlug)}/${ctx.trackingToken}`
        : base
          ? `${base}/${encodeURIComponent(ctx.companySlug)}/pedidos`
          : null;
    const ordersLink = base
      ? `${base}/${encodeURIComponent(ctx.companySlug)}/pedidos`
      : null;
    const { subject, text } = messageFor(event, ctx, link, ordersLink)!;

    // WhatsApp: fica "pending" na fila; o serviço /bot envia com pausas anti-banimento.
    const phone = normalizeBrPhone(ctx.phone);
    if (phone && ctx.botConnected) {
      await claimNotification({
        companyId: ctx.companyId,
        orderId,
        event,
        channel: "whatsapp",
        recipient: phone,
        message: text,
      });
    }

    // E-mail: enviado agora (apenas se o Resend estiver configurado).
    if (ctx.email && ENV.resendApiKey && ENV.emailFrom) {
      const id = await claimNotification({
        companyId: ctx.companyId,
        orderId,
        event,
        channel: "email",
        recipient: ctx.email,
        message: text,
      });
      if (id) {
        const result = await sendEmail(ctx.email, subject, text);
        await finishNotification(id, result.ok ? "sent" : "failed", result.ok ? undefined : result.error);
        if (!result.ok) console.error("[notifications] e-mail falhou:", result.error);
      }
    }
  } catch (error) {
    console.error("[notifications] erro:", error instanceof Error ? error.message : error);
  }
}
