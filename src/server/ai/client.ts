import { getEnv } from "@/lib/env";
import { ApiError } from "@/server/http";

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChatResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}

interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const REQUEST_TIMEOUT_MS = 55_000;
const MAX_COMPLETION_TOKENS = 900;

/** Retourne la configuration IA, ou null si aucune clé n'est renseignée. */
export function getAiConfig(): AiConfig | null {
  const env = getEnv();
  if (!env.ITERACOMPUTE_API_KEY) return null;
  return {
    apiKey: env.ITERACOMPUTE_API_KEY,
    baseUrl: env.ITERACOMPUTE_BASE_URL,
    model: env.ITERACOMPUTE_MODEL,
  };
}

export function isAiConfigured(): boolean {
  return Boolean(getEnv().ITERACOMPUTE_API_KEY);
}

function assertConfigured(): AiConfig {
  const config = getAiConfig();
  if (!config) {
    throw new ApiError(
      503,
      "ai_not_configured",
      "L'assistant IA n'est pas configuré sur cette installation.",
    );
  }
  return config;
}

function providerError(status: number): ApiError {
  // Le corps renvoyé par le fournisseur peut contenir des détails internes :
  // on ne le journalise ni ne le transmet au navigateur.
  if (status === 429) {
    return new ApiError(
      429,
      "ai_rate_limited",
      "L'assistant IA est très sollicité. Réessayez dans quelques instants.",
    );
  }
  if (status === 401 || status === 403) {
    console.warn("[stockely] IA : clé refusée par le fournisseur", { status });
    return new ApiError(
      503,
      "ai_not_configured",
      "L'assistant IA n'est pas correctement configuré.",
    );
  }
  if (status === 400) {
    return new ApiError(
      400,
      "ai_invalid_request",
      "La demande envoyée à l'assistant est invalide.",
    );
  }
  return new ApiError(
    503,
    "ai_unavailable",
    "L'assistant IA est momentanément indisponible. Réessayez plus tard.",
  );
}

/**
 * Appelle l'API IteraCompute (compatible OpenAI).
 * La clé ne quitte jamais le serveur et n'apparaît dans aucun journal.
 */
export async function chatCompletion(input: {
  messages: AiChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<AiChatResult> {
  const config = assertConfigured();

  const body: Record<string, unknown> = {
    model: config.model,
    messages: input.messages,
    max_tokens: Math.min(
      MAX_COMPLETION_TOKENS,
      Math.max(64, input.maxTokens ?? 600),
    ),
    temperature: input.temperature ?? 0.2,
  };

  // Qwen3.8 expose une phase de raisonnement activée par défaut. Pour un
  // assistant de gestion, une réponse directe est plus rapide et moins
  // coûteuse en jetons. Les autres modèles ne reçoivent pas ce paramètre.
  if (config.model.startsWith("qwen/")) {
    body.chat_template_kwargs = { enable_thinking: false };
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.warn("[stockely] IA : appel fournisseur impossible", { name });
    throw new ApiError(
      503,
      "ai_unavailable",
      "L'assistant IA est momentanément indisponible. Réessayez plus tard.",
    );
  }

  if (!response.ok) {
    // Le corps est consommé puis ignoré : il ne doit pas fuiter dans les logs.
    await response.text().catch(() => undefined);
    throw providerError(response.status);
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        choices?: Array<{ message?: { content?: unknown } }>;
        usage?: {
          prompt_tokens?: unknown;
          completion_tokens?: unknown;
          total_tokens?: unknown;
        };
      }
    | null;

  const rawContent = payload?.choices?.[0]?.message?.content;
  const content = typeof rawContent === "string" ? rawContent.trim() : "";

  if (!content) {
    console.warn("[stockely] IA : réponse vide du fournisseur");
    throw new ApiError(
      502,
      "ai_empty_response",
      "L'assistant IA n'a pas renvoyé de réponse. Réessayez.",
    );
  }

  const usage = payload?.usage;
  return {
    content,
    model: config.model,
    usage:
      usage &&
      typeof usage.prompt_tokens === "number" &&
      typeof usage.completion_tokens === "number" &&
      typeof usage.total_tokens === "number"
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : null,
  };
}
