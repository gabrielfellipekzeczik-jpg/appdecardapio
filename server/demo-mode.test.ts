import { describe, expect, it } from "vitest";
import { buildDemoCompany, isDemoMode } from "./demoData";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function publicContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("demo mode (no DATABASE_URL)", () => {
  it("is active whenever there is no database configured — exactly the test environment", () => {
    expect(isDemoMode()).toBe(true);
  });

  it("picks the template from the slug itself, defaulting to premium", () => {
    expect(buildDemoCompany("cover").templateId).toBe("cover");
    expect(buildDemoCompany("modern").templateId).toBe("modern");
    expect(buildDemoCompany("minha-marmitaria").templateId).toBe("premium");
  });

  it("serves any slug as an active demo company through the public router, so every template is clickable with zero setup", async () => {
    const caller = appRouter.createCaller(publicContext());
    const company = await caller.company.bySlug({ slug: "premium" });
    expect(company).toMatchObject({ slug: "premium", templateId: "premium", status: "active" });
  });
});
