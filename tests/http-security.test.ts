import { describe, expect, it } from "vitest";
import { z } from "zod";

import { isUuid } from "@/lib/uuid";
import {
  ApiError,
  assertUuidParam,
  boundedQuery,
  getClientIp,
  readJson,
  readQuery,
  toErrorResponse,
} from "@/server/http";
import {
  googleCallbackQuerySchema,
  googleCallbackSchema,
} from "@/server/validation/auth";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function jsonRequest(
  body: string,
  headers: Record<string, string> = { "content-type": "application/json" },
): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    body,
    headers,
  });
}

describe("validation des entrées HTTP", () => {
  it("accepte un UUID canonique et refuse tout le reste", () => {
    expect(isUuid(VALID_UUID)).toBe(true);
    expect(isUuid(VALID_UUID.toUpperCase())).toBe(true);
    expect(isUuid("1")).toBe(false);
    expect(isUuid("' OR 1=1 --")).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(assertUuidParam(VALID_UUID)).toBe(VALID_UUID);
    expect(() => assertUuidParam("pas-un-uuid", "Produit")).toThrowError(
      /Produit invalide/,
    );
  });

  it("tronque les recherches libres", () => {
    expect(boundedQuery("  abc  ")).toBe("abc");
    expect(boundedQuery("x".repeat(500))).toHaveLength(100);
    expect(boundedQuery("x".repeat(500), 8)).toHaveLength(8);
    expect(boundedQuery(null)).toBe("");
  });

  it("valide la query string avec un schéma explicite", () => {
    const request = new Request(
      "http://localhost/api/test?q=clavier&page=2&q=ignor%C3%A9",
    );
    expect(
      readQuery(
        request,
        z.object({
          q: z.string().max(100).optional(),
          page: z.coerce.number().int().min(1).catch(1),
        }),
      ),
    ).toEqual({ q: "clavier", page: 2 });

    expect(() =>
      readQuery(new Request("http://localhost/api/test?q=ok"), z.object({})),
    ).not.toThrow();

    expect(
      readQuery(
        new Request("http://localhost/api/test?error=access_denied"),
        googleCallbackQuerySchema,
      ),
    ).toEqual({ error: "access_denied" });
  });

  it("refuse une query string démesurée", () => {
    const request = new Request(
      `http://localhost/api/test?q=${"x".repeat(5_000)}`,
    );
    expect(() => readQuery(request, z.object({ q: z.string() }))).toThrowError(
      /Paramètres de requête invalides/,
    );
  });

  it("refuse un corps non JSON avec 415", async () => {
    await expect(
      readJson(jsonRequest("name=test", { "content-type": "application/x-www-form-urlencoded" }), z.object({})),
    ).rejects.toMatchObject({ status: 415, code: "unsupported_media_type" });
  });

  it("refuse un corps annoncé trop volumineux avec 413", async () => {
    await expect(
      readJson(
        jsonRequest(`{"name":"x"}`, {
          "content-type": "application/json",
          "content-length": String(300 * 1024),
        }),
        z.object({ name: z.string() }),
      ),
    ).rejects.toMatchObject({ status: 413, code: "payload_too_large" });
  });

  it("refuse un corps réellement trop volumineux même sans Content-Length fiable", async () => {
    const body = JSON.stringify({ name: "x".repeat(300 * 1024) });
    await expect(
      readJson(
        jsonRequest(body, {
          "content-type": "application/json",
          "content-length": "1",
        }),
        z.object({ name: z.string() }),
      ),
    ).rejects.toMatchObject({ status: 413, code: "payload_too_large" });
  });

  it("refuse un JSON syntaxiquement invalide avec 400", async () => {
    await expect(
      readJson(jsonRequest("{not-json"), z.object({})),
    ).rejects.toMatchObject({ status: 400, code: "invalid_json" });
  });

  it("applique le schéma Zod après lecture", async () => {
    await expect(
      readJson(jsonRequest(`{"name":"ok"}`), z.object({ name: z.string().max(1) })),
    ).rejects.toMatchObject({ name: "ZodError" });

    await expect(
      readJson(jsonRequest(`{"name":"ok"}`), z.object({ name: z.string().max(5) })),
    ).resolves.toEqual({ name: "ok" });
  });

  it("ne divulgue pas les détails d'une erreur serveur", async () => {
    const response = toErrorResponse(
      new ApiError(500, "internal_error", "Échec", { database: "secret" }),
    );
    const body = (await response.json()) as {
      error: { code: string; details?: unknown };
    };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("internal_error");
    expect(body.error.details).toBeUndefined();
  });

  it("ne divulgue pas non plus les détails internes d'une erreur 4xx", async () => {
    const response = toErrorResponse(
      new ApiError(422, "invalid_category", "Catégorie introuvable.", {
        query: "select * from products",
      }),
    );
    const body = (await response.json()) as {
      error: { code: string; details?: unknown };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("invalid_category");
    expect(body.error.details).toBeUndefined();
  });

  it("privilégie les en-têtes d'hébergement pour l'adresse IP", () => {
    const previous = process.env.VERCEL;
    process.env.VERCEL = "1";
    try {
      const request = new Request("http://localhost/", {
        headers: {
          "x-vercel-forwarded-for": "203.0.113.10",
          "x-forwarded-for": "198.51.100.7, 10.0.0.1",
        },
      });
      expect(getClientIp(request)).toBe("203.0.113.10");
    } finally {
      if (previous === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previous;
    }

    const spoofed = new Request("http://localhost/", {
      headers: {
        "cf-connecting-ip": "203.0.113.99",
        "x-forwarded-for": "198.51.100.7",
      },
    });
    expect(getClientIp(spoofed)).toBe("unknown");

    const unknown = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "invalid" },
    });
    expect(getClientIp(unknown)).toBe("unknown");
  });

  it("accepte un port dans X-Forwarded-For lorsque le proxy est déclaré", () => {
    const previous = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = "true";
    try {
      const request = new Request("http://localhost/", {
        headers: { "x-forwarded-for": "198.51.100.7:4321" },
      });
      expect(getClientIp(request)).toBe("198.51.100.7");
    } finally {
      if (previous === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = previous;
    }
  });
});

describe("paramètres du callback Google", () => {
  const state = "a".repeat(43);
  const code = "4/0AbCdEfGhIjKlMnOpQrStUvWxYz";

  it("accepte des paramètres conformes", () => {
    expect(googleCallbackSchema.safeParse({ state, code }).success).toBe(true);
  });

  it("refuse un state trop court ou mal formé", () => {
    expect(googleCallbackSchema.safeParse({ state: "court", code }).success).toBe(false);
    expect(
      googleCallbackSchema.safeParse({ state: `${"a".repeat(42)}!`, code }).success,
    ).toBe(false);
  });

  it("refuse un code trop long ou contenant des caractères de contrôle", () => {
    expect(
      googleCallbackSchema.safeParse({ state, code: "a".repeat(2_049) }).success,
    ).toBe(false);
    expect(
      googleCallbackSchema.safeParse({ state, code: "abc\ndefghij" }).success,
    ).toBe(false);
  });
});
