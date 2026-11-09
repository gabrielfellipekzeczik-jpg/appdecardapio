import { ENV } from "../_core/env";
import { getDb, getIntegrationCredentials, saveIntegrationCredentials } from "../db";
import { effectiveFeePercent, platformFeeAmount } from "@shared/platform-fee";

const MP_AUTHORIZE_URL = "https://auth.mercadopago.com/authorization";
const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const MP_PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";
const MP_PREFERENCES_URL = "https://api.mercadopago.com/checkout/preferences";

export type MercadoPagoCredentials = {
  accessToken: string;
  refreshToken: string;
  publicKey: string;
  userId: number;
  liveMode: boolean;
};

export function isBoletoPaymentMethod(
  paymentMethodId?: string | null
): boolean {
  return /(?:boleto|ticket|bolbradesco|^pec$)/i.test(
    paymentMethodId?.trim() ?? ""
  );
}

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
  url.searchParams.set(
    "state",
    Buffer.from(
      JSON.stringify({ companyId, nonce: Math.random().toString(36).slice(2) })
    ).toString("base64")
  );
  return url.toString();
}

export function decodeState(state: string): { companyId: number } {
  const parsed = JSON.parse(Buffer.from(state, "base64").toString("utf-8")) as {
    companyId: number;
  };
  if (!Number.isInteger(parsed.companyId))
    throw new Error("Invalid OAuth state");
  return parsed;
}

export async function exchangeCodeForCredentials(
  code: string
): Promise<MercadoPagoCredentials> {
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
    throw new Error(
      `Mercado Pago token exchange failed (${response.status}): ${detail}`
    );
  }
  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    public_key: string;
    user_id: number;
    live_mode: boolean;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    publicKey: data.public_key,
    userId: data.user_id,
    liveMode: data.live_mode,
  };
}

async function refreshCredentials(
  refreshToken: string
): Promise<MercadoPagoCredentials> {
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
    throw new Error(
      `Mercado Pago token refresh failed (${response.status}): ${detail}`
    );
  }
  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    public_key: string;
    user_id: number;
    live_mode: boolean;
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
export async function getConnectedCredentials(
  companyId: number
): Promise<MercadoPagoCredentials | undefined> {
  return getIntegrationCredentials<MercadoPagoCredentials>(
    companyId,
    "mercadopago"
  );
}

export async function saveCredentials(
  companyId: number,
  credentials: MercadoPagoCredentials
) {
  await saveIntegrationCredentials(companyId, "mercadopago", credentials, {
    publicKey: credentials.publicKey,
    userId: credentials.userId,
    liveMode: credentials.liveMode,
  });
}

export type CreatePaymentInput = {
  companyId: number;
  orderId: number;
  transactionAmount: number;
  description: string;
  payer: { email: string; name?: string; phone?: string };
  items?: { id: number; title: string; quantity: number; unitPrice: number }[];
  paymentMethodId?: string;
  token?: string;
  installments?: number;
  issuerId?: string;
};

/** Nome, telefone e itens não são obrigatórios, mas alimentam o antifraude e ajudam na aprovação do cartão. */
export function buildPayerDetails(input: {
  payer: CreatePaymentInput["payer"];
  items?: CreatePaymentInput["items"];
}) {
  const [firstName, ...rest] = (input.payer.name ?? "").trim().split(/\s+/);
  const names = {
    ...(firstName ? { first_name: firstName } : {}),
    ...(rest.length ? { last_name: rest.join(" ") } : {}),
  };
  const digits = (input.payer.phone ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return {
    payer: { email: input.payer.email, ...names },
    additional_info: {
      payer: {
        ...names,
        ...(digits.length >= 10
          ? { phone: { area_code: digits.slice(0, 2), number: digits.slice(2) } }
          : {}),
      },
      items: (input.items ?? []).map(item => ({
        id: String(item.id),
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
    },
  };
}

/**
 * Creates a payment via Checkout API using the connected seller's access
 * token, retaining the platform's cut via `application_fee` (Mercado Pago's
 * marketplace split — https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/how-tos/integrate-marketplace).
 * The fee amount accrues to the OAuth application's own account (the
 * platform owner's Mercado Pago account); the remainder goes to the seller.
 * On a 401 (expired token) it refreshes once, persists the new pair, and retries.
 */
/**
 * O Pix vai só com o e-mail: o único Pix pago no app foi gerado assim, e os gerados
 * com nome, telefone e validade não foram aceitos pelo banco na leitura do QR.
 */
export function payerFieldsFor(input: {
  paymentMethodId?: string;
  payer: CreatePaymentInput["payer"];
  items?: CreatePaymentInput["items"];
}) {
  return input.paymentMethodId === "pix"
    ? { payer: { email: input.payer.email } }
    : buildPayerDetails(input);
}

/** Sem `percent`, usa a taxa padrão da plataforma (PLATFORM_FEE_PERCENT). */
export function computeApplicationFee(
  transactionAmount: number,
  percent: number = ENV.platformFeePercent
): number {
  return platformFeeAmount(transactionAmount, percent);
}

/** Taxa definida pelo dono da plataforma para o restaurante, ou a padrão. */
export async function feePercentFor(companyId: number): Promise<number> {
  const { data } = await getDb()
    .from("companies")
    .select("mp_fee_percent")
    .eq("id", companyId)
    .maybeSingle();
  return effectiveFeePercent(
    (data as { mp_fee_percent: number | string | null } | null)?.mp_fee_percent,
    ENV.platformFeePercent
  );
}

export async function createPayment(input: CreatePaymentInput) {
  const credentials = await getConnectedCredentials(input.companyId);
  if (!credentials) throw new Error("Mercado Pago is not connected");

  const applicationFee = computeApplicationFee(
    input.transactionAmount,
    await feePercentFor(input.companyId)
  );

  const body = {
    transaction_amount: input.transactionAmount,
    ...(applicationFee > 0 ? { application_fee: applicationFee } : {}),
    description: input.description,
    payment_method_id: input.paymentMethodId,
    token: input.token,
    installments: input.installments ?? 1,
    issuer_id: input.issuerId,
    ...payerFieldsFor(input),
    external_reference: String(input.orderId),
    notification_url: ENV.mpRedirectUri
      ? `${new URL("/api/webhooks/mercadopago", ENV.mpRedirectUri).toString()}?companyId=${input.companyId}`
      : undefined,
  };

  const idempotencySuffix = Math.random().toString(36).slice(2, 10);
  const attempt = async (accessToken: string) =>
    fetch(MP_PAYMENTS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": `order-${input.orderId}-${idempotencySuffix}`,
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
    console.error("[mercadopago] payment failed", response.status, detail, {
      orderId: input.orderId,
      amount: input.transactionAmount,
      applicationFee,
      method: input.paymentMethodId,
    });
    let reason = detail.slice(0, 300);
    try {
      const parsed = JSON.parse(detail) as {
        message?: string;
        error?: string;
        cause?: { code?: string | number; description?: string }[];
      };
      const cause = parsed.cause?.[0];
      reason =
        [cause?.code, cause?.description || parsed.message || parsed.error]
          .filter(Boolean)
          .join(" · ") || reason;
    } catch {}
    throw new Error(`Mercado Pago recusou o pagamento (${response.status}): ${reason}`);
  }

  const payment = (await response.json()) as {
    id: number;
    status: string;
    status_detail: string;
    date_of_expiration?: string | null;
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string;
        qr_code_base64?: string;
        ticket_url?: string;
      };
    };
  };
  return { ...payment, applicationFee };
}

async function sellerPaymentRequest(
  companyId: number,
  paymentId: string,
  init?: RequestInit
) {
  const credentials = await getConnectedCredentials(companyId);
  if (!credentials) throw new Error("Mercado Pago is not connected");
  const url = `${MP_PAYMENTS_URL}/${encodeURIComponent(paymentId)}`;
  const attempt = (accessToken: string) =>
    fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
    });
  const response = await attempt(credentials.accessToken);
  if (response.status !== 401) return response;
  const refreshed = await refreshCredentials(credentials.refreshToken);
  await saveCredentials(companyId, refreshed);
  return attempt(refreshed.accessToken);
}

export async function getPayment(companyId: number, paymentId: string) {
  const response = await sellerPaymentRequest(companyId, paymentId);
  if (!response.ok)
    throw new Error(`Falha ao consultar pagamento (${response.status})`);
  return (await response.json()) as {
    id: number;
    status: string;
    payment_method_id?: string;
  };
}

/** O Mercado Pago recusa o cancelamento se o Pix acabou de ser pago; quem chama deve reconsultar. */
export async function cancelPayment(companyId: number, paymentId: string) {
  const response = await sellerPaymentRequest(companyId, paymentId, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });
  return response.ok;
}

export type PaymentLinkPreference = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
};

function paymentLinkUrl(preference: PaymentLinkPreference, liveMode: boolean) {
  return liveMode
    ? preference.init_point
    : preference.sandbox_init_point || preference.init_point;
}

/** Creates a Checkout Pro link for a manually entered order using the connected seller's OAuth token. */
export async function createPaymentLink(input: {
  companyId: number;
  orderId: number;
  transactionAmount: number;
  description: string;
  payerEmail?: string;
}) {
  const credentials = await getConnectedCredentials(input.companyId);
  if (!credentials)
    throw new Error("Mercado Pago não está conectado para esta loja.");
  const applicationFee = computeApplicationFee(
    input.transactionAmount,
    await feePercentFor(input.companyId)
  );
  const body = {
    items: [
      {
        id: `order-${input.orderId}`,
        title: input.description.slice(0, 250),
        quantity: 1,
        currency_id: "BRL",
        unit_price: input.transactionAmount,
      },
    ],
    external_reference: String(input.orderId),
    marketplace_fee: applicationFee,
    notification_url: ENV.mpRedirectUri
      ? `${new URL("/api/webhooks/mercadopago", ENV.mpRedirectUri).toString()}?companyId=${input.companyId}`
      : undefined,
    ...(input.payerEmail ? { payer: { email: input.payerEmail } } : {}),
  };
  const attempt = async (accessToken: string) =>
    fetch(MP_PREFERENCES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": `manual-order-link-${input.orderId}`,
      },
      body: JSON.stringify(body),
    });
  let response = await attempt(credentials.accessToken);
  let current = credentials;
  if (response.status === 401) {
    current = await refreshCredentials(credentials.refreshToken);
    await saveCredentials(input.companyId, current);
    response = await attempt(current.accessToken);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Mercado Pago link creation failed (${response.status}): ${detail}`
    );
  }
  const preference = (await response.json()) as PaymentLinkPreference;
  if (!preference.id || !preference.init_point)
    throw new Error("Mercado Pago não retornou um link de pagamento válido.");
  return {
    id: preference.id,
    url: paymentLinkUrl(preference, current.liveMode),
    applicationFee,
  };
}

/** Retrieves the already-created link so retrying the admin UI does not create another charge link. */
export async function getPaymentLink(companyId: number, preferenceId: string) {
  let credentials = await getConnectedCredentials(companyId);
  if (!credentials)
    throw new Error("Mercado Pago não está conectado para esta loja.");
  const request = (accessToken: string) =>
    fetch(`${MP_PREFERENCES_URL}/${encodeURIComponent(preferenceId)}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
  let response = await request(credentials.accessToken);
  if (response.status === 401) {
    credentials = await refreshCredentials(credentials.refreshToken);
    await saveCredentials(companyId, credentials);
    response = await request(credentials.accessToken);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Mercado Pago preference lookup failed (${response.status}): ${detail}`
    );
  }
  const preference = (await response.json()) as PaymentLinkPreference;
  if (!preference.id || !preference.init_point)
    throw new Error("Mercado Pago não retornou um link de pagamento válido.");
  return paymentLinkUrl(preference, credentials.liveMode);
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
    throw new Error(
      `Mercado Pago payment lookup failed (${response.status}): ${detail}`
    );
  }
  return (await response.json()) as {
    id: number;
    status: string;
    external_reference?: string;
  };
}
