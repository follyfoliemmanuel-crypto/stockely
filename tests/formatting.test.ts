import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/slug";
import { formatInteger, formatMoney } from "@/lib/money";

describe("slug de boutique", () => {
  it("retire les accents et normalise les séparateurs", () => {
    expect(slugify("Maison Étoile — Lomé")).toBe("maison-etoile-lome");
  });

  it("supprime les tirets superflus", () => {
    expect(slugify("  --Ma Boutique--  ")).toBe("ma-boutique");
  });

  it("limite la longueur", () => {
    expect(slugify("a".repeat(80)).length).toBeLessThanOrEqual(48);
  });
});

describe("formatage monétaire", () => {
  it("affiche les entiers avec séparateurs français", () => {
    expect(formatInteger(1000).replace(/\s/g, " ")).toBe("1 000");
  });

  it("formate un montant XOF sans décimales", () => {
    const formatted = formatMoney(150_000, "XOF");
    expect(formatted.replace(/\s/g, " ")).toContain("1 500");
    expect(formatted).not.toContain(",00");
  });

  it("formate un montant EUR avec deux décimales", () => {
    const formatted = formatMoney(123_456, "EUR");
    expect(formatted.replace(/\s/g, " ")).toContain("1 234,56");
  });
});
