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
import { createCustomer } from "@/server/services/customers";
import { customerSchema } from "@/server/validation/contacts";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "customers.write");

  const input = await readJson(request, customerSchema);
  const customer = await createCustomer(context, input);
  return jsonOk(customer, 201);
});
