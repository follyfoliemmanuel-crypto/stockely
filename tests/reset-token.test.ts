import { describe, expect, it } from "vitest";

import { extractResetToken, normalizeResetToken } from "@/lib/reset-token";

const VALID_TOKEN = "A".repeat(42) + "_-";

describe("jeton de réinitialisation", () => {
  it("accepte un jeton base64url borné", () => {
    expect(normalizeResetToken(VALID_TOKEN)).toBe(VALID_TOKEN);
  });

  it("refuse un jeton vide, trop court, trop long ou hors alphabet", () => {
    expect(normalizeResetToken(null)).toBeNull();
    expect(normalizeResetToken("")).toBeNull();
    expect(normalizeResetToken("a".repeat(19))).toBeNull();
    expect(normalizeResetToken("a".repeat(513))).toBeNull();
    expect(normalizeResetToken(`${"a".repeat(40)}/=%`)).toBeNull();
  });

  it("lit le fragment, format utilisé par les nouveaux liens", () => {
    expect(extractResetToken(`#token=${VALID_TOKEN}`, "")).toBe(VALID_TOKEN);
  });

  it("lit la query string pour les anciens liens", () => {
    expect(extractResetToken("", `?token=${VALID_TOKEN}`)).toBe(VALID_TOKEN);
  });

  it("privilégie le fragment et ignore les valeurs invalides", () => {
    expect(
      extractResetToken(`#token=${VALID_TOKEN}`, "?token=court"),
    ).toBe(VALID_TOKEN);
    expect(extractResetToken("#token=court", `?token=${VALID_TOKEN}`)).toBe(
      VALID_TOKEN,
    );
    expect(extractResetToken("#autre=1", "?q=test")).toBeNull();
  });
});
