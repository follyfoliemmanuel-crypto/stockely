import { notFound, redirect } from "next/navigation";

import { getAuthContext, type AuthContext } from "@/server/auth/context";
import type { Permission } from "@/server/permissions";

/**
 * Garde de page : la session est vérifiée côté serveur et la permission
 * demandée est contrôlée avant tout chargement de données.
 * Une permission absente renvoie 404 pour ne pas révéler l'existence du module.
 */
export async function requirePage(permission?: Permission): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  if (permission && !context.permissions.has(permission)) notFound();
  return context;
}
