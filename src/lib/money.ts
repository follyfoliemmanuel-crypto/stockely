const ZERO_DECIMAL_CURRENCIES = new Set([
  "XOF",
  "XAF",
  "XPF",
  "GNF",
  "JPY",
  "KRW",
  "CLP",
  "ISK",
  "VND",
  "RWF",
  "UGX",
  "KMF",
  "DJF",
  "BIF",
]);

/**
 * Les montants sont stockés en unité mineure (centimes) pour éviter
 * tout calcul flottant. L'affichage divise une seule fois, au dernier moment.
 */
export function formatMoney(cents: number, currency: string): string {
  const zeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
  return normalizeSpaces(
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: zeroDecimal ? 0 : 2,
      maximumFractionDigits: zeroDecimal ? 0 : 2,
    }).format(cents / 100),
  );
}

export function formatInteger(value: number): string {
  return normalizeSpaces(new Intl.NumberFormat("fr-FR").format(value));
}

/**
 * Les espaces fines insécables de `Intl` sont peu lisibles dans les grands
 * chiffres (KPI) : on les remplace par des espaces insécables standard.
 */
function normalizeSpaces(value: string): string {
  return value.replace(/\u202f/g, "\u00a0");
}

/** Convertit une saisie utilisateur (unités majeures) en unité mineure entière. */
export function parseMoneyToCents(value: string): number | null {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/\u00a0/g, "")
    .replace(",", ".");
  if (!normalized) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  return cents;
}

/** Affiche une valeur en unité mineure dans un champ de formulaire. */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(/\.00$/, "").replace(".", ",");
}

export function formatDate(
  value: Date | string,
  timeZone: string,
  withTime = false,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone,
  }).format(date);
}

/** Date et heure compactes pour les listes denses (ex. « 28 oct., 14:16 »). */
export function formatDayTime(value: Date | string, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}
