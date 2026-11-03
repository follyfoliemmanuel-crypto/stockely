import { assertCsrf, requireAuth, requirePermission } from "@/server/auth/context";
import { buildAssistantContext } from "@/server/ai/context";
import { chatCompletion, isAiConfigured } from "@/server/ai/client";
import { buildAssistantMessages } from "@/server/ai/prompts";
import { assertAiAllowed, recordAiRequest } from "@/server/ai/rate-limit";
import { ApiError, assertSameOrigin, jsonOk, readJson, route } from "@/server/http";
import { aiChatSchema } from "@/server/validation/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Assistant conversationnel adossé aux données de la boutique active.
 * La clé du fournisseur reste côté serveur ; le contexte est reconstruit à
 * chaque requête à partir de la session, jamais fourni par le client.
 */
export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "dashboard.read");

  if (!isAiConfigured()) {
    throw new ApiError(
      503,
      "ai_not_configured",
      "L'assistant IA n'est pas configuré sur cette installation.",
    );
  }

  const input = await readJson(request, aiChatSchema);
  await assertAiAllowed(context.user.id);

  const snapshot = await buildAssistantContext(context);
  const messages = buildAssistantMessages(snapshot, input.messages);

  await recordAiRequest(context.user.id);
  const result = await chatCompletion({ messages, maxTokens: 700 });

  return jsonOk({ reply: result.content, model: result.model });
});
