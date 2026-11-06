import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function publicContext(accessToken?: string, user: TrpcContext["user"] = null): TrpcContext {
  return { user, req: { protocol: "https", headers: accessToken ? { "x-customer-access-token": accessToken } : {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("public orders contract", () => {
  it("blocks customer history without a private access token", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.orders.history({ companySlug: "empresa-inexistente", phone: "11999999999" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("recalculates prices from the stored menu, ignoring client-provided totals", async () => {
    const token = "11111111-1111-4111-8111-111111111111";
    const caller = appRouter.createCaller(publicContext(token, { email: "cliente@teste.com" } as TrpcContext["user"]));
    const created = await caller.orders.create({
      companySlug: "loja-teste", email: "cliente@teste.com", name: "Cliente Teste", phone: "11999999991", address: "Rua Teste", addressNumber: "10",
      items: [{ menuItemId: 1, quantity: 1 }],
      subtotal: 0.01, deliveryFee: 0, total: 0.01,
      // Estes campos enviados de propósito são ignorados pelo contrato do servidor.
      itemName: "Outro produto", unitPrice: 0.01,
    } as never);
    const order = await caller.orders.byId({ companySlug: "loja-teste", id: created.orderId! });
    expect(Number(order?.order.subtotal)).toBe(24.9);
    expect(Number(order?.order.total)).toBe(24.9);
    expect(order?.items[0]?.itemName).toBe("Caseira da semana");
    expect(created.customerTrackingToken).toMatch(/^[0-9a-f-]{36}$/i);
    const tracking = await caller.tracking.customer({ token: created.customerTrackingToken! });
    expect(tracking.orderId).toBe(created.orderId);
    expect(tracking).not.toHaveProperty("customerPhone");
  });

  it("rejects an incomplete order payload before persistence", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.orders.create({ companySlug: "empresa-inexistente", name: "A", phone: "1", address: "", addressNumber: "", subtotal: 1, deliveryFee: 0, total: 1, items: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
