import { assertCsrf, requireAuth, requirePermission } from "@/server/auth/context";
import { chatCompletion, isAiConfigured } from "@/server/ai/client";
import { buildProductDescriptionMessages } from "@/server/ai/prompts";
import { assertAiAllowed, recordAiRequest } from "@/server/ai/rate-limit";
import { ApiError, assertSameOrigin, jsonOk, readJson, route } from "@/server/http";
import { aiProductDescriptionSchema } from "@/server/validation/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Aide à la saisie : propose une description factuelle à partir du nom du
 * produit. L'utilisateur reste libre de la modifier avant enregistrement.
 */
export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "products.write");

  if (!isAiConfigured()) {
    throw new ApiError(
      503,
      "ai_not_configured",
      "L'aide IA n'est pas configurée sur cette installation.",
    );
  }

  const input = await readJson(request, aiProductDescriptionSchema);
  await assertAiAllowed(context.user.id);

  const messages = buildProductDescriptionMessages({
    name: input.name,
    categoryName: input.categoryName ?? null,
    currency: context.shop.currency,
    priceCents: input.priceCents ?? null,
  });

  await recordAiRequest(context.user.id);
  const result = await chatCompletion({
    messages,
    maxTokens: 220,
    temperature: 0.4,
  });

  const description = result.content
    .replace(/^["«\s]+|["»\s]+$/g, "")
    .slice(0, 600)
    .trim();

  if (!description) {
    throw new ApiError(
      502,
      "ai_empty_response",
      "L'aide IA n'a pas renvoyé de description. Réessayez.",
    );
  }

  return jsonOk({ description });
});
