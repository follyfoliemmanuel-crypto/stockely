/** Extrait le code d'erreur PostgreSQL, y compris à travers les erreurs Drizzle. */
function postgresErrorCode(error: unknown): string | null {
  let current: unknown = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return null;
    if ("code" in current) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string") return code;
    }
    if (!("cause" in current)) return null;
    current = (current as { cause?: unknown }).cause;
  }

  return null;
}

/** Détection des erreurs PostgreSQL utiles, sans exposer le détail au client. */
export function isUniqueViolation(error: unknown): boolean {
  return postgresErrorCode(error) === "23505";
}

export function isForeignKeyViolation(error: unknown): boolean {
  return postgresErrorCode(error) === "23503";
}
