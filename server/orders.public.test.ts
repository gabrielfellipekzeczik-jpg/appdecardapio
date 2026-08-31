import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function publicContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("public orders contract", () => {
  it("returns an array for customer history without authentication", async () => {
    const caller = appRouter.createCaller(publicContext());
    const result = await caller.orders.history({ companySlug: "empresa-inexistente", phone: "11999999999" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects an incomplete order payload before persistence", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.orders.create({ companySlug: "empresa-inexistente", name: "A", phone: "1", address: "", subtotal: 1, deliveryFee: 0, total: 1, items: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
