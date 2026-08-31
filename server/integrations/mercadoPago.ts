import { ENV } from "../_core/env";
import { getIntegrationCredentials, saveIntegrationCredentials } from "../db";

const MP_AUTHORIZE_URL = "https://auth.mercadopago.com/authorization";
const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const MP_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";

export type MercadoPagoCredentials = {
  accessToken: string;
  refreshToken: string;
  publicKey: string;
  userId: number;
  liveMode: boolean;
};

export function isMercadoPagoConfigured(): boolean {
  return Boolean(ENV.mpClientId && ENV.mpClientSecret && ENV.mpRedirectUri);
}

/** `state` carries the connecting company's id (base64) so the OAuth callback knows who to save credentials for. */
export function buildAuthorizeUrl(companyId: number): string {
  const url = new URL(MP_AUTHORIZE_URL);
  url.searchParams.set("client_id", ENV.mpClientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", ENV.mpRedirectUri);
  url.searchParams.set("state", Buffer.from(JSON.stringify({ companyId, nonce: Math.random().toString(36).slice(2) })).toString("base64"));
  return url.toString();
}

export function decodeState(state: string): { companyId: number } {
  const parsed = JSON.parse(Buffer.from(state, "base64").toString("utf-8")) as { companyId: number };
  if (!Number.isInteger(parsed.companyId)) throw new Error("Invalid OAuth state");
  return parsed;
}

export async function exchangeCodeForCredentials(code: string): Promise<MercadoPagoCredentials> {
  const response = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: ENV.mpClientId,
      client_secret: ENV.mpClientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: ENV.mpRedirectUri,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Mercado Pago token exchange failed (${response.status}): ${detail}`);
  }
  const data = (await response.json()) as {
    access_token: string; refresh_token: string; public_key: string; user_id: number; live_mode: boolean;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    publicKey: data.public_key,
    userId: data.user_id,
    liveMode: data.live_mode,
  };
}

async function refreshCredentials(refreshToken: string): Promise<MercadoPagoCredentials> {
  const response = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: ENV.mpClientId,
      client_secret: ENV.mpClientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Mercado Pago token refresh failed (${response.status}): ${detail}`);
  }
  const data = (await response.json()) as {
    access_token: string; refresh_token: string; public_key: string; user_id: number; live_mode: boolean;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    publicKey: data.public_key,
    userId: data.user_id,
    liveMode: data.live_mode,
  };
}

/** Reads the connected seller's credentials for a company, transparently refreshing (and persisting) if MP rejects the access token. */
export async function getConnectedCredentials(companyId: number): Promise<MercadoPagoCredentials | undefined> {
  return getIntegrationCredentials<MercadoPagoCredentials>(companyId, "mercadopago");
}

export async function saveCredentials(companyId: number, credentials: MercadoPagoCredentials) {
  await saveIntegrationCredentials(companyId, "mercadopago", credentials, { publicKey: credentials.publicKey, userId: credentials.userId, liveMode: credentials.liveMode });
}

export type CreatePaymentInput = {
  companyId: number;
  orderId: number;
  transactionAmount: number;
  description: string;
  payer: { email: string; firstName?: string };
  paymentMethodId?: string;
  token?: string;
  installments?: number;
  issuerId?: string;
};

/**
 * Creates a payment via Checkout API using the connected seller's access
 * token, retaining the platform's cut via `application_fee` (Mercado Pago's
 * marketplace split — https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/how-tos/integrate-marketplace).
 * The fee amount accrues to the OAuth application's own account (the
 * platform owner's Mercado Pago account); the remainder goes to the seller.
 * On a 401 (expired token) it refreshes once, persists the new pair, and retries.
 */
export function computeApplicationFee(transactionAmount: number): number {
  return Math.round(transactionAmount * (ENV.platformFeePercent / 100) * 100) / 100;
}

export async function createPayment(input: CreatePaymentInput) {
  const credentials = await getConnectedCredentials(input.companyId);
  if (!credentials) throw new Error("Mercado Pago is not connected");

  const applicationFee = computeApplicationFee(input.transactionAmount);

  const body = {
    transaction_amount: input.transactionAmount,
    application_fee: applicationFee,
    description: input.description,
    payment_method_id: input.paymentMethodId,
    token: input.token,
    installments: input.installments ?? 1,
    issuer_id: input.issuerId,
    payer: { email: input.payer.email, first_name: input.payer.firstName },
    external_reference: String(input.orderId),
    notification_url: ENV.mpRedirectUri ? `${new URL("/api/webhooks/mercadopago", ENV.mpRedirectUri).toString()}?companyId=${input.companyId}` : undefined,
  };

  const attempt = async (accessToken: string) => fetch(MP_PAYMENTS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": `order-${input.orderId}`,
    },
    body: JSON.stringify(body),
  });

  let response = await attempt(credentials.accessToken);
  if (response.status === 401) {
    const refreshed = await refreshCredentials(credentials.refreshToken);
    await saveCredentials(input.companyId, refreshed);
    response = await attempt(refreshed.accessToken);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Mercado Pago payment creation failed (${response.status}): ${detail}`);
  }

  const payment = (await response.json()) as { id: number; status: string; status_detail: string; point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } } };
  return { ...payment, applicationFee };
}

/** Fetches a payment's current status by id (used by the webhook handler). */
export async function getPaymentStatus(companyId: number, paymentId: string) {
  const credentials = await getConnectedCredentials(companyId);
  if (!credentials) throw new Error("Mercado Pago is not connected");
  const response = await fetch(`${MP_PAYMENTS_URL}/${paymentId}`, {
    headers: { authorization: `Bearer ${credentials.accessToken}` },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Mercado Pago payment lookup failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as { id: number; status: string; external_reference?: string };
}
