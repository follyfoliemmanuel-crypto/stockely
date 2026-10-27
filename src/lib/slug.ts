/** Transforme un nom en slug URL : "Ma Boutique Étoile" → "ma-boutique-etoile". */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Suffixe aléatoire court pour garantir l'unicité d'un slug. */
export function randomSuffix(length = 5): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (const byte of bytes) {
    result += alphabet[byte % alphabet.length];
  }
  return result;
}
