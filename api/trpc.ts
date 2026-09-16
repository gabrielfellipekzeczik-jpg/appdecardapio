// api/trpc.ts — Vercel Serverless Function
// Serve todas as chamadas tRPC que antes iam para o Express.
// Substitui server/_core/index.ts + Express sem nenhuma mudança no frontend.

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import type { IncomingMessage, ServerResponse } from "node:http";

// Handler de OAuth callback do Mercado Pago (antes era Express route em webhooks.ts)
async function handleMercadoPagoCallback(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "", `https://${req.headers.host}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    res.writeHead(400).end("Código de autorização ausente.");
    return;
  }

  let companyId: number;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64").toString("utf-8")) as { companyId: number };
    if (!Number.isInteger(parsed.companyId)) throw new Error("Invalid state");
    companyId = parsed.companyId;
  } catch {
    res.writeHead(400).end("Estado da autorização inválido.");
    return;
  }

  const { getCompanyById } = await import("../server/companies");
  const { saveIntegrationCredentials } = await import("../server/db");
  const company = await getCompanyById(companyId);
  const redirectBase = company ? `/${company.slug}/admin/integracoes` : "/admin-login";

  try {
    const clientId = process.env.MP_CLIENT_ID ?? "";
    const clientSecret = process.env.MP_CLIENT_SECRET ?? "";
    const redirectUri = process.env.MP_REDIRECT_URI ?? "";

    const tokenResp = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.text().catch(() => "");
      throw new Error(`MP token exchange failed (${tokenResp.status}): ${err}`);
    }

    const data = (await tokenResp.json()) as {
      access_token: string; refresh_token: string; public_key: string; user_id: number; live_mode: boolean;
    };

    await saveIntegrationCredentials(companyId, "mercadopago",
      { accessToken: data.access_token, refreshToken: data.refresh_token, publicKey: data.public_key, userId: data.user_id, liveMode: data.live_mode },
      { publicKey: data.public_key, userId: data.user_id, liveMode: data.live_mode }
    );

    res.writeHead(302, { Location: `${redirectBase}?mercadopago=connected` }).end();
  } catch (error) {
    console.error("[MercadoPago] OAuth callback failed:", error);
    res.writeHead(302, { Location: `${redirectBase}?mercadopago=error` }).end();
  }
}

// Handler de webhook do Mercado Pago (notificações de pagamento)
async function handleMercadoPagoWebhook(req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200).end("ok"); // ack imediato

  try {
    const url = new URL(req.url ?? "", `https://${req.headers.host}`);
    const companyId = Number(url.searchParams.get("companyId"));

    // Lê body
    const body = await new Promise<string>((resolve) => {
      let data = "";
      req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      req.on("end", () => resolve(data));
    });
    const payload = body ? JSON.parse(body) : {};

    const paymentId = payload?.data?.id ?? url.searchParams.get("data.id");
    const topic = payload?.type ?? url.searchParams.get("type");

    if (topic && topic !== "payment") return;
    if (!paymentId || !companyId) return;

    const { getIntegrationCredentials, setOrderPayment, findOrderByExternalPaymentId } = await import("../server/db");
    const credentials = await getIntegrationCredentials<{ accessToken: string }>(companyId, "mercadopago");
    if (!credentials?.accessToken) return;

    const paymentResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    if (!paymentResp.ok) return;

    const payment = (await paymentResp.json()) as { id: number; status: string; external_reference?: string };
    const MP_STATUS_MAP: Record<string, "pending" | "approved" | "rejected" | "refunded"> = {
      pending: "pending", in_process: "pending", authorized: "pending",
      approved: "approved", rejected: "rejected", cancelled: "rejected",
      refunded: "refunded", charged_back: "refunded",
    };
    const mappedStatus = MP_STATUS_MAP[payment.status] ?? "pending";
    const orderId = payment.external_reference ? Number(payment.external_reference) : undefined;
    if (!orderId) return;

    const existing = await findOrderByExternalPaymentId(companyId, String(paymentId));
    if (!existing || (existing as { paymentStatus: string }).paymentStatus !== mappedStatus) {
      await setOrderPayment(orderId, { paymentStatus: mappedStatus, externalPaymentId: String(paymentId) });
    }
  } catch (error) {
    console.error("[MercadoPago] Webhook processing failed:", error);
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? "";

  // Rotas especiais que não são tRPC
  if (url.startsWith("/api/mercadopago/oauth-callback")) {
    return handleMercadoPagoCallback(req, res);
  }
  if (url.startsWith("/api/webhooks/mercadopago") || url.startsWith("/api/mercadopago-webhook")) {
    return handleMercadoPagoWebhook(req, res);
  }

  // Todas as chamadas tRPC
  const request = new Request(`https://${req.headers.host}${url}`, {
    method: req.method ?? "GET",
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v ?? ""])
    ),
    body: req.method !== "GET" && req.method !== "HEAD"
      ? await new Promise<Buffer>((resolve) => {
          const chunks: Buffer[] = [];
          req.on("data", (chunk: Buffer) => chunks.push(chunk));
          req.on("end", () => resolve(Buffer.concat(chunks)));
        })
      : undefined,
  });

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => createContext({ req, res }),
  });

  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  const buffer = await response.arrayBuffer();
  res.end(Buffer.from(buffer));
}
