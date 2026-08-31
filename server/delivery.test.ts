import { describe, expect, it } from "vitest";
import { buildTrackingMessage, unavailableDeliveryResponse } from "@shared/delivery";

describe("delivery integration contracts", () => {
  it("keeps 99Entrega unavailable without partner credentials", () => {
    expect(unavailableDeliveryResponse("99entrega")).toMatchObject({
      provider: "99entrega",
      available: false,
      trackingUrl: null,
    });
  });

  it("keeps Uber Direct unavailable without business credentials", () => {
    expect(unavailableDeliveryResponse("uber_direct")).toMatchObject({
      provider: "uber_direct",
      available: false,
      trackingUrl: null,
    });
  });

  it("builds a tracking message without sending it", () => {
    expect(buildTrackingMessage("whatsapp", "Casa na Marmita", "https://example.com/rastreio/123")).toContain("https://example.com/rastreio/123");
    expect(buildTrackingMessage("sms", "Casa na Marmita", "https://example.com/rastreio/123")).toContain("SMS");
  });
});
