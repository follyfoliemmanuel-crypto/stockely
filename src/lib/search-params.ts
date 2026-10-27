export type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function pageParam(value: string | string[] | undefined): number {
  const parsed = Number(firstParam(value) ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(10_000, Math.floor(parsed)) : 1;
}

export function buildQuery(
  current: Record<string, string | undefined>,
  updates: Record<string, string | number | undefined | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...updates })) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function formatDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}
