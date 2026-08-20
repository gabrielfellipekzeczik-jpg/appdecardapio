import type { Express, Request, Response } from "express";
import { findOrderByExternalPaymentId, setOrderPayment } from "../db";
import { buildAuthorizeUrl, exchangeCodeForCredentials, getPaymentStatus, isMercadoPagoConfigured, saveCredentials } from "./mercadoPago";

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
  // Admin clicks "Conectar com Mercado Pago" in Super Admin, which links here.
  app.get("/api/mercadopago/connect", (req: Request, res: Response) => {
    if (!isMercadoPagoConfigured()) {
      res.status(500).send("Mercado Pago não está configurado (MP_CLIENT_ID/MP_CLIENT_SECRET/MP_REDIRECT_URI ausentes).");
      return;
    }
    const state = Math.random().toString(36).slice(2);
    res.redirect(302, buildAuthorizeUrl(state));
  });

  app.get("/api/mercadopago/oauth-callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    if (!code) {
      res.status(400).send("Código de autorização ausente.");
      return;
    }
    try {
      const credentials = await exchangeCodeForCredentials(code);
      await saveCredentials(credentials);
      res.redirect(302, "/super-admin?mercadopago=connected");
    } catch (error) {
      console.error("[MercadoPago] OAuth callback failed:", error);
      res.redirect(302, "/super-admin?mercadopago=error");
    }
  });

  // Mercado Pago notifies here on payment status changes. We treat the
  // notification only as a pointer to re-fetch authoritative status from
  // the Payments API — never trust status fields in the webhook body itself.
  app.post("/api/webhooks/mercadopago", async (req: Request, res: Response) => {
    res.status(200).send("ok"); // ack immediately; MP retries on non-2xx
    try {
      const paymentId = req.body?.data?.id ?? req.query["data.id"];
      if (!paymentId) return;
      const payment = await getPaymentStatus(String(paymentId));
      const orderId = payment.external_reference ? Number(payment.external_reference) : undefined;
      if (!orderId) return;
      const order = await findOrderByExternalPaymentId(String(paymentId));
      const mappedStatus = MP_STATUS_MAP[payment.status] ?? "pending";
      if (!order || order.paymentStatus !== mappedStatus) {
        await setOrderPayment(orderId, { paymentStatus: mappedStatus, externalPaymentId: String(paymentId) });
      }
    } catch (error) {
      console.error("[MercadoPago] Webhook processing failed:", error);
    }
  });

  // Uber Direct notifies delivery status changes (courier assigned, picked
  // up, delivered). Lower stakes than payments, so we apply the payload directly.
  app.post("/api/webhooks/uber-direct", async (req: Request, res: Response) => {
    res.status(200).send("ok");
    console.log("[UberDirect] Webhook received:", req.body?.status ?? "unknown status");
    // Delivery status is informational for the kitchen view; the tracking
    // URL already lets the customer follow the courier directly on Uber's page.
  });
}
