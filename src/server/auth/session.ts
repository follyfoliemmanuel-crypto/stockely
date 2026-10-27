import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { getDb } from "@/server/db";
import { sessions } from "@/server/db/schema";

export const SESSION_COOKIE = "stockely_session";
export const CSRF_COOKIE = "stockely_csrf";

const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 jours

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface CreatedSession {
  token: string;
  csrfToken: string;
  expiresAt: Date;
}

/** Crée une session opaque : seul le hachage du jeton est stocké en base. */
export async function createSession(input: {
  userId: string;
  activeShopId: string | null;
  ipHash: string;
  userAgent: string | null;
}): Promise<CreatedSession> {
  const token = generateToken();
  const csrfToken = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await getDb().insert(sessions).values({
    userId: input.userId,
    activeShopId: input.activeShopId,
    tokenHash: hashToken(token),
    csrfToken,
    ipHash: input.ipHash,
    userAgent: input.userAgent?.slice(0, 500) ?? null,
    expiresAt,
  });

  return { token, csrfToken, expiresAt };
}

function cookieOptions(expires: Date) {
  const secure =
    getEnv().NODE_ENV === "production" || getEnv().APP_URL.startsWith("https://");
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function setAuthCookies(session: CreatedSession): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.token, cookieOptions(session.expiresAt));
  // Le jeton CSRF doit être lisible par le client pour être renvoyé en en-tête.
  jar.set(CSRF_COOKIE, session.csrfToken, {
    ...cookieOptions(session.expiresAt),
    httpOnly: false,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(CSRF_COOKIE);
}

/** Variante utilisée pour une redirection : les cookies vont sur la réponse. */
export function applySessionCookies(
  response: NextResponse,
  session: CreatedSession,
): void {
  response.cookies.set(SESSION_COOKIE, session.token, cookieOptions(session.expiresAt));
  response.cookies.set(CSRF_COOKIE, session.csrfToken, {
    ...cookieOptions(session.expiresAt),
    httpOnly: false,
  });
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const { eq } = await import("drizzle-orm");
  await getDb()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.tokenHash, hashToken(token)));
}
