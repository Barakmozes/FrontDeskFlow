import { ReservationStatus } from "@/graphql/generated";
import { coversDateKey, type StayBlock } from "@/lib/stayGrouping";

/**
 * Hanel / FrontDeskFlow mapping:
 * - Area => Hotel
 * - Table => Room
 * - Reservations => Stay/Booking nights
 * - Orders-on-Table => Folio lines (room charges + room service)
 */

export type Tone = "gray" | "green" | "amber" | "blue" | "red";

export type OrderKind = "ROOM_CHARGE" | "ROOM_SERVICE" | "DELIVERY" | "OTHER";

export const ROOM_CHARGE_NOTE_PREFIX = "FD:ROOM_CHARGE";

export type RoomChargeMeta = {
  reservationId: string;
  dateKey?: string;
  hotelId?: string;
  roomId?: string;
  roomNumber?: number;
};

export type OrdersLookups = {
  hotelById: Map<string, { id: string; name: string; description?: string | null }>;
  roomById: Map<
    string,
    { id: string; tableNumber: number; areaId: string; reserved: boolean; specialRequests?: any }
  >;

  stayByReservationId: Map<string, StayBlock>;
  stayByRoomEmailDateKey: Map<string, StayBlock>;
};

export function parseRoomChargeNote(note: string | null | undefined): RoomChargeMeta | null {
  if (!note) return null;
  if (!note.startsWith(ROOM_CHARGE_NOTE_PREFIX)) return null;

  const parts = note.split("|");
  const map = new Map<string, string>();

  for (const p of parts.slice(1)) {
    const idx = p.indexOf("=");
    if (idx <= 0) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k) continue;
    map.set(k, v);
  }

  const reservationId = map.get("res");
  if (!reservationId) return null;

  const roomNumberRaw = map.get("room");
  const roomNumber =
    roomNumberRaw && Number.isFinite(Number(roomNumberRaw)) ? Number(roomNumberRaw) : undefined;

  return {
    reservationId,
    dateKey: map.get("date") ?? undefined,
    hotelId: map.get("hotel") ?? undefined,
    roomId: map.get("roomId") ?? undefined,
    roomNumber,
  };
}

export function toDateKey(value: unknown): string | null {
  if (!value) return null;

  // common case: ISO-like string (GraphQL often returns ISO strings)
  if (typeof value === "string") {
    const s = value.trim();
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) return s.slice(0, 10);

    // fallback parse
    const d = new Date(s);
    if (!Number.isNaN(d.valueOf())) return d.toISOString().slice(0, 10);
    return null;
  }

  // Date object (rare in JSON but possible in client state)
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }

  try {
    const s = String(value);
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) return s.slice(0, 10);
  } catch {
    // ignore
  }
  return null;
}

export function formatDateTime(value: unknown): string {
  if (!value) return "—";
  const s = typeof value === "string" ? value : value instanceof Date ? value.toISOString() : String(value);
  const d = new Date(s);
  if (Number.isNaN(d.valueOf())) return s;
  try {
    return d.toLocaleString();
  } catch {
    return d.toISOString();
  }
}

export function isOrderPaid(order: { paid?: boolean | null; paymentToken?: string | null }): boolean {
  if (typeof order.paid === "boolean") return order.paid;
  return Boolean(order.paymentToken);
}

export function classifyOrder(args: {
  note?: string | null;
  orderNumber?: string | null;
  deliveryAddress?: string | null;
  tableId?: string | null;
}): OrderKind {
  const note = args.note ?? null;

  // 1) Room charge (strongest signal)
  if (note?.startsWith(ROOM_CHARGE_NOTE_PREFIX)) return "ROOM_CHARGE";

  // 2) Fallback for room charge (be strict)
  const on = (args.orderNumber ?? "").toUpperCase();
  if (on.startsWith("ROOM-")) return "ROOM_CHARGE"; // ✅ ROOM- only

  // 3) Room service / In-house (reliable: linked to a room/table)
  const tid = (args.tableId ?? "").trim();
  if (tid.length > 0) return "ROOM_SERVICE";

  // 4) Delivery (only if real address exists)
  const addr = (args.deliveryAddress ?? "").trim();
  if (addr.length > 0) return "DELIVERY";

  return "OTHER";
}

export function orderKindLabel(kind: OrderKind): string {
  switch (kind) {
    case "ROOM_CHARGE":
      return "Room charge";
    case "ROOM_SERVICE":
      return "Room service / In-house";
    case "DELIVERY":
      return "Delivery";
    default:
      return "Other";
  }
}

export function orderKindTone(kind: OrderKind): Tone {
  switch (kind) {
    case "ROOM_CHARGE":
      return "blue";
    case "ROOM_SERVICE":
      return "amber";
    case "DELIVERY":
      return "gray";
    default:
      return "gray";
  }
}

export function formatMoney(amount: unknown, currency?: string | null): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "—";

  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
    } catch {
      // fall through
    }
  }
  return n.toFixed(2);
}

export function deriveStayStage(
  stay: StayBlock,
  todayKey: string
): { label: string; tone: Tone } {
  // Some stays may expose status; keep it safe
  const status = (stay as any)?.status as ReservationStatus | string | null;

  if (status === ReservationStatus.Cancelled || String(status).toUpperCase() === "CANCELLED") {
    return { label: "Cancelled", tone: "red" };
  }

  // In-house today means: room is occupied now AND stay covers today's date
  if (stay.tableReservedNow && coversDateKey(stay, todayKey)) {
    // departure day special label
    if (stay.endDateKey === todayKey) return { label: "Departing today", tone: "blue" };
    return { label: "In-house", tone: "green" };
  }

  // arriving today but not checked in
  if (stay.startDateKey === todayKey && !stay.tableReservedNow) {
    return { label: "Arriving today", tone: "amber" };
  }

  // upcoming
  if (stay.startDateKey > todayKey) return { label: "Upcoming", tone: "gray" };

  // past
  if (stay.endDateKey < todayKey) return { label: "Departed", tone: "gray" };

  // otherwise (covers today but not occupied, or odd state)
  return { label: "Not in-house", tone: "gray" };
}

export function safeLower(v: unknown): string {
  return (v ?? "").toString().toLowerCase();
}

export function compactId(id: string | null | undefined, n = 6): string {
  if (!id) return "—";
  return id.length <= n ? id : `${id.slice(0, n)}…`;
}
