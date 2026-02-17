// lib/dateKey.ts
/**
 * We need a stable local-date key for grouping "Arrivals today" etc.
 * We intentionally use LOCAL time for the reception UX.
 */

export function toLocalDateKey(value: unknown): string {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayLocalDateKey(): string {
  return toLocalDateKey(new Date());
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  // dateKey = YYYY-MM-DD
  const [y, m, d] = dateKey.split("-").map((x) => Number(x));
  const base = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0); // midday prevents DST edge issues
  base.setDate(base.getDate() + deltaDays);
  return toLocalDateKey(base);
}
