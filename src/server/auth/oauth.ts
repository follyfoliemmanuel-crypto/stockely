import { createHash, randomBytes } from "node:crypto";

import { getEnv } from "@/lib/env";

export const OAUTH_STATE_COOKIE = "stockely_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "stockely_oauth_verifier";
const OAUTH_COOKIE_MAX_AGE = 10 * 60; // 10 minutes

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
}

/**
 * Valide une URI de redirection Google.
 * Renvoie la raison du refus, ou `null` si l'URI est acceptable.
 */
export function validateGoogleRedirectUri(
  redirectUri: string,
  nodeEnv: string,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    return "URL invalide";
  }

  // Une URI mal configurée pourrait envoyer le code OAuth vers un autre
  // service : on n'accepte que le chemin de callback prévu.
  if (!parsed.pathname.endsWith("/api/auth/google/callback")) {
    return "le chemin doit être /api/auth/google/callback";
  }

  if (nodeEnv === "production" && parsed.protocol !== "https:") {
    return "HTTPS requis en production";
  }

  return null;
}

/**
 * Détermine l'URI de redirection réellement utilisée.
 *
 * `GOOGLE_REDIRECT_URI` peut conserver une ancienne valeur (par exemple
 * `http://localhost:3000/...`) dans les variables de l'hébergeur. Une telle
 * valeur est refusée, puis on retombe sur l'URL publique `APP_URL`, seule
 * source vérifiée de l'application.
 */
export function resolveGoogleRedirectUri(input: {
  appUrl: string;
  configured?: string | null;
  nodeEnv: string;
}): string | null {
  const appUrl = input.appUrl.replace(/\/+$/, "");
  const fromAppUrl = `${appUrl}/api/auth/google/callback`;
  const configured = input.configured?.trim() || null;

  const candidates =
    configured && configured !== fromAppUrl
      ? [configured, fromAppUrl]
      : [fromAppUrl];

  for (const redirectUri of candidates) {
    const problem = validateGoogleRedirectUri(redirectUri, input.nodeEnv);
    if (!problem) return redirectUri;
    console.warn(
      `[stockely] GOOGLE_REDIRECT_URI ignorée (${problem}) : ${redirectUri}`,
    );
  }

  return null;
}

export function getGoogleConfig(): GoogleConfig | null {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;

  const redirectUri = resolveGoogleRedirectUri({
    appUrl: env.APP_URL,
    configured: env.GOOGLE_REDIRECT_URI,
    nodeEnv: env.NODE_ENV,
  });

  if (!redirectUri) {
    console.warn("[stockely] connexion Google désactivée : URI de redirection invalide");
    return null;
  }

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  };
}

export function generateOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeVerifier(): string {
  return randomBytes(48).toString("base64url");
}

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildGoogleAuthUrl(
  config: GoogleConfig,
  state: string,
  challenge: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(
  config: GoogleConfig,
  code: string,
  verifier: string,
): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Échange du code Google refusé (${response.status})`);
  }

  const payload = (await response.json().catch(() => null)) as {
    access_token?: unknown;
    token_type?: unknown;
  } | null;

  if (
    !payload ||
    typeof payload.access_token !== "string" ||
    payload.access_token.length < 8 ||
    payload.access_token.length > 4_096 ||
    (payload.token_type !== undefined && payload.token_type !== "Bearer")
  ) {
    throw new Error("Réponse Google invalide");
  }

  return payload.access_token;
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Profil Google indisponible (${response.status})`);
  }

  const payload = (await response.json().catch(() => null)) as {
    sub?: unknown;
    email?: unknown;
    email_verified?: unknown;
    name?: unknown;
    given_name?: unknown;
    picture?: unknown;
  } | null;

  if (
    !payload ||
    typeof payload.sub !== "string" ||
    !/^[A-Za-z0-9._-]{1,255}$/.test(payload.sub) ||
    typeof payload.email !== "string" ||
    payload.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
    payload.email_verified !== true
  ) {
    throw new Error("Profil Google incomplet ou invalide");
  }

  const rawName =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name
      : typeof payload.given_name === "string"
        ? payload.given_name
        : (payload.email.split("@")[0] ?? "Utilisateur");
  const name =
    rawName.replace(/\p{Cc}/gu, "").trim().slice(0, 120) || "Utilisateur";

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name,
    picture: normalizePictureUrl(payload.picture),
  };
}

function normalizePictureUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function oauthCookieOptions() {
  const env = getEnv();
  return {
    httpOnly: true,
    secure: env.APP_URL.startsWith("https://") || env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
  };
}
