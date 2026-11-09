import { describe, expect, it } from "vitest";
import {
  feeWasRetained,
  isValidFeePercent,
  requiredFeeAmount,
  retainedPlatformFee,
} from "@shared/platform-fee";

describe("garantia da taxa da plataforma", () => {
  it("só aceita taxa maior que zero e dentro do limite", () => {
    expect(isValidFeePercent(5)).toBe(true);
    expect(isValidFeePercent(0)).toBe(false);
    expect(isValidFeePercent(Number.NaN)).toBe(false);
    expect(isValidFeePercent(31)).toBe(false);
  });

  it("nunca cobra menos de 1 centavo", () => {
    expect(requiredFeeAmount(0.1, 5)).toBe(0.01);
    expect(requiredFeeAmount(1, 5)).toBe(0.05);
  });

  it("lê a taxa retida pelo Mercado Pago", () => {
    expect(retainedPlatformFee({ fee_details: [{ type: "mercadopago_fee", amount: 0.5 }, { type: "application_fee", amount: 0.05 }] })).toBe(0.05);
    expect(retainedPlatformFee({ fee_details: [{ type: "mercadopago_fee", amount: 0.5 }] })).toBe(0);
    expect(retainedPlatformFee({ marketplace_fee: 1.2 })).toBe(1.2);
  });

  it("aprova só quando a taxa retida bate com a esperada", () => {
    expect(feeWasRetained(0.05, 0.05)).toBe(true);
    expect(feeWasRetained(0, 0.05)).toBe(false);
    expect(feeWasRetained(0.04, 0.05)).toBe(true);
    expect(feeWasRetained(0.02, 0.05)).toBe(false);
  });
});

describe("taxa de serviço paga pelo cliente", () => {
  it("soma a taxa sobre itens + entrega no pagamento online", async () => {
    const { serviceFeeFor } = await import("@shared/platform-fee");
    expect(serviceFeeFor(8.5, 3)).toBe(0.26);
    expect(serviceFeeFor(100, 3)).toBe(3);
  });
  it("não cobra taxa sem porcentagem válida ou sem valor", async () => {
    const { serviceFeeFor } = await import("@shared/platform-fee");
    expect(serviceFeeFor(8.5, null)).toBe(0);
    expect(serviceFeeFor(8.5, 0)).toBe(0);
    expect(serviceFeeFor(0, 3)).toBe(0);
  });
  it("recusa pagamento online de pedido sem taxa gravada", async () => {
    const { assertOrderFee } = await import("./integrations/mercadoPago");
    expect(() => assertOrderFee(0)).toThrow(/indisponível/);
    expect(() => assertOrderFee(null)).toThrow(/indisponível/);
    expect(assertOrderFee(0.26)).toBe(0.26);
  });
});
