import { assertCsrf, requireAuth, requirePermission } from "@/server/auth/context";
import { buildReportContext } from "@/server/ai/context";
import { chatCompletion, isAiConfigured } from "@/server/ai/client";
import { buildReportMessages } from "@/server/ai/prompts";
import { assertAiAllowed, recordAiRequest } from "@/server/ai/rate-limit";
import { resolveReportRange } from "@/lib/report-range";
import { ApiError, assertSameOrigin, jsonOk, readJson, route } from "@/server/http";
import { aiSummarySchema } from "@/server/validation/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Synthèse IA d'une période de rapport. La période est validée et bornée par
 * `resolveReportRange` ; seuls les agrégats de la boutique active sont exposés.
 */
export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "reports.read");

  if (!isAiConfigured()) {
    throw new ApiError(
      503,
      "ai_not_configured",
      "La synthèse IA n'est pas configurée sur cette installation.",
    );
  }

  const input = await readJson(request, aiSummarySchema);
  const range = resolveReportRange(input.from, input.to);

  await assertAiAllowed(context.user.id);
  const report = await buildReportContext(context, range.from, range.to);
  const messages = buildReportMessages(report, range.from, range.to);

  await recordAiRequest(context.user.id);
  const result = await chatCompletion({ messages, maxTokens: 600 });

  return jsonOk({
    summary: result.content,
    model: result.model,
    from: range.from,
    to: range.to,
  });
});
