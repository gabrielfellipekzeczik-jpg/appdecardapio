import { describe, expect, it } from "vitest";
import {
  createdMessage,
  matchCatalogItem,
  phoneFromJid,
  quoteMessage,
  resolveItems,
  statusMessage,
  type OrderRequest,
} from "./ordering";

const catalog = [
  { id: 1, name: "Marmita de frango", price: 24.9 },
  { id: 2, name: "Marmita de carne", price: 27.9 },
  { id: 3, name: "Suco de laranja", price: 9 },
];
const request: OrderRequest = {
  items: [
    { name: "marmita de frango", quantity: 2, note: "sem cebola" },
    { name: "suco", quantity: 1 },
  ],
  fulfillment: "delivery",
  address: "81580-130",
  number: "159",
  complement: "",
  customerName: "Ana",
  payment: "link",
};

describe("itens do pedido", () => {
  it("acha o item mesmo com acento, caixa ou nome parcial", () => {
    expect(matchCatalogItem("MARMITA DE FRANGO", catalog)?.id).toBe(1);
    expect(matchCatalogItem("suco", catalog)?.id).toBe(3);
  });

  it("não chuta quando o nome é ambíguo ou não existe", () => {
    expect(matchCatalogItem("marmita", catalog)).toBeNull();
    expect(matchCatalogItem("pizza", catalog)).toBeNull();
  });

  it("separa o que não foi identificado", () => {
    const resolved = resolveItems(
      { ...request, items: [...request.items, { name: "pizza", quantity: 1 }] },
      catalog
    );
    expect(resolved.items.map(item => item.menuItemId)).toEqual([1, 3]);
    expect(resolved.unknown).toEqual(["pizza"]);
  });
});

describe("mensagens", () => {
  it("resume o pedido com os valores calculados pelo app", () => {
    const text = quoteMessage({
      request,
      items: resolveItems(request, catalog).items,
      subtotal: 58.8,
      deliveryFee: 7.5,
      total: 66.3,
      address: "Rua Ladislau Smak - Uberaba, Curitiba - PR",
    });
    expect(text).toContain("2x Marmita de frango (sem cebola)");
    expect(text).toContain("Entrega: R$ 7,50");
    expect(text).toContain("Total: R$ 66,30");
    expect(text).toContain("Posso confirmar?");
  });

  it("manda o link de pagamento e o rastreio", () => {
    const text = createdMessage({
      orderId: 9,
      total: 66.3,
      paymentLink: "https://mpago.la/abc",
      trackingUrl: "https://app/rastrear/x",
      payment: "link",
    });
    expect(text).toContain("Pedido #9");
    expect(text).toContain("https://mpago.la/abc");
    expect(text).toContain("https://app/rastrear/x");
  });

  it("explica o status do último pedido", () => {
    expect(
      statusMessage([{ id: 4, status: "preparing", paymentStatus: "approved", paymentMethod: "mercadopago_link" }])
    ).toBe("Seu pedido #4 está em preparo.");
    expect(
      statusMessage([{ id: 5, status: "received", paymentStatus: "pending", paymentMethod: "mercadopago_link" }])
    ).toContain("aguardando o pagamento");
    expect(statusMessage([])).toContain("Não encontrei");
  });

  it("tira o 55 do número do WhatsApp", () => {
    expect(phoneFromJid("5541999998888@s.whatsapp.net")).toBe("41999998888");
    expect(phoneFromJid("12345@lid")).toBeNull();
  });
});
