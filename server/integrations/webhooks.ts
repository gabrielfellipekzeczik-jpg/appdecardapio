import type { Express, Request, Response } from "express";
import { getCompanyById } from "../companies";
import { findOrderByExternalPaymentId, saveIntegrationCredentials, setOrderPayment } from "../db";
import { decodeState, exchangeCodeForCredentials, getPaymentStatus } from "./mercadoPago";

const MP_STATUS_MAP: Record<string, "pending" | "approved" | "rejected" | "refunded"> = {
  pending: "pending",
  in_process: "pending",
  authorized: "pending",
  approved: "approved",
  rejected: "rejected",
  cancelled: "rejected",
  refunded: "refunded",
  charged_back: "refunded",
};

export function registerWebhooks(app: Express) {
  // MP redirects the browser here after the company admin authorizes on
  // Mercado Pago's own site; `state` was minted by `integrations.mercadoPagoConnectUrl`.
  app.get("/api/mercadopago/oauth-callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    if (!code || !state) {
      res.status(400).send("Código de autorização ausente.");
      return;
    }
    let companyId: number;
    try {
      ({ companyId } = decodeState(state));
    } catch {
      res.status(400).send("Estado da autorização inválido.");
      return;
    }
    const company = await getCompanyById(companyId);
    const redirectBase = company ? `/${company.slug}/admin/integracoes` : "/admin-login";
    try {
      const credentials = await exchangeCodeForCredentials(code);
      await saveIntegrationCredentials(companyId, "mercadopago", credentials, { publicKey: credentials.publicKey, userId: credentials.userId, liveMode: credentials.liveMode });
      res.redirect(302, `${redirectBase}?mercadopago=connected`);
    } catch (error) {
      console.error("[MercadoPago] OAuth callback failed:", error);
      res.redirect(302, `${redirectBase}?mercadopago=error`);
    }
  });

  // Mercado Pago notifies here on payment status changes. `companyId` was
  // attached to the notification_url at payment creation time (each company
  // has its own connected seller account, so we need it to know whose
  // credentials to use). We treat the notification only as a pointer to
  // re-fetch authoritative status from the Payments API — never trust status
  // fields in the webhook body itself.
  app.post("/api/webhooks/mercadopago", async (req: Request, res: Response) => {
    res.status(200).send("ok"); // ack immediately; MP retries on non-2xx
    try {
      const companyId = Number(req.query.companyId);
      const paymentId = req.body?.data?.id ?? req.query["data.id"];
      if (!companyId || !paymentId) return;
      const payment = await getPaymentStatus(companyId, String(paymentId));
      const orderId = payment.external_reference ? Number(payment.external_reference) : undefined;
      if (!orderId) return;
      const order = await findOrderByExternalPaymentId(companyId, String(paymentId));
      const mappedStatus = MP_STATUS_MAP[payment.status] ?? "pending";
      if (!order || order.paymentStatus !== mappedStatus) {
        await setOrderPayment(orderId, { paymentStatus: mappedStatus, externalPaymentId: String(paymentId) });
      }
    } catch (error) {
      console.error("[MercadoPago] Webhook processing failed:", error);
    }
  });

  // Uber Direct / Lalamove notify delivery status changes (courier assigned,
  // picked up, delivered). Lower stakes than payments, so we just log for now
  // — the tracking URL already lets the customer follow the courier directly.
  app.post("/api/webhooks/uber-direct", (req: Request, res: Response) => {
    res.status(200).send("ok");
    console.log("[UberDirect] Webhook received:", req.body?.status ?? "unknown status");
  });

  app.post("/api/webhooks/lalamove", (req: Request, res: Response) => {
    res.status(200).send("ok");
    console.log("[Lalamove] Webhook received:", req.body?.status ?? "unknown status");
  });
}
