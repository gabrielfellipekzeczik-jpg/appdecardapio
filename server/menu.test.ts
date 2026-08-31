import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function publicContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("public menu contract", () => {
  it("rejects an unknown company instead of leaking data", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.menu.list({ companySlug: "empresa-inexistente" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects admin dashboard summary for anonymous visitors", async () => {
    const caller = appRouter.createCaller(publicContext());
    await expect(caller.dashboard.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
