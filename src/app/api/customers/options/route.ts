import { requireAuth, requirePermission } from "@/server/auth/context";
import { boundedQuery, jsonOk, route } from "@/server/http";
import { listCustomerOptions } from "@/server/services/customers";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const context = await requireAuth();
  requirePermission(context, "customers.read");

  const q = boundedQuery(new URL(request.url).searchParams.get("q"));
  const items = await listCustomerOptions(context.shop.id, q);

  return jsonOk({ items });
});
