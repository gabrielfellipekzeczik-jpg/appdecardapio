import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import {
  isReadyForKitchen,
  paymentFailureMessage,
  paymentRejectionMessage,
} from "@shared/payment-messages";

const mp = vi.hoisted(() => ({
  createPayment: vi.fn(),
  getPayment: vi.fn(),
  cancelPayment: vi.fn(),
}));

vi.mock("./integrations/mercadoPago", async importOriginal => ({
  ...(await importOriginal<typeof import("./integrations/mercadoPago")>()),
  ...mp,
}));
vi.mock("./notifications", async importOriginal => ({
  ...(await importOriginal<typeof import("./notifications")>()),
  notifyOrderEvent: vi.fn(),
}));

import { appRouter } from "./routers";
import {
  buildPayerDetails,
  payerFieldsFor,
} from "./integrations/mercadoPago";
import { clientIp, createRateLimiter } from "./_core/rateLimit";
import {
  DEFAULT_OPENING_HOURS,
  formatPhone,
  getStoreStatus,
  isSameEmail,
} from "@shared/store-rules";

const TOKEN = "22222222-2222-4222-8222-222222222222";
const EMAIL = "cliente@teste.com";

function caller(token = TOKEN) {
  return appRouter.createCaller({
    user: { email: EMAIL },
    req: {
      protocol: "https",
      headers: { "x-customer-access-token": token },
    },
    res: {},
  } as unknown as TrpcContext);
}

async function orderWithPendingPix() {
  const created = await caller().orders.create({
    companySlug: "loja-teste",
    email: EMAIL,
    name: "Cliente Teste",
    phone: "11999999992",
    address: "Rua Teste",
    addressNumber: "10",
    items: [{ menuItemId: 1, quantity: 1 }],
  });
  const orderId = created.orderId!;
  mp.createPayment.mockResolvedValueOnce({
    id: 900 + orderId,
    status: "pending",
    status_detail: "pending_waiting_transfer",
    applicationFee: 0,
  });
  await caller().payments.create({
    companySlug: "loja-teste",
    orderId,
    payerEmail: EMAIL,
    paymentMethodId: "pix",
  });
  return orderId;
}

const paymentStatus = async (orderId: number) =>
  (await caller().orders.byId({ companySlug: "loja-teste", id: orderId }))
    ?.order.paymentStatus;

describe("cancelPending", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancela o Pix pendente e libera nova tentativa", async () => {
    const orderId = await orderWithPendingPix();
    mp.getPayment.mockResolvedValueOnce({
      status: "pending",
      payment_method_id: "pix",
    });
    mp.cancelPayment.mockResolvedValueOnce(true);

    await expect(
      caller().payments.cancelPending({ companySlug: "loja-teste", orderId })
    ).resolves.toEqual({ status: "cancelled" });

    mp.createPayment.mockResolvedValueOnce({
      id: 1,
      status: "approved",
      status_detail: "accredited",
      applicationFee: 0,
    });
    await expect(
      caller().payments.create({
        companySlug: "loja-teste",
        orderId,
        payerEmail: EMAIL,
        paymentMethodId: "visa",
        token: "card",
      })
    ).resolves.toMatchObject({ status: "approved" });
  });

  it("não cancela um Pix que já foi pago", async () => {
    const orderId = await orderWithPendingPix();
    mp.getPayment.mockResolvedValueOnce({
      status: "approved",
      payment_method_id: "pix",
    });

    await expect(
      caller().payments.cancelPending({ companySlug: "loja-teste", orderId })
    ).resolves.toEqual({ status: "approved" });
    expect(mp.cancelPayment).not.toHaveBeenCalled();
    expect(await paymentStatus(orderId)).toBe("approved");
  });

  it("reconhece o Pix pago durante o cancelamento", async () => {
    const orderId = await orderWithPendingPix();
    mp.getPayment
      .mockResolvedValueOnce({ status: "pending", payment_method_id: "pix" })
      .mockResolvedValueOnce({ status: "approved", payment_method_id: "pix" });
    mp.cancelPayment.mockResolvedValueOnce(false);

    await expect(
      caller().payments.cancelPending({ companySlug: "loja-teste", orderId })
    ).resolves.toEqual({ status: "approved" });
    expect(await paymentStatus(orderId)).toBe("approved");
  });

  it("não troca a forma de um cartão em análise", async () => {
    const orderId = await orderWithPendingPix();
    mp.getPayment.mockResolvedValueOnce({
      status: "in_process",
      payment_method_id: "visa",
    });

    await expect(
      caller().payments.cancelPending({ companySlug: "loja-teste", orderId })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await paymentStatus(orderId)).toBe("pending");
  });

  it("exige o token do comprador que criou o pedido", async () => {
    const orderId = await orderWithPendingPix();
    await expect(
      caller("33333333-3333-4333-8333-333333333333").payments.cancelPending({
        companySlug: "loja-teste",
        orderId,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("regras de pagamento", () => {
  it("envia o Pix só com o e-mail e detalha o cartão", () => {
    const payer = { email: EMAIL, name: "Ana Souza", phone: "41999998888" };
    const items = [{ id: 1, title: "Marmita", quantity: 1, unitPrice: 20 }];
    expect(payerFieldsFor({ paymentMethodId: "pix", payer, items })).toEqual({
      payer: { email: EMAIL },
    });
    expect(
      payerFieldsFor({ paymentMethodId: "visa", payer, items })
    ).toHaveProperty("additional_info");
  });

  it("explica a recusa do cartão sem expor o código do provedor", () => {
    expect(paymentRejectionMessage("cc_rejected_insufficient_amount")).toContain(
      "limite"
    );
    expect(paymentRejectionMessage("codigo_novo")).toContain("recusado");
    expect(
      paymentFailureMessage(
        new Error("Mercado Pago recusou o pagamento (400): 2067")
      )
    ).not.toContain("2067");
  });

  it("só envia pedido online à cozinha depois de pago", () => {
    const online = { paymentMethod: "mercadopago" };
    expect(isReadyForKitchen({ ...online, paymentStatus: "pending" })).toBe(
      false
    );
    expect(isReadyForKitchen({ ...online, paymentStatus: "rejected" })).toBe(
      false
    );
    expect(isReadyForKitchen({ ...online, paymentStatus: "approved" })).toBe(
      true
    );
    expect(
      isReadyForKitchen({
        paymentMethod: "cash_on_delivery",
        paymentStatus: "pending",
      })
    ).toBe(true);
    expect(
      isReadyForKitchen({
        paymentMethod: "mercadopago_link",
        paymentStatus: "pending",
      })
    ).toBe(false);
  });
});

function guest() {
  return appRouter.createCaller({
    user: null,
    req: { protocol: "https", headers: { "x-customer-access-token": TOKEN } },
    res: {},
  } as unknown as TrpcContext);
}
const guestOrder = {
  email: EMAIL,
  name: "Cliente Teste",
  phone: "11999999993",
  address: "Rua Teste",
  addressNumber: "10",
  items: [{ menuItemId: 1, quantity: 1 }],
};

describe("compra com e-mail confirmado", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recusa pedido e pagamento sem e-mail confirmado", async () => {
    await expect(
      guest().orders.create({ ...guestOrder, companySlug: "loja-teste" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      guest().payments.create({
        companySlug: "loja-teste",
        orderId: 1,
        payerEmail: EMAIL,
        paymentMethodId: "pix",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("envia os dados do comprador ao gerar o pagamento", async () => {
    const created = await caller().orders.create({
      ...guestOrder,
      companySlug: "loja-teste",
    });
    mp.createPayment.mockResolvedValueOnce({
      id: 77,
      status: "pending",
      status_detail: "pending_waiting_transfer",
      applicationFee: 0,
    });
    await caller().payments.create({
      companySlug: "loja-teste",
      orderId: created.orderId!,
      payerEmail: EMAIL,
      paymentMethodId: "pix",
    });
    expect(mp.createPayment.mock.calls[0][0]).toMatchObject({
      payer: { email: EMAIL, name: "Cliente Teste", phone: "11999999993" },
      items: [{ id: 1, quantity: 1 }],
    });
  });

  it("só aceita dinheiro e retirada quando a loja permite", async () => {
    await expect(
      caller().orders.create({
        ...guestOrder,
        companySlug: "loja-teste",
        paymentMethod: "cash_on_delivery",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller().orders.create({
        ...guestOrder,
        companySlug: "loja-teste",
        fulfillment: "pickup",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("registra retirada paga na loja", async () => {
    const created = await caller().orders.create({
      ...guestOrder,
      companySlug: "loja-completa",
      paymentMethod: "cash_on_delivery",
      fulfillment: "pickup",
    });
    const found = await caller().orders.byId({
      companySlug: "loja-completa",
      id: created.orderId!,
    });
    expect(found?.order.deliveryAddress).toBe("Retirada na loja");
    expect(found?.order.paymentMethod).toBe("cash_on_delivery");
  });
});

describe("regras da loja", () => {
  // 06/11/2026 é sexta-feira; 15:00Z = 12:00 em São Paulo.
  const friday = (time: string) => new Date(`2026-11-06T${time}:00-03:00`);

  it("sem horário cadastrado a loja fica aberta", () => {
    expect(getStoreStatus(null)).toEqual({ open: true, label: null });
  });

  it("calcula aberto e fechado no fuso de São Paulo", () => {
    expect(getStoreStatus(DEFAULT_OPENING_HOURS, friday("12:00"))).toEqual({
      open: true,
      label: "Aberto até 14:30",
    });
    expect(getStoreStatus(DEFAULT_OPENING_HOURS, friday("09:00"))).toEqual({
      open: false,
      label: "Fechado · abre hoje às 11:00",
    });
    expect(getStoreStatus(DEFAULT_OPENING_HOURS, friday("15:00"))).toEqual({
      open: false,
      label: "Fechado · abre segunda às 11:00",
    });
  });

  it("entende horário que passa da meia-noite", () => {
    const night = DEFAULT_OPENING_HOURS.map(() => ({
      enabled: true,
      open: "18:00",
      close: "02:00",
    }));
    expect(getStoreStatus(night, friday("23:00")).open).toBe(true);
    expect(getStoreStatus(night, friday("01:00")).open).toBe(true);
    expect(getStoreStatus(night, friday("03:00")).open).toBe(false);
  });

  it("formata o telefone enquanto o cliente digita", () => {
    expect(formatPhone("11988887777")).toBe("(11) 98888-7777");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
    expect(formatPhone("119")).toBe("(11) 9");
    expect(formatPhone("")).toBe("");
  });

  it("compara os dois campos de e-mail", () => {
    expect(isSameEmail(" Ana@Teste.com", "ana@teste.com ")).toBe(true);
    expect(isSameEmail("ana@teste.com", "ana@teste.con")).toBe(false);
    expect(isSameEmail("", "")).toBe(false);
  });

  it("limita pedidos por janela de tempo", () => {
    const allow = createRateLimiter(2, 1000);
    expect(allow("ip", 0)).toBe(true);
    expect(allow("ip", 1)).toBe(true);
    expect(allow("ip", 2)).toBe(false);
    expect(allow("outro", 2)).toBe(true);
    expect(allow("ip", 1500)).toBe(true);
    expect(clientIp({ headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } })).toBe(
      "1.1.1.1"
    );
  });

  it("envia nome, telefone e itens ao Mercado Pago", () => {
    expect(
      buildPayerDetails({
        payer: {
          email: EMAIL,
          name: "Ana Maria Souza",
          phone: "5511988887777",
        },
        items: [{ id: 3, title: "Marmita", quantity: 2, unitPrice: 24.9 }],
      })
    ).toEqual({
      payer: { email: EMAIL, first_name: "Ana", last_name: "Maria Souza" },
      additional_info: {
        payer: {
          first_name: "Ana",
          last_name: "Maria Souza",
          phone: { area_code: "11", number: "988887777" },
        },
        items: [{ id: "3", title: "Marmita", quantity: 2, unit_price: 24.9 }],
      },
    });
  });
});

describe("fila da cozinha", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exclui o pedido da cozinha sem apagar o registro", async () => {
    const created = await caller().orders.create({
      ...guestOrder,
      companySlug: "loja-completa",
      paymentMethod: "cash_on_delivery",
    });
    await admin().orders.remove({ id: created.orderId! });
    const found = await caller().orders.byId({
      companySlug: "loja-completa",
      id: created.orderId!,
    });
    expect(found?.order.status).toBe("cancelled");
    await expect(admin().orders.remove({ id: 999999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  const admin = () =>
    appRouter.createCaller({
      user: { id: 1, email: "dono@teste.com", role: "admin", companyId: -1 },
      req: { protocol: "https", headers: {} },
      res: {},
    } as unknown as TrpcContext);
  const queue = async () =>
    (await admin().orders.recent({ limit: 100 })).map(({ order }) => order.id);

  it("só mostra pedido online depois de pago", async () => {
    const orderId = await orderWithPendingPix();
    expect(await queue()).not.toContain(orderId);
    await expect(
      admin().orders.advanceStatus({ id: orderId, status: "preparing" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    mp.getPayment.mockResolvedValueOnce({ status: "approved" });
    await expect(
      caller().payments.syncPending({ companySlug: "loja-teste", orderId })
    ).resolves.toEqual({ paymentStatus: "approved" });
    expect(await queue()).toContain(orderId);
  });

  it("mantém o pedido pendente enquanto o Pix não é pago", async () => {
    const orderId = await orderWithPendingPix();
    mp.getPayment.mockResolvedValueOnce({ status: "pending" });
    await expect(
      caller().payments.syncPending({ companySlug: "loja-teste", orderId })
    ).resolves.toEqual({ paymentStatus: "pending" });
    expect(await queue()).not.toContain(orderId);
  });

  it("pedido pago na entrega vai direto para a fila", async () => {
    const created = await caller().orders.create({
      ...guestOrder,
      companySlug: "loja-completa",
      paymentMethod: "cash_on_delivery",
    });
    expect(await queue()).toContain(created.orderId);
  });
});

describe("pedido pelo WhatsApp", () => {
  const KEY = "chave-de-teste-do-robo";
  const robot = (key = KEY) =>
    appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: { "x-bot-key": key } },
      res: {},
    } as unknown as TrpcContext);
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = KEY;
  });

  it("recusa quem não tem a chave do robô", async () => {
    await expect(
      robot("errada-com-o-mesmo-tamanho").bot.quote({
        companyId: -1,
        items: [{ menuItemId: 1, quantity: 1 }],
        fulfillment: "pickup",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
