export type ProductRole = "super_admin" | "admin" | "buyer";

export const ROLE_PERMISSIONS = {
  super_admin: ["manage_integrations", "manage_global_settings", "manage_admins"],
  admin: ["manage_orders", "manage_menu", "manage_inventory", "manage_finance", "view_dashboard"],
  buyer: ["browse_menu", "manage_cart", "checkout_without_account", "view_order_history"],
} as Record<ProductRole, readonly string[]>;

export function hasPermission(role: ProductRole, permission: string) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
