import { describe, expect, it } from "vitest";
import { isSlugAvailableFormat } from "./companies";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("isSlugAvailableFormat", () => {
  it("accepts simple lowercase slugs", () => {
    expect(isSlugAvailableFormat("casa-na-marmita")).toBe(true);
    expect(isSlugAvailableFormat("marmitex")).toBe(true);
  });

  it("rejects reserved platform routes", () => {
    expect(isSlugAvailableFormat("admin-login")).toBe(false);
    expect(isSlugAvailableFormat("super-admin")).toBe(false);
    expect(isSlugAvailableFormat("cadastrar")).toBe(false);
  });

  it("rejects invalid characters or edges", () => {
    expect(isSlugAvailableFormat("Casa Na Marmita")).toBe(false);
    expect(isSlugAvailableFormat("-marmita")).toBe(false);
    expect(isSlugAvailableFormat("marmita-")).toBe(false);
    expect(isSlugAvailableFormat("")).toBe(false);
  });
});

function unauthenticatedContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("company.signUp", () => {
  it("requires an authenticated Supabase session", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.company.signUp({ name: "Marmitex", slug: "marmitex" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a reserved slug even for an authenticated user", async () => {
    const ctx: TrpcContext = {
      user: { id: 1, supabaseUserId: "new-user", companyId: null, name: "Novo", email: "novo@example.com", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.company.signUp({ name: "Marmitex", slug: "super-admin" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
