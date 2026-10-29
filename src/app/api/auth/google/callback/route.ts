import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  exchangeGoogleCode,
  fetchGoogleProfile,
  getGoogleConfig,
  oauthCookieOptions,
} from "@/server/auth/oauth";
import { applySessionCookies } from "@/server/auth/session";
import {
  getRequestIpHash,
  readQuery,
  route,
  safeCompare,
} from "@/server/http";
import { loginWithGoogle } from "@/server/services/oauth";
import {
  googleCallbackQuerySchema,
  googleCallbackSchema,
} from "@/server/validation/auth";

export const dynamic = "force-dynamic";

function clearOauthCookies(response: NextResponse): void {
  const options = { ...oauthCookieOptions(), maxAge: 0 };
  for (const name of [OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE]) {
    response.cookies.set(name, "", options);
  }
}

/**
 * Le code OAuth transite dans l'URL par nature (Authorization Code Flow).
 * On évite qu'il fuite via le Referer de la redirection suivante, et on
 * supprime systématiquement les cookies d'état, y compris en cas d'échec.
 */
function redirectToLogin(base: string, code: string): NextResponse {
  const response = NextResponse.redirect(new URL(`/login?error=${code}`, base));
  response.headers.set("Referrer-Policy", "no-referrer");
  clearOauthCookies(response);
  return response;
}

export const GET = route(async (request: Request) => {
  const base = getEnv().APP_URL;

  let query: ReturnType<typeof googleCallbackQuerySchema.parse>;
  try {
    query = readQuery(request, googleCallbackQuerySchema);
  } catch {
    return redirectToLogin(base, "google_failed");
  }

  // Google peut renvoyer une erreur sans code ni state : on ne fait
  // confiance à aucun de ces paramètres, on mappe vers un message fixe.
  if (query.error !== undefined) {
    return redirectToLogin(
      base,
      query.error === "access_denied" ? "google_cancelled" : "google_failed",
    );
  }

  const config = getGoogleConfig();
  if (!config) return redirectToLogin(base, "google_not_configured");

  const parsed = googleCallbackSchema.safeParse({
    state: query.state,
    code: query.code,
  });
  if (!parsed.success) return redirectToLogin(base, "google_failed");

  const { state, code } = parsed.data;
  const jar = await cookies();
  const expectedState = jar.get(OAUTH_STATE_COOKIE)?.value;
  const verifier = jar.get(OAUTH_VERIFIER_COOKIE)?.value;

  // Le state doit correspondre au cookie déposé au démarrage du flux.
  // Les longueurs sont bornées pour éviter des comparaisons inutilement
  // coûteuses si un client envoie des cookies ou paramètres démesurés.
  if (
    !expectedState ||
    !verifier ||
    expectedState.length > 256 ||
    verifier.length > 512 ||
    !safeCompare(state, expectedState)
  ) {
    return redirectToLogin(base, "google_failed");
  }

  try {
    // L'échange du code se fait uniquement côté serveur, avec PKCE.
    const accessToken = await exchangeGoogleCode(config, code, verifier);
    const profile = await fetchGoogleProfile(accessToken);

    const result = await loginWithGoogle(profile, {
      ipHash: getRequestIpHash(request),
      userAgent: request.headers.get("user-agent"),
    });

    const response = NextResponse.redirect(new URL("/dashboard", base));
    response.headers.set("Referrer-Policy", "no-referrer");
    applySessionCookies(response, result.session);
    clearOauthCookies(response);
    return response;
  } catch {
    // Aucun code, jeton, secret ou message brut du fournisseur dans les logs.
    console.error("[stockely] connexion Google refusée");
    return redirectToLogin(base, "google_failed");
  }
});
