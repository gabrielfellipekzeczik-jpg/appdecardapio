import { createHmac } from "node:crypto";
import { getIntegrationCredentials } from "../db";

// Reference: https://developers.lalamove.com/ — verify endpoint/field names
// against the live reference once real sandbox credentials are configured.
const LALAMOVE_BASE_URL = "https://rest.lalamove.com";
const LALAMOVE_MARKET = "BR";

export type LalamoveCredentials = { apiKey: string; apiSecret: string };

function sign(secret: string, method: string, path: string, timestamp: number, body: string): string {
  const raw = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;
  return createHmac("sha256", secret).update(raw).digest("hex");
}

async function lalamoveRequest(credentials: LalamoveCredentials, method: "GET" | "POST", path: string, body: Record<string, unknown> = {}) {
  const timestamp = Date.now();
  const payload = method === "GET" ? "" : JSON.stringify(body);
  const signature = sign(credentials.apiSecret, method, path, timestamp, payload);
  const response = await fetch(`${LALAMOVE_BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `hmac ${credentials.apiKey}:${timestamp}:${signature}`,
      market: LALAMOVE_MARKET,
    },
    body: method === "GET" ? undefined : payload,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Lalamove request failed (${response.status}): ${detail}`);
  }
  return response.json();
}

export type CreateDeliveryInput = {
  companyId: number;
  pickupAddress: string;
  orderId: number;
  dropoffAddress: string;
  dropoffName: string;
  dropoffPhone: string;
};

export type DeliveryResult = { deliveryId: string; trackingUrl: string; status: string };

/** Quotes then places a motorcycle ("MOTORCYCLE" service type — best fit for small marmita orders) delivery. */
export async function createDelivery(input: CreateDeliveryInput): Promise<DeliveryResult> {
  const credentials = await getIntegrationCredentials<LalamoveCredentials>(input.companyId, "lalamove");
  if (!credentials) throw new Error("Lalamove is not configured for this company");
  if (!input.pickupAddress) throw new Error("Company pickup address is not configured");

  const quotation = (await lalamoveRequest(credentials, "POST", "/v3/quotations", {
    data: {
      serviceType: "MOTORCYCLE",
      language: "pt_BR",
      stops: [
        { address: input.pickupAddress },
        { address: input.dropoffAddress },
      ],
    },
  })) as { data: { quotationId: string; stops: Array<{ stopId: string }> } };

  const [pickupStop, dropoffStop] = quotation.data.stops;

  const order = (await lalamoveRequest(credentials, "POST", "/v3/orders", {
    data: {
      quotationId: quotation.data.quotationId,
      sender: { stopId: pickupStop.stopId, name: "Cozinha", phone: input.dropoffPhone },
      recipients: [{ stopId: dropoffStop.stopId, name: input.dropoffName, phone: input.dropoffPhone }],
      metadata: { orderId: String(input.orderId) },
    },
  })) as { data: { orderId: string; status: string; shareLink?: string } };

  return {
    deliveryId: order.data.orderId,
    trackingUrl: order.data.shareLink ?? "",
    status: order.data.status,
  };
}
