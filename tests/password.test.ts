import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("hachage des mots de passe", () => {
  it("produit une empreinte Argon2id différente du mot de passe", async () => {
    const password = "un-mot-de-passe-solide-2026";
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash.length).toBeGreaterThan(40);
  });

  it("accepte le bon mot de passe", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
  });

  it("refuse un mot de passe incorrect", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });

  it("refuse une empreinte corrompue sans lever d'exception", async () => {
    await expect(verifyPassword("pas-une-empreinte", "secret")).resolves.toBe(false);
  });

  it("génère un sel différent pour deux hachages identiques", async () => {
    const first = await hashPassword("même mot de passe");
    const second = await hashPassword("même mot de passe");
    expect(first).not.toBe(second);
  });
});
