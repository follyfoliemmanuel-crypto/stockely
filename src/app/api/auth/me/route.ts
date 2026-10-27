import { and, eq, isNull } from "drizzle-orm";

import { requireAuth } from "@/server/auth/context";
import { getDb } from "@/server/db";
import { memberships, shops } from "@/server/db/schema";
import { jsonOk, route } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const context = await requireAuth();

  const available = await getDb()
    .select({
      id: shops.id,
      name: shops.name,
      slug: shops.slug,
      currency: shops.currency,
      timezone: shops.timezone,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(shops, eq(shops.id, memberships.shopId))
    .where(and(eq(memberships.userId, context.user.id), isNull(shops.archivedAt)));

  return jsonOk({
    user: {
      id: context.user.id,
      name: context.user.name,
      email: context.user.email,
    },
    shop: {
      id: context.shop.id,
      name: context.shop.name,
      slug: context.shop.slug,
      currency: context.shop.currency,
      timezone: context.shop.timezone,
    },
    role: context.role,
    permissions: [...context.permissions].sort(),
    shops: available,
  });
});
