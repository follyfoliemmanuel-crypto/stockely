import { isValidIsoDate } from "@/lib/date";

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Normalise une période de rapport : dates ISO, ordre chronologique et
 * valeurs de repli sur les 30 derniers jours. Aucune valeur brute n'atteint SQL.
 */
export function resolveReportRange(fromRaw?: string, toRaw?: string) {
  const today = new Date();
  const fallbackTo = toIsoDate(today);
  const fallbackFromDate = new Date(today);
  fallbackFromDate.setUTCDate(fallbackFromDate.getUTCDate() - 29);

  let from = fromRaw && isValidIsoDate(fromRaw) ? fromRaw : toIsoDate(fallbackFromDate);
  let to = toRaw && isValidIsoDate(toRaw) ? toRaw : fallbackTo;

  if (from > to) [from, to] = [to, from];

  // Garde-fou : évite une série quotidienne ou un export démesuré.
  const maxSpanMs = 366 * 86_400_000;
  const spanMs =
    new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  if (spanMs > maxSpanMs) {
    const clamped = new Date(
      new Date(`${to}T00:00:00Z`).getTime() - 365 * 86_400_000,
    );
    from = toIsoDate(clamped);
  }

  return { from, to };
}

export function reportPresets() {
  const today = new Date();
  const to = toIsoDate(today);
  const last7Date = new Date(today);
  last7Date.setUTCDate(last7Date.getUTCDate() - 6);
  const last30Date = new Date(today);
  last30Date.setUTCDate(last30Date.getUTCDate() - 29);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  return [
    { label: "7 jours", from: toIsoDate(last7Date), to },
    { label: "30 jours", from: toIsoDate(last30Date), to },
    { label: "Ce mois", from: toIsoDate(monthStart), to },
  ];
}
