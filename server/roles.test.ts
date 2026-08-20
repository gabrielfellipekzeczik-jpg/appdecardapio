import { describe, expect, it } from "vitest";
import { hasPermission } from "../shared/roles";

describe("product role matrix", () => {
  it("separates Super Admin, Admin and Buyer capabilities", () => {
    expect(hasPermission("super_admin", "manage_integrations")).toBe(true);
    expect(hasPermission("super_admin", "manage_orders")).toBe(false);
    expect(hasPermission("admin", "manage_orders")).toBe(true);
    expect(hasPermission("admin", "manage_integrations")).toBe(false);
    expect(hasPermission("buyer", "checkout_without_account")).toBe(true);
    expect(hasPermission("buyer", "manage_finance")).toBe(false);
  });
});
