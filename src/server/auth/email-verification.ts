import { createHmac, timingSafeEqual } from "node:crypto";

import { getEnv } from "@/lib/env";

export const EMAIL_VERIFICATION_LIFETIME_MINUTES = 24 * 60;

const LIFETIME_MS = EMAIL_VERIFICATION_LIFETIME_MINUTES * 60 * 1000;
const MAX_TOKEN_LENGTH = 1_024;
const MAX_ENCODED_LENGTH = 800;
const MAX_SIGNATURE_LENGTH = 128;
const MAX_USER_ID_LENGTH = 64;
const MAX_EMAIL_LENGTH = 254;

interface VerificationPayload {
  sub: string;
  email: string;
  exp: number;
}

export interface EmailVerificationClaims {
  userId: string;
  email: string;
}

function signature(encodedPayload: string): Buffer {
  return createHmac("sha256", getEnv().APP_SECRET)
    .update(encodedPayload)
    .digest();
}

/**
 * Jeton de vérification signé (HMAC-SHA256), sans stockage en base.
 * Le jeton contient l'identifiant du compte, l'e-mail à confirmer et une
 * date d'expiration. La signature empêche toute modification côté client.
 */
export function createEmailVerificationToken(user: {
  id: string;
  email: string;
}): string {
  const payload: VerificationPayload = {
    sub: user.id,
    email: user.email.trim().toLowerCase(),
    exp: Date.now() + LIFETIME_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signed = signature(encoded).toString("base64url");
  return `${encoded}.${signed}`;
}

/** Vérifie la signature et l'expiration. Retourne `null` si le jeton est invalide. */
export function readEmailVerificationToken(
  token: string,
): EmailVerificationClaims | null {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;

  const separator = token.indexOf(".");
  if (separator <= 0 || separator === token.length - 1) return null;

  const encoded = token.slice(0, separator);
  const provided = token.slice(separator + 1);
  if (encoded.length > MAX_ENCODED_LENGTH || provided.length > MAX_SIGNATURE_LENGTH) {
    return null;
  }

  const expected = signature(encoded);
  let providedBuffer: Buffer;
  try {
    providedBuffer = Buffer.from(provided, "base64url");
  } catch {
    return null;
  }

  if (
    providedBuffer.length !== expected.length ||
    !timingSafeEqual(providedBuffer, expected)
  ) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const { sub, email, exp } = parsed as Partial<VerificationPayload>;

  if (
    typeof sub !== "string" ||
    sub.length < 1 ||
    sub.length > MAX_USER_ID_LENGTH ||
    typeof email !== "string" ||
    email.length < 3 ||
    email.length > MAX_EMAIL_LENGTH ||
    typeof exp !== "number" ||
    !Number.isFinite(exp) ||
    exp < Date.now()
  ) {
    return null;
  }

  return { userId: sub, email: email.trim().toLowerCase() };
}
