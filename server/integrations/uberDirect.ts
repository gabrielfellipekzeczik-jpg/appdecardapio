import { getIntegrationCredentials } from "../db";
import { minorUnitsToBRL } from "@shared/delivery";

// Uber Direct classic customer API: a valid quote is obtained before payment,
// shown to the buyer, and reused when dispatching the accepted delivery.
const UBER_TOKEN_URL = "https://auth.uber.com/oauth/v2/token";
const UBER_API_BASE = "https://api.uber.com/v1";
export type UberDirectCredentials = {
  clientId: string;
  clientSecret: string;
  customerId: string;
};
const tokenCache = new Map<
  number,
  { accessToken: string; expiresAt: number }
>();

async function getAccessToken(
  companyId: number,
  credentials: UberDirectCredentials
): Promise<string> {
  const cached = tokenCache.get(companyId);
  if (cached && cached.expiresAt > Date.now() + 30_000)
    return cached.accessToken;
  const response = await fetch(UBER_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "client_credentials",
      scope: "eats.deliveries",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Uber Direct auth failed (${response.status})`);
  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache.set(companyId, {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

function serializeAddress(address: string) {
  return JSON.stringify({ street_address: [address], country: "BR" });
}

export type UberDeliveryQuote = {
  quoteId: string;
  fee: number;
  currency: string;
  expiresAt: number;
};

export async function quoteDelivery(input: {
  companyId: number;
  pickupAddress: string;
  dropoffAddress: string;
}): Promise<UberDeliveryQuote> {
  const credentials = await getIntegrationCredentials<UberDirectCredentials>(
    input.companyId,
    "uber_direct"
  );
  if (!credentials)
    throw new Error("Uber Direct não está configurado para esta empresa.");
  if (!input.pickupAddress || !input.dropoffAddress)
    throw new Error("Informe os endereços de retirada e entrega.");
  const token = await getAccessToken(input.companyId, credentials);
  const response = await fetch(
    `${UBER_API_BASE}/customers/${encodeURIComponent(credentials.customerId)}/delivery_quotes`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pickup_address: serializeAddress(input.pickupAddress),
        dropoff_address: serializeAddress(input.dropoffAddress),
      }),
      signal: AbortSignal.timeout(12_000),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Uber Direct não conseguiu cotar essa entrega (${response.status}). Confira o endereço e a configuração em Integrações.`
    );
  }
  const data = (await response.json()) as {
    id?: string;
    fee?: number;
    currency?: string;
    currency_type?: string;
    expires?: string;
  };
  const currency = String(
    data.currency_type ?? data.currency ?? ""
  ).toUpperCase();
  if (!data.id || !Number.isSafeInteger(data.fee) || data.fee! < 0)
    throw new Error("A Uber retornou uma cotação incompleta.");
  if (currency !== "BRL")
    throw new Error(
      `A cotação Uber veio em ${currency || "moeda desconhecida"}; não é possível cobrar esse valor como reais.`
    );
  const expiresAt = data.expires
    ? Date.parse(data.expires)
    : Date.now() + 15 * 60_000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
    throw new Error(
      "A cotação da Uber já expirou. Atualize o endereço para pedir outra."
    );
  return {
    quoteId: data.id,
    fee: minorUnitsToBRL(data.fee!, currency),
    currency,
    expiresAt,
  };
}

export type CreateDeliveryInput = {
  companyId: number;
  companyName: string;
  pickupAddress: string;
  orderId: number;
  dropoffAddress: string;
  dropoffName: string;
  dropoffPhone: string;
  quoteId: string;
  manifestItems: Array<{ name: string; quantity: number }>;
};
export type DeliveryResult = {
  deliveryId: string;
  trackingUrl: string;
  status: string;
};

export async function createDelivery(
  input: CreateDeliveryInput
): Promise<DeliveryResult> {
  const credentials = await getIntegrationCredentials<UberDirectCredentials>(
    input.companyId,
    "uber_direct"
  );
  if (!credentials)
    throw new Error("Uber Direct não está configurado para esta empresa");
  if (!input.pickupAddress || !input.quoteId)
    throw new Error("Endereço de retirada ou cotação da Uber ausente");
  const token = await getAccessToken(input.companyId, credentials);
  const response = await fetch(
    `${UBER_API_BASE}/customers/${encodeURIComponent(credentials.customerId)}/deliveries`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        quote_id: input.quoteId,
        pickup_address: serializeAddress(input.pickupAddress),
        pickup_name: input.companyName,
        dropoff_address: serializeAddress(input.dropoffAddress),
        dropoff_name: input.dropoffName,
        dropoff_phone_number: input.dropoffPhone,
        manifest_items: input.manifestItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
        })),
        external_id: `order-${input.orderId}`,
      }),
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 400);
    throw new Error(
      `Uber Direct delivery creation failed (${response.status}): ${detail}`
    );
  }
  const data = (await response.json()) as {
    id: string;
    tracking_url: string;
    status: string;
  };
  return {
    deliveryId: data.id,
    trackingUrl: data.tracking_url,
    status: data.status,
  };
}
