/**
 * Vérification d'identifiants UUID avant tout usage dans une requête SQL.
 * Évite qu'un identifiant malformé provoque une erreur PostgreSQL 22P02
 * transformée en 500, et coupe court aux identifiants fantaisistes.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
