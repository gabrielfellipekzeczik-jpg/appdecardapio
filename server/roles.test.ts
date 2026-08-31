import { describe, expect, it } from "vitest";
import { hasPermission } from "../shared/roles";

describe("product role matrix", () => {
  it("separates platform owner, company admin and buyer capabilities", () => {
    expect(hasPermission("super_admin", "manage_companies")).toBe(true);
    expect(hasPermission("super_admin", "manage_orders")).toBe(false);
    expect(hasPermission("admin", "manage_orders")).toBe(true);
    expect(hasPermission("admin", "manage_integrations")).toBe(true);
    expect(hasPermission("admin", "manage_companies")).toBe(false);
    expect(hasPermission("buyer", "checkout_without_account")).toBe(true);
    expect(hasPermission("buyer", "manage_finance")).toBe(false);
  });
});
