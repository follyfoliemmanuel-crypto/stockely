import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";

import { getDb } from "@/server/db";
import {
  memberships,
  shops,
  sessions,
  users,
  type MemberRole,
  type Membership,
  type Session,
  type Shop,
  type User,
} from "@/server/db/schema";
import { ApiError, safeCompare } from "@/server/http";
import {
  effectivePermissions,
  hasPermission,
  type Permission,
} from "@/server/permissions";
import { SESSION_COOKIE, hashToken } from "./session";

export interface AuthContext {
  user: User;
  session: Session;
  shop: Shop;
  membership: Membership;
  role: MemberRole;
  permissions: Set<Permission>;
  csrfToken: string;
}

/**
 * Résout la session courante côté serveur.
 * La boutique active est TOUJOURS vérifiée via l'adhésion en base :
 * un identifiant de boutique fourni par le client n'est jamais utilisé tel quel.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 256) return null;

  const db = getDb();
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const available = await db
    .select({ membership: memberships, shop: shops })
    .from(memberships)
    .innerJoin(shops, eq(shops.id, memberships.shopId))
    .where(and(eq(memberships.userId, row.user.id), isNull(shops.archivedAt)))
    .orderBy(desc(memberships.createdAt));

  const chosen =
    available.find((entry) => entry.shop.id === row.session.activeShopId) ??
    available[0];

  if (!chosen) return null;

  const membership = chosen.membership;
  const role = membership.role;
  const permissions = effectivePermissions(role, membership.permissionOverrides);

  return {
    user: row.user,
    session: row.session,
    shop: chosen.shop,
    membership,
    role,
    permissions,
    csrfToken: row.session.csrfToken,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    throw new ApiError(401, "unauthenticated", "Authentification requise.");
  }
  return context;
}

export function requirePermission(
  context: AuthContext,
  permission: Permission,
): void {
  if (!hasPermission(context.permissions, permission)) {
    throw new ApiError(
      403,
      "forbidden",
      "Vous n'avez pas la permission d'effectuer cette action.",
    );
  }
}

/**
 * Vérifie le jeton CSRF lié à la session.
 * À appeler sur toute mutation (POST, PATCH, DELETE).
 */
export function assertCsrf(request: Request, context: AuthContext): void {
  const header = request.headers.get("x-csrf-token");
  if (!header || header.length > 128 || !safeCompare(header, context.csrfToken)) {
    throw new ApiError(403, "invalid_csrf", "Jeton CSRF invalide ou manquant.");
  }
}
