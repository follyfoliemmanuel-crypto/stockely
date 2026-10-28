import {
  requireAuth,
  requirePermission,
} from "@/server/auth/context";
import { ApiError, jsonOk, route } from "@/server/http";
import { getTransfer } from "@/server/services/transfers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = route(async (_request: Request, { params }: RouteParams) => {
  const context = await requireAuth();
  requirePermission(context, "transfers.read");

  const { id } = await params;
  const transfer = await getTransfer(context, id);

  if (!transfer) {
    throw new ApiError(404, "transfer_not_found", "Transfert introuvable.");
  }

  return jsonOk({ transfer });
});
