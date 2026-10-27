import {
  assertCsrf,
  requireAuth,
  requirePermission,
} from "@/server/auth/context";
import {
  assertSameOrigin,
  jsonOk,
  readJson,
  route,
} from "@/server/http";
import { createSupplier } from "@/server/services/suppliers";
import { supplierSchema } from "@/server/validation/contacts";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "suppliers.write");

  const input = await readJson(request, supplierSchema);
  const supplier = await createSupplier(context, input);
  return jsonOk(supplier, 201);
});
