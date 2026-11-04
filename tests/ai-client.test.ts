import { createServer, type IncomingHttpHeaders, type Server } from "node:http";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

interface CapturedRequest {
  authorization?: string;
  body: Record<string, unknown>;
}

type Responder = (path: string, body: Record<string, unknown>) => {
  status: number;
  body: unknown;
};

let server: Server;
let baseUrl: string;
let lastRequest: CapturedRequest;
let respond: Responder;

const originalEnv = { ...process.env };

beforeAll(async () => {
  server = createServer(async (request, response) => {
    try {
      let raw = "";
      for await (const chunk of request) {
        raw += String(chunk);
      }

      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      lastRequest = {
        authorization: headerValue(request.headers, "authorization"),
        body,
      };
      const result = respond(request.url ?? "", body);
      response.writeHead(result.status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(result.body));
    } catch {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "requete de test invalide" } }));
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("port de test indisponible");
  baseUrl = `http://127.0.0.1:${address.port}/v1`;
});

afterAll(async () => {
  process.env = { ...originalEnv };
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  lastRequest = { body: {} };
  respond = () => ({
    status: 200,
    body: {
      choices: [{ message: { content: "Bonjour !" } }],
      usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
    },
  });

  process.env.ITERACOMPUTE_API_KEY = "test-key";
  process.env.ITERACOMPUTE_BASE_URL = baseUrl;
  process.env.ITERACOMPUTE_MODEL = "qwen/qwen3.8-27b";
  process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/stockely_test";
  process.env.APP_SECRET ??= "secret-de-test-suffisamment-long-pour-zod";
  process.env.APP_URL ??= "http://localhost:3000";
  vi.resetModules();
});

function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function userMessage() {
  return { messages: [{ role: "user" as const, content: "Bonjour" }] };
}

describe("client IA IteraCompute", () => {
  it("envoie la clé côté serveur et désactive le raisonnement Qwen", async () => {
    const { chatCompletion } = await import("@/server/ai/client");
    const result = await chatCompletion(userMessage());

    expect(result.content).toBe("Bonjour !");
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 3,
      totalTokens: 13,
    });
    expect(lastRequest.authorization).toBe("Bearer test-key");
    expect(lastRequest.body.model).toBe("qwen/qwen3.8-27b");
    expect(lastRequest.body.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it("traduit une limite de débit du fournisseur en 429", async () => {
    respond = () => ({ status: 429, body: { error: { message: "quota" } } });
    const { chatCompletion } = await import("@/server/ai/client");

    await expect(chatCompletion(userMessage())).rejects.toMatchObject({
      status: 429,
      code: "ai_rate_limited",
    });
  });

  it("masque une clé refusée derrière une indisponibilité", async () => {
    respond = () => ({ status: 401, body: { error: { message: "invalid key" } } });
    const { chatCompletion } = await import("@/server/ai/client");

    await expect(chatCompletion(userMessage())).rejects.toMatchObject({
      status: 503,
      code: "ai_not_configured",
    });
  });

  it("signale une réponse vide", async () => {
    respond = () => ({
      status: 200,
      body: { choices: [{ message: { content: "   " } }] },
    });
    const { chatCompletion } = await import("@/server/ai/client");

    await expect(chatCompletion(userMessage())).rejects.toMatchObject({
      status: 502,
      code: "ai_empty_response",
    });
  });

  it("répond 503 quand aucune clé n'est configurée", async () => {
    process.env.ITERACOMPUTE_API_KEY = "";
    vi.resetModules();
    const { chatCompletion } = await import("@/server/ai/client");

    await expect(chatCompletion(userMessage())).rejects.toMatchObject({
      status: 503,
      code: "ai_not_configured",
    });
  });
});
