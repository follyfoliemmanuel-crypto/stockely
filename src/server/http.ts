import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

import { getEnv } from "@/lib/env";
import { isUuid } from "@/lib/uuid";

const MAX_JSON_BYTES = 256 * 1024;
const MAX_IP_LENGTH = 64;
const MAX_QUERY_LENGTH = 100;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, details } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/** Convertit toute erreur en réponse JSON sûre (aucun détail interne en production). */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    // Seuls les messages contrôlés par l'application sont exposés. Le champ
    // `details` reste interne : il peut contenir un contexte base de données
    // ou une valeur brute reçue du client, même sur une erreur 4xx.
    return jsonError(error.status, error.code, error.message);
  }

  if (error instanceof ZodError) {
    return jsonError(422, "validation_error", "Données invalides.", {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // Ne jamais exposer la pile ou le message brut d'une erreur serveur.
  // En production, seuls le type et le code technique sont journalisés :
  // un message PostgreSQL peut contenir des fragments de requête ou d'URL.
  const diagnostic: Record<string, string> = {
    name: error instanceof Error ? error.name : "UnknownError",
  };
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" || typeof code === "number") {
      diagnostic.code = String(code);
    }
  }
  if (process.env.NODE_ENV !== "production" && error instanceof Error) {
    diagnostic.message = error.message;
  }
  console.error("[stockely] erreur interne", diagnostic);
  return jsonError(500, "internal_error", "Une erreur interne est survenue.");
}

/**
 * Enveloppe un handler de route API : gestion homogène des erreurs,
 * interdiction de mise en cache des réponses authentifiées.
 */
export function route<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      const response = await handler(...args);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** Lit un corps de requête en mémoire avec une limite stricte. */
async function readLimitedBody(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ApiError(
          413,
          "payload_too_large",
          "Le corps de la requête est trop volumineux.",
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "invalid_body", "Impossible de lire le corps de la requête.");
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
}

/** Lit et valide le corps JSON, avec une limite de taille réelle. */
export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  // Un corps JSON est obligatoire : cela bloque les formulaires HTML
  // intersites, qui ne peuvent pas envoyer ce Content-Type sans préflight.
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json" && !contentType?.endsWith("+json")) {
    throw new ApiError(
      415,
      "unsupported_media_type",
      "Le corps de la requête doit être au format JSON.",
    );
  }

  // Première barrière sur l'en-tête annoncé.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    throw new ApiError(413, "payload_too_large", "Le corps de la requête est trop volumineux.");
  }

  // Deuxième barrière : la taille réellement lue, y compris en chunked,
  // sans jamais charger un corps démesuré en mémoire.
  const raw = await readLimitedBody(request, MAX_JSON_BYTES);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "invalid_json", "Corps JSON invalide.");
  }

  return schema.parse(payload);
}

function normalizeIp(value: string | null | undefined): string | null {
  const ip = value?.split(",")[0]?.trim();
  if (!ip || ip.length > MAX_IP_LENGTH) return null;
  if (isIP(ip) !== 0) return ip;

  // Certains proxys ajoutent un port (IPv4) ou des crochets (IPv6).
  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(ip);
  if (ipv4WithPort?.[1] && isIP(ipv4WithPort[1]) === 4) return ipv4WithPort[1];

  const ipv6WithPort = /^\[([0-9a-f:]+)\]:\d+$/i.exec(ip);
  if (ipv6WithPort?.[1] && isIP(ipv6WithPort[1]) === 6) return ipv6WithPort[1];

  return null;
}

export function getClientIp(request: Request): string {
  const candidates: Array<string | null | undefined> = [];

  // On ne fait confiance aux en-têtes de plateforme que lorsque la
  // plateforme est réellement détectée. Sinon, un client pourrait forger
  // X-Vercel-Forwarded-For ou CF-Connecting-IP pour contourner la limite.
  if (process.env.VERCEL) {
    candidates.push(
      request.headers.get("x-vercel-forwarded-for"),
      request.headers.get("x-real-ip"),
    );
  }
  if (process.env.CF_PAGES || process.env.CF_WORKER) {
    candidates.push(request.headers.get("cf-connecting-ip"));
  }
  if (process.env.TRUST_PROXY === "true") {
    candidates.push(
      request.headers.get("x-real-ip"),
      request.headers.get("x-forwarded-for")?.split(",")[0],
    );
  }

  for (const candidate of candidates) {
    const ip = normalizeIp(candidate);
    if (ip) return ip;
  }

  return "unknown";
}

/** Valide un identifiant de route avant de le passer à l'ORM. */
export function assertUuidParam(value: string, label = "Identifiant"): string {
  if (!isUuid(value)) {
    throw new ApiError(400, "invalid_id", `${label} invalide.`);
  }
  return value;
}

/** Tronque une recherche libre pour éviter les motifs ILIKE démesurés. */
export function boundedQuery(value: string | null | undefined, max = MAX_QUERY_LENGTH): string {
  return (value ?? "").trim().slice(0, max);
}

const MAX_QUERY_PARAM_LENGTH = 4_096;
const MAX_QUERY_PARAM_COUNT = 32;

/**
 * Lit la query string et la valide avec un schéma Zod explicite.
 * Aucun paramètre brut n'atteint la logique métier : la première valeur de
 * chaque clé est conservée, les clés inconnues sont ignorées par Zod.
 */
export function readQuery<T>(request: Request, schema: ZodType<T>): T {
  const url = new URL(request.url);
  // Objet sans prototype : une clé comme `__proto__` ne peut pas polluer
  // l'objet transmis au schéma.
  const raw = Object.create(null) as Record<string, string>;
  let count = 0;

  for (const [key, value] of url.searchParams) {
    count += 1;
    if (
      count > MAX_QUERY_PARAM_COUNT ||
      key.length > 64 ||
      value.length > MAX_QUERY_PARAM_LENGTH
    ) {
      throw new ApiError(400, "invalid_query", "Paramètres de requête invalides.");
    }
    if (!Object.hasOwn(raw, key)) raw[key] = value;
  }

  return schema.parse(raw);
}

/** Hachage HMAC des adresses IP : on ne stocke jamais l'IP en clair. */
export function hashIp(ip: string): string {
  return createHmac("sha256", getEnv().APP_SECRET).update(ip).digest("hex");
}

export function getRequestIpHash(request: Request): string {
  return hashIp(getClientIp(request));
}

/**
 * Vérifie que la requête provient bien de l'application (défense CSRF
 * complémentaire au jeton). Les clients sans en-tête Origin (tests, curl)
 * restent soumis au jeton CSRF.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const appUrl = new URL(getEnv().APP_URL);
  const allowed = new Set<string>([appUrl.origin]);
  const host = request.headers.get("host");
  if (host) {
    // Même hôte, même protocole que l'application : on évite d'accepter
    // une origine HTTP quand l'application est servie en HTTPS.
    allowed.add(`${appUrl.protocol}//${host}`);
  }

  if (!allowed.has(origin)) {
    throw new ApiError(403, "invalid_origin", "Origine de la requête non autorisée.");
  }
}

export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
