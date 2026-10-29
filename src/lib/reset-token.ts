const MIN_RESET_TOKEN_LENGTH = 20;
const MAX_RESET_TOKEN_LENGTH = 512;
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Un jeton de réinitialisation est généré en base64url (32 octets).
 * On borne sa taille et son alphabet avant tout usage côté client.
 */
export function normalizeResetToken(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length < MIN_RESET_TOKEN_LENGTH || value.length > MAX_RESET_TOKEN_LENGTH) {
    return null;
  }
  if (!RESET_TOKEN_PATTERN.test(value)) return null;
  return value;
}

/**
 * Extrait le jeton du fragment (`#token=…`, format actuel) ou, à titre de
 * transition, de la query string (`?token=…`, anciens e-mails). Le fragment
 * n'est jamais envoyé au serveur ; l'appelant doit effacer l'URL ensuite.
 */
export function extractResetToken(hash: string, search: string): string | null {
  const hashValue = hash.startsWith("#") ? hash.slice(1) : hash;
  const fromHash = normalizeResetToken(new URLSearchParams(hashValue).get("token"));
  if (fromHash) return fromHash;

  const searchValue = search.startsWith("?") ? search.slice(1) : search;
  return normalizeResetToken(new URLSearchParams(searchValue).get("token"));
}
