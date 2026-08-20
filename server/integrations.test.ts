import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ownerContext(): TrpcContext {
  process.env.OWNER_EMAIL = "owner@example.com";
  return {
    user: { id: 1, supabaseUserId: "owner-tester", name: "Owner", email: "owner@example.com", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("integration status", () => {
  it("exposes safe configuration status without returning secret values", async () => {
    const result = await appRouter.createCaller(ownerContext()).integrations.status();
    expect(result.mercadopago).toMatchObject({ connected: expect.any(Boolean) });
    expect(result.ninetyNineDelivery.connected).toBe(false);
    expect(JSON.stringify(result)).not.toContain("ACCESS_TOKEN");
    expect(JSON.stringify(result)).not.toMatch(/access[_-]?token/i);
  });
});
