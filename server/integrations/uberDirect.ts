import { ENV } from "../_core/env";

// Reference: https://developer.uber.com/docs/deliveries/overview
// Verify these paths/scopes against the live reference once real sandbox
// credentials are configured — Uber's Direct docs have shifted paths before.
const UBER_TOKEN_URL = "https://auth.uber.com/oauth/v2/token";
const UBER_API_BASE = "https://api.uber.com/v1";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export function isUberDirectConfigured(): boolean {
  return Boolean(ENV.uberDirectClientId && ENV.uberDirectClientSecret && ENV.uberDirectCustomerId && ENV.pickupAddress);
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }
  const response = await fetch(UBER_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENV.uberDirectClientId,
      client_secret: ENV.uberDirectClientSecret,
      grant_type: "client_credentials",
      scope: "eats.deliveries",
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Uber Direct auth failed (${response.status}): ${detail}`);
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

export type CreateDeliveryInput = {
  orderId: number;
  dropoffAddress: string;
  dropoffName: string;
  dropoffPhone: string;
  manifestItems: Array<{ name: string; quantity: number }>;
};

export type UberDeliveryResult = {
  deliveryId: string;
  trackingUrl: string;
  status: string;
};

/** Requests an on-demand courier for a ready order. Called when an order moves to `ready`. */
export async function createDelivery(input: CreateDeliveryInput): Promise<UberDeliveryResult> {
  if (!isUberDirectConfigured()) throw new Error("Uber Direct is not configured");
  const token = await getAccessToken();

  const response = await fetch(`${UBER_API_BASE}/customers/${ENV.uberDirectCustomerId}/deliveries`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      pickup_address: ENV.pickupAddress,
      pickup_name: "Casa na Marmita",
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
