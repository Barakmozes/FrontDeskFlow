export const toLocalDateKey = (isoOrDate: string | Date): string => {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const dateKeyToLocalMidday = (dateKey: string): Date => {
  // local midday prevents “day shift” bugs around midnight + timezones
  return new Date(`${dateKey}T12:00:00`);
};

export const addDaysKey = (dateKey: string, days: number): string => {
  const d = dateKeyToLocalMidday(dateKey);
  d.setDate(d.getDate() + days);
  return toLocalDateKey(d);
};

export const buildDateKeys = (startKey: string, days: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < days; i++) out.push(addDaysKey(startKey, i));
  return out;
};

export const formatHeader = (dateKey: string): string => {
  const d = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};
