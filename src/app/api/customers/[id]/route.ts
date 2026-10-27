import {
  assertCsrf,
  requireAuth,
  requirePermission,
} from "@/server/auth/context";
import {
  assertSameOrigin,
  assertUuidParam,
  jsonOk,
  readJson,
  route,
} from "@/server/http";
import { deleteCustomer, updateCustomer } from "@/server/services/customers";
import { customerSchema } from "@/server/validation/contacts";

export const dynamic = "force-dynamic";

export const PATCH = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const context = await requireAuth();
    assertSameOrigin(request);
    assertCsrf(request, context);
    requirePermission(context, "customers.write");

    const { id } = await params;
    assertUuidParam(id, "Client");
    const input = await readJson(request, customerSchema);
    await updateCustomer(context, id, input);

    return jsonOk({ updated: true });
  },
);

export const DELETE = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const context = await requireAuth();
    assertSameOrigin(request);
    assertCsrf(request, context);
    requirePermission(context, "customers.write");

    const { id } = await params;
    assertUuidParam(id, "Client");
    await deleteCustomer(context, id);

    return jsonOk({ deleted: true });
  },
);
