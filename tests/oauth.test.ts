import { describe, expect, it } from "vitest";

import {
  buildGoogleAuthUrl,
  codeChallenge,
  generateCodeVerifier,
  generateOAuthState,
} from "@/server/auth/oauth";

describe("flux OAuth Google", () => {
  it("génère un state et un verifier aléatoires encodés en base64url", () => {
    const state = generateOAuthState();
    const verifier = generateCodeVerifier();

    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(generateOAuthState()).not.toBe(state);
    expect(generateCodeVerifier()).not.toBe(verifier);
  });

  it("calcule un challenge PKCE S256 déterministe", () => {
    expect(codeChallenge("verifier-de-test")).toBe(
      "hZ_okULX1GILYXxTFsE7pTE_s4EyNQDU64kBcZ5FiUs",
    );
    expect(codeChallenge("verifier-de-test")).toBe(codeChallenge("verifier-de-test"));
  });

  it("construit une URL d'autorisation avec PKCE et sans secret", () => {
    const url = new URL(
      buildGoogleAuthUrl(
        {
          clientId: "client-id.apps.googleusercontent.com",
          clientSecret: "ne-doit-jamais-apparaitre",
          redirectUri: "https://app.example.com/api/auth/google/callback",
        },
        "state-de-test",
        "challenge-de-test",
      ),
    );

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("state-de-test");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-de-test");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/auth/google/callback",
    );
    expect(url.toString()).not.toContain("ne-doit-jamais-apparaitre");
    expect(url.toString()).not.toContain("client_secret");
  });
});
