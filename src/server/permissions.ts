import type { MemberRole } from "@/server/db/schema";

/** Liste exhaustive des permissions contrôlées côté serveur. */
export const PERMISSIONS = [
  "dashboard.read",
  "shop.read",
  "shop.write",
  "products.read",
  "products.write",
  "categories.read",
  "categories.write",
  "suppliers.read",
  "suppliers.write",
  "customers.read",
  "customers.write",
  "stock.read",
  "stock.write",
  "warehouses.read",
  "warehouses.write",
  "transfers.read",
  "transfers.create",
  "transfers.ship",
  "transfers.receive",
  "transfers.cancel",
  "sales.read",
  "sales.create",
  "sales.cancel",
  "discounts.apply",
  "purchases.read",
  "purchases.write",
  "reports.read",
  "reports.export",
  "notifications.read",
  "audit.read",
  "settings.read",
  "settings.write",
  "users.read",
  "users.write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const READ_ONLY: readonly Permission[] = PERMISSIONS.filter((permission) =>
  permission.endsWith(".read"),
);

const ROLE_PERMISSIONS: Record<MemberRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS,
  stock_manager: [
    "dashboard.read",
    "shop.read",
    "products.read",
    "products.write",
    "categories.read",
    "categories.write",
    "suppliers.read",
    "suppliers.write",
    "customers.read",
    "stock.read",
    "stock.write",
    "warehouses.read",
    "warehouses.write",
    "transfers.read",
    "transfers.create",
    "transfers.ship",
    "transfers.receive",
    "transfers.cancel",
    "purchases.read",
    "purchases.write",
    "reports.read",
    "reports.export",
    "notifications.read",
    "audit.read",
  ],
  warehouse_keeper: [
    "dashboard.read",
    "shop.read",
    "products.read",
    "stock.read",
    "stock.write",
    "warehouses.read",
    "transfers.read",
    "transfers.create",
    "transfers.ship",
    "transfers.receive",
    "notifications.read",
  ],
  cashier: [
    "dashboard.read",
    "shop.read",
    "products.read",
    "customers.read",
    "customers.write",
    "stock.read",
    "warehouses.read",
    "sales.read",
    "sales.create",
    "notifications.read",
  ],
  accountant: [
    "dashboard.read",
    "shop.read",
    "products.read",
    "categories.read",
    "suppliers.read",
    "customers.read",
    "stock.read",
    "warehouses.read",
    "transfers.read",
    "sales.read",
    "purchases.read",
    "reports.read",
    "reports.export",
    "audit.read",
    "notifications.read",
  ],
  viewer: READ_ONLY,
};

/**
 * Calcule les permissions effectives d'un membre.
 * Les surcharges individuelles (jsonb) ajoutent ou retirent une permission.
 * Un propriétaire conserve toujours l'intégralité des droits.
 */
export function effectivePermissions(
  role: MemberRole,
  overrides: Record<string, boolean> | null | undefined,
): Set<Permission> {
  const base = new Set<Permission>(ROLE_PERMISSIONS[role]);

  if (role === "owner") return base;

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (!(PERMISSIONS as readonly string[]).includes(key)) continue;
      if (value) base.add(key as Permission);
      else base.delete(key as Permission);
    }
  }

  return base;
}

export function hasPermission(
  permissions: ReadonlySet<Permission>,
  permission: Permission,
): boolean {
  return permissions.has(permission);
}

export function roleLabel(role: MemberRole): string {
  switch (role) {
    case "owner":
      return "Propriétaire";
    case "admin":
      return "Administrateur";
    case "stock_manager":
      return "Gestionnaire de stock";
    case "warehouse_keeper":
      return "Magasinier";
    case "cashier":
      return "Caissier";
    case "accountant":
      return "Comptable";
    case "viewer":
      return "Consultation";
  }
}
