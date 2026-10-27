import { cookies } from "next/headers";

import type { AuthContext } from "@/server/auth/context";
import type { Warehouse } from "@/server/db/schema";
import {
  WAREHOUSE_COOKIE,
  resolveWarehouse,
} from "@/server/services/warehouses";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Lit l'entrepôt de travail choisi, sans le considérer comme fiable. */
export async function getRequestWarehouseId(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(WAREHOUSE_COOKIE)?.value;
  return value && value.length <= 64 ? value : null;
}

/**
 * Résout l'entrepôt actif de la requête. La valeur du cookie est toujours
 * revérifiée contre les droits réels du membre avant utilisation.
 */
export async function resolveRequestWarehouse(
  context: AuthContext,
  requestedId?: string | null,
): Promise<Warehouse> {
  const id = requestedId ?? (await getRequestWarehouseId());
  return resolveWarehouse(context, id);
}

/** À appeler uniquement depuis un Route Handler ou une Server Action. */
export async function setRequestWarehouseCookie(warehouseId: string): Promise<void> {
  const jar = await cookies();
  jar.set(WAREHOUSE_COOKIE, warehouseId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
}

export async function clearRequestWarehouseCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(WAREHOUSE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
