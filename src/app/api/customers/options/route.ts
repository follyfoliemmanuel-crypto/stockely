import { requireAuth, requirePermission } from "@/server/auth/context";
import { boundedQuery, jsonOk, readQuery, route } from "@/server/http";
import { listCustomerOptions } from "@/server/services/customers";
import { customerOptionsQuerySchema } from "@/server/validation/contacts";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const context = await requireAuth();
  requirePermission(context, "customers.read");

  const query = readQuery(request, customerOptionsQuerySchema);
  const q = boundedQuery(query.q);
  const items = await listCustomerOptions(context.shop.id, q);

  return jsonOk({ items });
});
