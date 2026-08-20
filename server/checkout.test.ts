import { describe, expect, it } from "vitest";
import { getCheckoutState } from "../shared/checkout";

describe("checkout state", () => {
  it("keeps payment unavailable without Mercado Pago credentials", () => {
    expect(getCheckoutState(false)).toMatchObject({
      mode: "demo",
      paymentEnabled: false,
      title: "Pagamento em demonstração",
      buttonLabel: "Pagamento indisponível nesta versão",
    });
  });

  it("enables live payment only when credentials exist", () => {
    expect(getCheckoutState(true)).toMatchObject({ mode: "live", paymentEnabled: true, buttonLabel: "Pagar agora" });
  });
});
