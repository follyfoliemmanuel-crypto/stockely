import { and, eq, isNull } from "drizzle-orm";

import { assertCsrf, requireAuth } from "@/server/auth/context";
import { clearRequestWarehouseCookie } from "@/server/auth/warehouse";
import { getDb } from "@/server/db";
import { memberships, sessions, shops } from "@/server/db/schema";
import { ApiError, jsonOk, readJson, route } from "@/server/http";
import { effectivePermissions } from "@/server/permissions";
import { switchShopSchema } from "@/server/validation/auth";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertCsrf(request, context);

  const { shopId } = await readJson(request, switchShopSchema);

  const rows = await getDb()
    .select({ shop: shops, membership: memberships })
    .from(memberships)
    .innerJoin(shops, eq(shops.id, memberships.shopId))
    .where(
      and(
        eq(memberships.userId, context.user.id),
        eq(memberships.shopId, shopId),
        isNull(shops.archivedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    // On ne révèle pas si la boutique existe : simple refus d'accès.
    throw new ApiError(404, "shop_not_found", "Boutique introuvable.");
  }

  await getDb()
    .update(sessions)
    .set({ activeShopId: row.shop.id })
    .where(eq(sessions.id, context.session.id));

  // L'entrepôt actif appartenait à la boutique précédente.
  await clearRequestWarehouseCookie();

  const permissions = effectivePermissions(
    row.membership.role,
    row.membership.permissionOverrides,
  );

  return jsonOk({
    shop: {
      id: row.shop.id,
      name: row.shop.name,
      slug: row.shop.slug,
      currency: row.shop.currency,
      timezone: row.shop.timezone,
    },
    role: row.membership.role,
    permissions: [...permissions].sort(),
  });
});
