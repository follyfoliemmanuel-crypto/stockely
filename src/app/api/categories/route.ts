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
import { createCategory } from "@/server/services/categories";
import { categorySchema } from "@/server/validation/catalog";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "categories.write");

  const input = await readJson(request, categorySchema);
  const category = await createCategory(context, input);
  return jsonOk(category, 201);
});
