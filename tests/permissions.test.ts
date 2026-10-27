import { describe, expect, it } from "vitest";

import {
  PERMISSIONS,
  effectivePermissions,
  hasPermission,
  roleLabel,
} from "@/server/permissions";

describe("matrice de permissions", () => {
  it("donne tous les droits au propriétaire", () => {
    const permissions = effectivePermissions("owner", null);
    expect(permissions.size).toBe(PERMISSIONS.length);
    for (const permission of PERMISSIONS) {
      expect(hasPermission(permissions, permission)).toBe(true);
    }
  });

  it("interdit au caissier les modifications de produits et de stock", () => {
    const permissions = effectivePermissions("cashier", null);
    expect(hasPermission(permissions, "sales.create")).toBe(true);
    expect(hasPermission(permissions, "products.read")).toBe(true);
    expect(hasPermission(permissions, "products.write")).toBe(false);
    expect(hasPermission(permissions, "stock.write")).toBe(false);
    expect(hasPermission(permissions, "users.write")).toBe(false);
    expect(hasPermission(permissions, "audit.read")).toBe(false);
  });

  it("limite le rôle consultation aux lectures", () => {
    const permissions = effectivePermissions("viewer", null);
    for (const permission of permissions) {
      expect(permission.endsWith(".read")).toBe(true);
    }
  });

  it("applique les surcharges individuelles dans les deux sens", () => {
    const permissions = effectivePermissions("cashier", {
      "discounts.apply": true,
      "sales.read": false,
      "permission.inconnue": true,
    });

    expect(hasPermission(permissions, "discounts.apply")).toBe(true);
    expect(hasPermission(permissions, "sales.read")).toBe(false);
    expect(permissions.size).toBeLessThanOrEqual(PERMISSIONS.length);
  });

  it("ignore les surcharges pour un propriétaire", () => {
    const permissions = effectivePermissions("owner", { "users.write": false });
    expect(hasPermission(permissions, "users.write")).toBe(true);
  });

  it("expose un libellé français pour chaque rôle", () => {
    expect(roleLabel("owner")).toBe("Propriétaire");
    expect(roleLabel("stock_manager")).toBe("Gestionnaire de stock");
  });
});
