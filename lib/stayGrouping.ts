// lib/stayGrouping.ts
/**
 * One single source of truth for "Stay" grouping (Reception + Operations + Room Board).
 *
 * Why this exists:
 * - Your DB stores 1 reservation per night.
 * - Reception/Operations need "stays" (contiguous nights) to avoid duplication and to be consistent.
 *
 * This module produces StayBlock objects and helpers for:
 * - arrivals / in-house / departures views
 * - folio selection for a given operational date
 */

import { ReservationStatus, type GetReservationsQuery } from "@/graphql/generated";

export type ResRow = GetReservationsQuery["getReservations"][number];

export type StayNightRef = { reservationId: string; dateKey: string };

export type StayBlock = {
  stayId: string;

  roomId: string;
  roomNumber: number;
  hotelId: string;

  userEmail: string;
  guestName: string;
  guestPhone: string | null;

  /** Max guests across nights (correct guest count) */
  guests: number;

  /** Number of nights */
  nights: number;

  /** Arrival night key */
  startDateKey: string;

  /** Last night key (inclusive) */
  lastNightKey: string;

  /** Checkout day key (exclusive) */
  endDateKey: string;

  /** Aggregated status of the stay */
  status: ReservationStatus;

  /** Snapshot of room occupancy right now */
  tableReservedNow: boolean;

  /** Snapshot of room specialRequests right now (HK tags, rate tags, notes...) */
  specialRequests: string[];

  /** The nightly reservations that compose this stay (sorted) */
  reservations: ResRow[];
  reservationIds: string[];

  /** Convenience array for folio-room-charges posting */
  nightsList: StayNightRef[];
};

/* ------------------------------ Date helpers ------------------------------ */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Local YYYY-MM-DD for a Date or ISO string */
export function toLocalDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

/** Today in local timezone as YYYY-MM-DD */
export function todayLocalDateKey(): string {
  return toLocalDateKey(new Date());
}

export function isStayCheckedIn(stay: StayBlock): boolean {
  // ✅ Per-stay check-in signal:
  // Check-in flow sets at least one night to Confirmed (usually all).
  return (stay.reservations ?? []).some((r) => r.status === ReservationStatus.Confirmed);
}
/**
 * Parse a YYYY-MM-DD dateKey into a local-midday Date to avoid DST issues
 * when adding days.
 */
function parseDateKeyToLocalMidday(dateKey: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}

/** Add N days to YYYY-MM-DD dateKey */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const dt = parseDateKeyToLocalMidday(dateKey);
  if (!dt) return dateKey;
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function splitContiguousDateKeys(sorted: string[]): string[][] {
  const blocks: string[][] = [];
  let cur: string[] = [];

  for (const dk of sorted) {
    if (cur.length === 0) {
      cur = [dk];
      continue;
    }
    const prev = cur[cur.length - 1];
    const expected = addDaysToDateKey(prev, 1);
    if (dk === expected) {
      cur.push(dk);
    } else {
      blocks.push(cur);
      cur = [dk];
    }
  }
  if (cur.length) blocks.push(cur);
  return blocks;
}

function aggregateStayStatus(nights: ResRow[]): ReservationStatus {
  if (nights.length === 0) return ReservationStatus.Pending;

  const allCancelled = nights.every((r) => r.status === ReservationStatus.Cancelled);
  if (allCancelled) return ReservationStatus.Cancelled;

  if (nights.some((r) => r.status === ReservationStatus.Confirmed)) return ReservationStatus.Confirmed;
  if (nights.some((r) => r.status === ReservationStatus.Pending)) return ReservationStatus.Pending;

  return ReservationStatus.Completed;
}

/* ------------------------------ Stay grouping ----------------------------- */

export function groupReservationsIntoStays(rows: ResRow[]): StayBlock[] {
  const list = Array.isArray(rows) ? rows : [];

  // 1) group by room + guest
  const byRoomGuest = new Map<string, ResRow[]>();
  for (const r of list) {
    const roomId = r.table?.id ?? (r as any).tableId;
    if (!roomId) continue;

    const key = `${roomId}||${r.userEmail}`;
    const arr = byRoomGuest.get(key) ?? [];
    arr.push(r);
    byRoomGuest.set(key, arr);
  }

  const stays: StayBlock[] = [];

  byRoomGuest.forEach((group, key) => {
    // Deduplicate accidental duplicates: keep one reservation per dateKey
    const byDateKey = new Map<string, ResRow>();

    for (const r of group) {
      const dk = toLocalDateKey(r.reservationTime);
      if (!dk) continue;
      if (!byDateKey.has(dk)) byDateKey.set(dk, r);
    }

    const dateKeys = Array.from(byDateKey.keys()).sort((a, b) => a.localeCompare(b));
    const blocks = splitContiguousDateKeys(dateKeys);

    for (const blockKeys of blocks) {
      const nights = blockKeys.map((dk) => byDateKey.get(dk)!).filter(Boolean);
      if (nights.length === 0) continue;

      nights.sort((a, b) => String(a.reservationTime).localeCompare(String(b.reservationTime)));

      const first = nights[0];
      const roomId = first.table?.id ?? (first as any).tableId;
      if (!roomId) continue;

      const roomNumber = first.table?.tableNumber ?? 0;
      const hotelId = first.table?.areaId ?? "";

      const userEmail = first.userEmail;
      const guestName = first.user?.profile?.name || userEmail;
      const guestPhone = first.user?.profile?.phone ?? null;

      const startDateKey = blockKeys[0];
      const lastNightKey = blockKeys[blockKeys.length - 1];
      const endDateKey = addDaysToDateKey(lastNightKey, 1);

      const guests = Math.max(...nights.map((n) => Number(n.numOfDiners ?? 0)), 0);

      const stay: StayBlock = {
        stayId: `${key}::${startDateKey}`,

        roomId,
        roomNumber,
        hotelId,

        userEmail,
        guestName,
        guestPhone,

        guests,
        nights: nights.length,

        startDateKey,
        lastNightKey,
        endDateKey,

        status: aggregateStayStatus(nights),

        tableReservedNow: Boolean(first.table?.reserved),
        specialRequests: (first.table?.specialRequests ?? []) as string[],

        reservations: nights,
        reservationIds: nights.map((n) => n.id),

        nightsList: nights.map((n) => ({
          reservationId: n.id,
          dateKey: toLocalDateKey(n.reservationTime),
        })),
      };

      stays.push(stay);
    }
  });

  stays.sort((a, b) => {
    if (a.roomNumber !== b.roomNumber) return a.roomNumber - b.roomNumber;
    return a.startDateKey.localeCompare(b.startDateKey);
  });

  return stays;
}

/** True if the stay covers this operational dateKey as an in-house night */
export function coversDateKey(stay: StayBlock, dateKey: string): boolean {
  return stay.startDateKey <= dateKey && stay.lastNightKey >= dateKey;
}

/**
 * Folio route is /dashboard/folio/[reservationId]
 * Pick the reservationId that matches the selected dateKey if present; else the first night.
 */
export function folioReservationIdForDateKey(stay: StayBlock, dateKey: string): string {
  const byDate = stay.nightsList.find((n) => n.dateKey === dateKey)?.reservationId;
  return byDate ?? stay.reservationIds[0];
}

export function sumStayGuests(stays: StayBlock[]): number {
  return (stays ?? []).reduce((acc, s) => acc + (Number(s.guests ?? 0) || 0), 0);
}

export function findStayByReservationId(stays: StayBlock[], reservationId: string): StayBlock | null {
  for (const s of stays) {
    if (s.reservationIds?.includes(reservationId)) return s;
    if (s.reservations?.some((r: any) => r.id === reservationId)) return s;
  }
  return null;
}