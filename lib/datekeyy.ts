// lib/dateKey.ts

export function toLocalDateKey(value: unknown): string {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map((x) => Number(x));
  const base = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0); // midday avoids DST edge issues
  base.setDate(base.getDate() + deltaDays);
  return toLocalDateKey(base);
}

export function buildDateRange(startDateKey: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDaysToDateKey(startDateKey, i));
}

export function dateKeyToLocalNoonISO(dateKey: string): string {
  // IMPORTANT: no timezone in string => interpreted as local time
  // then toISOString converts to UTC safely.
  return new Date(`${dateKey}T12:00:00`).toISOString();
}
