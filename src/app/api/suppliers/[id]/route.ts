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
import { deleteSupplier, updateSupplier } from "@/server/services/suppliers";
import { supplierSchema } from "@/server/validation/contacts";

export const dynamic = "force-dynamic";

export const PATCH = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const context = await requireAuth();
    assertSameOrigin(request);
    assertCsrf(request, context);
    requirePermission(context, "suppliers.write");

    const { id } = await params;
    assertUuidParam(id, "Fournisseur");
    const input = await readJson(request, supplierSchema);
    await updateSupplier(context, id, input);

    return jsonOk({ updated: true });
  },
);

export const DELETE = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const context = await requireAuth();
    assertSameOrigin(request);
    assertCsrf(request, context);
    requirePermission(context, "suppliers.write");

    const { id } = await params;
    assertUuidParam(id, "Fournisseur");
    await deleteSupplier(context, id);

    return jsonOk({ deleted: true });
  },
);
