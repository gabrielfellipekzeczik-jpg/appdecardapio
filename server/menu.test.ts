import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function publicContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("public menu contract", () => {
  it("returns an array without requiring authentication", async () => {
    const caller = appRouter.createCaller(publicContext());
    const result = await caller.menu.list({ companySlug: "empresa-inexistente" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("rejects admin dashboard summary for anonymous visitors", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.dashboard.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
