import { describe, expect, it } from "vitest";
import { buildTestCompany, isTestMode } from "./testData";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function publicContext(): TrpcContext {
  return { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("test fixtures (NODE_ENV=test)", () => {
  it("is active only under NODE_ENV=test", () => {
    expect(isTestMode()).toBe(true);
  });

  it("picks the template from the slug itself, defaulting to premium", () => {
    expect(buildTestCompany("cover").templateId).toBe("cover");
    expect(buildTestCompany("modern").templateId).toBe("modern");
    expect(buildTestCompany("minha-marmitaria").templateId).toBe("premium");
  });

  it("uses a deterministic company fixture in unit tests", async () => {
    const caller = appRouter.createCaller(publicContext());
    const company = await caller.company.bySlug({ slug: "premium" });
    expect(company).toMatchObject({ slug: "premium", templateId: "premium", status: "active" });
  });
});
