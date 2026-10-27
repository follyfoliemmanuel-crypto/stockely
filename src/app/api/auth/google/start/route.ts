import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  buildGoogleAuthUrl,
  codeChallenge,
  generateCodeVerifier,
  generateOAuthState,
  getGoogleConfig,
  oauthCookieOptions,
} from "@/server/auth/oauth";
import { route } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const base = getEnv().APP_URL;
  const config = getGoogleConfig();

  if (!config) {
    return NextResponse.redirect(
      new URL("/login?error=google_not_configured", base),
    );
  }

  const state = generateOAuthState();
  const verifier = generateCodeVerifier();
  const url = buildGoogleAuthUrl(config, state, codeChallenge(verifier));

  const response = NextResponse.redirect(url);
  const options = oauthCookieOptions();
  response.cookies.set(OAUTH_STATE_COOKIE, state, options);
  response.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, options);

  return response;
});
