import { describe, expect, it } from "vitest";
import { calculateDeliveryFee, getCheckoutState } from "../shared/checkout";
import { calculateOwnCourierFee, minorUnitsToBRL } from "../shared/delivery";

describe("checkout state", () => {
  it("keeps payment unavailable without Mercado Pago credentials", () => {
    expect(getCheckoutState(false)).toMatchObject({
      mode: "unavailable",
      paymentEnabled: false,
      title: "Pagamento indisponível",
      buttonLabel: "Pagamento indisponível",
    });
  });
  it("enables live payment only when credentials exist", () => {
    expect(getCheckoutState(true)).toMatchObject({
      mode: "live",
      paymentEnabled: true,
      buttonLabel: "Pagar agora",
    });
  });
});

describe("delivery fee", () => {
  it("does not charge before the customer enters an address", () => {
    expect(calculateDeliveryFee(50, "", true, "10")).toBe(0);
    expect(calculateDeliveryFee(50, "Rua A", true, "")).toBe(0);
    expect(calculateDeliveryFee(50, null, true, "10")).toBe(0);
  });
  it("does not charge when the store has no delivery method configured", () => {
    expect(calculateDeliveryFee(50, "Rua A", false, "10")).toBe(0);
  });
  it("uses only the fee quoted by the server when order, address, and delivery are present", () => {
    expect(calculateDeliveryFee(50, "Rua A", true, "10", 12.34)).toBe(12.34);
    expect(calculateDeliveryFee(50, "Rua A", true, "10")).toBe(0);
    expect(calculateDeliveryFee(0, "Rua A", true, "10")).toBe(0);
  });
  it("calculates own courier delivery from the road distance and configured rate", () => {
    expect(calculateOwnCourierFee(4.2, 2.5)).toBe(10.5);
    expect(calculateOwnCourierFee(3.3, 1.99)).toBe(6.57);
  });
  it("converts Uber minor units to BRL and refuses a foreign currency", () => {
    expect(minorUnitsToBRL(1234, "brl")).toBe(12.34);
    expect(() => minorUnitsToBRL(1234, "USD")).toThrow("BRL");
  });
});
