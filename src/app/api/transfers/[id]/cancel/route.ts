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
import { cancelTransfer } from "@/server/services/transfers";
import { transferCancelSchema } from "@/server/validation/transfers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const POST = route(async (request: Request, { params }: RouteParams) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "transfers.cancel");

  const { id } = await params;
  const input = await readJson(request, transferCancelSchema);
  await cancelTransfer(context, id, input);

  return jsonOk({ success: true });
});
