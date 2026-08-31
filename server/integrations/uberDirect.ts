import { getIntegrationCredentials } from "../db";

// Reference: https://developer.uber.com/docs/deliveries/overview
// Verify these paths/scopes against the live reference once real sandbox
// credentials are configured — Uber's Direct docs have shifted paths before.
const UBER_TOKEN_URL = "https://auth.uber.com/oauth/v2/token";
const UBER_API_BASE = "https://api.uber.com/v1";

export type UberDirectCredentials = { clientId: string; clientSecret: string; customerId: string };

const tokenCache = new Map<number, { accessToken: string; expiresAt: number }>();

async function getAccessToken(companyId: number, credentials: UberDirectCredentials): Promise<string> {
  const cached = tokenCache.get(companyId);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.accessToken;

  const response = await fetch(UBER_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "client_credentials",
      scope: "eats.deliveries",
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Uber Direct auth failed (${response.status}): ${detail}`);
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache.set(companyId, { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

export type CreateDeliveryInput = {
  companyId: number;
  companyName: string;
  pickupAddress: string;
  orderId: number;
  dropoffAddress: string;
  dropoffName: string;
  dropoffPhone: string;
  manifestItems: Array<{ name: string; quantity: number }>;
};

export type DeliveryResult = { deliveryId: string; trackingUrl: string; status: string };

/** Requests an on-demand courier for a ready order. Called when an order moves to `ready`. */
export async function createDelivery(input: CreateDeliveryInput): Promise<DeliveryResult> {
  const credentials = await getIntegrationCredentials<UberDirectCredentials>(input.companyId, "uber_direct");
  if (!credentials) throw new Error("Uber Direct is not configured for this company");
  if (!input.pickupAddress) throw new Error("Company pickup address is not configured");

  const token = await getAccessToken(input.companyId, credentials);

  const response = await fetch(`${UBER_API_BASE}/customers/${credentials.customerId}/deliveries`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      pickup_address: input.pickupAddress,
      pickup_name: input.companyName,
      dropoff_address: input.dropoffAddress,
      dropoff_name: input.dropoffName,
      dropoff_phone_number: input.dropoffPhone,
      manifest_items: input.manifestItems.map((item) => ({ name: item.name, quantity: item.quantity })),
      external_id: `order-${input.orderId}`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Uber Direct delivery creation failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as { id: string; tracking_url: string; status: string };
  return { deliveryId: data.id, trackingUrl: data.tracking_url, status: data.status };
}
