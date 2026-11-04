import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

beforeAll(() => {
  process.env.APP_SECRET ??= "secret-de-test-suffisamment-long-pour-zod";
  process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/stockely_test";
  process.env.APP_URL ??= "http://localhost:3000";
  vi.resetModules();
});

afterAll(() => {
  process.env = { ...originalEnv };
  vi.useRealTimers();
});

describe("jeton de vérification d'e-mail", () => {
  it("signe puis relit l'identifiant et l'adresse normalisée", async () => {
    const { createEmailVerificationToken, readEmailVerificationToken } = await import(
      "@/server/auth/email-verification"
    );

    const token = createEmailVerificationToken({
      id: "6f1f0f0e-0000-4000-8000-000000000001",
      email: "Awa@Example.COM",
    });

    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(readEmailVerificationToken(token)).toEqual({
      userId: "6f1f0f0e-0000-4000-8000-000000000001",
      email: "awa@example.com",
    });
  });

  it("refuse un jeton dont la charge utile a été modifiée", async () => {
    const { createEmailVerificationToken, readEmailVerificationToken } = await import(
      "@/server/auth/email-verification"
    );

    const token = createEmailVerificationToken({
      id: "user-modifie",
      email: "modifie@example.com",
    });
    const [payload, signature] = token.split(".");
    if (!payload || !signature) throw new Error("jeton mal formé");
    const first = payload[0] === "A" ? "B" : "A";
    const tampered = `${first}${payload.slice(1)}.${signature}`;

    expect(readEmailVerificationToken(tampered)).toBeNull();
  });

  it("refuse un jeton expiré", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.resetModules();

    const { createEmailVerificationToken, readEmailVerificationToken } = await import(
      "@/server/auth/email-verification"
    );
    const token = createEmailVerificationToken({
      id: "user-expire",
      email: "expire@example.com",
    });

    vi.setSystemTime(new Date("2026-01-03T00:00:00.000Z"));
    expect(readEmailVerificationToken(token)).toBeNull();
    vi.useRealTimers();
  });
});
