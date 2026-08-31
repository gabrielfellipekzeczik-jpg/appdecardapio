import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function companyAdminContext(): TrpcContext {
  return {
    user: { id: 1, supabaseUserId: "admin-tester", companyId: 1, name: "Admin", email: "admin@example.com", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("integration status", () => {
  it("exposes safe configuration status for the company's own admin, without leaking secret values", async () => {
    const result = await appRouter.createCaller(companyAdminContext()).integrations.status();
    expect(result.mercadopago).toMatchObject({ connected: expect.any(Boolean) });
    expect(result.ninetyNineDelivery.connected).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/access[_-]?token/i);
  });
});
