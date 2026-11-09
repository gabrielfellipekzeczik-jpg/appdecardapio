import { afterEach, describe, expect, it } from "vitest";
import { effectiveFeePercent } from "@shared/platform-fee";
import {
  computeApplicationFee,
  isBoletoPaymentMethod,
} from "./integrations/mercadoPago";

describe("computeApplicationFee", () => {
  const originalFeePercent = process.env.PLATFORM_FEE_PERCENT;
  afterEach(() => {
    if (originalFeePercent === undefined)
      delete process.env.PLATFORM_FEE_PERCENT;
    else process.env.PLATFORM_FEE_PERCENT = originalFeePercent;
  });

  it("retains 5% of the transaction amount by default, rounded to cents", () => {
    delete process.env.PLATFORM_FEE_PERCENT;
    expect(computeApplicationFee(100)).toBe(5);
    expect(computeApplicationFee(24.9)).toBe(1.25);
  });

  it("respects a custom PLATFORM_FEE_PERCENT", () => {
    process.env.PLATFORM_FEE_PERCENT = "10";
    expect(computeApplicationFee(50)).toBe(5);
  });
});

describe("isBoletoPaymentMethod", () => {
  it("blocks boleto identifiers while allowing Pix and card methods", () => {
    expect(isBoletoPaymentMethod("bolbradesco")).toBe(true);
    expect(isBoletoPaymentMethod("ticket")).toBe(true);
    expect(isBoletoPaymentMethod("pec")).toBe(true);
    expect(isBoletoPaymentMethod("pix")).toBe(false);
    expect(isBoletoPaymentMethod("visa")).toBe(false);
    expect(isBoletoPaymentMethod(undefined)).toBe(false);
  });
});

describe("taxa por restaurante", () => {
  it("usa a taxa do restaurante quando definida", () => {
    expect(computeApplicationFee(100, 8)).toBe(8);
    expect(computeApplicationFee(37.5, 3.5)).toBe(1.31);
    expect(computeApplicationFee(100, 0)).toBe(0);
  });

  it("cai na taxa padrão quando o restaurante não tem uma", () => {
    expect(effectiveFeePercent(null, 5)).toBe(5);
    expect(effectiveFeePercent(undefined, 5)).toBe(5);
    expect(effectiveFeePercent("7.50", 5)).toBe(7.5);
    expect(effectiveFeePercent(0, 5)).toBe(0);
  });
});
