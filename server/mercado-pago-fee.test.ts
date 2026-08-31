import { afterEach, describe, expect, it } from "vitest";
import { computeApplicationFee } from "./integrations/mercadoPago";

describe("computeApplicationFee", () => {
  const originalFeePercent = process.env.PLATFORM_FEE_PERCENT;
  afterEach(() => {
    if (originalFeePercent === undefined) delete process.env.PLATFORM_FEE_PERCENT;
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
