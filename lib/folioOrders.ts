// lib/folioOrders.ts
import { toLocalDateKey } from "@/lib/dateKey";

const FOLIO_PREFIX = "FOLIO:";
const ROOM_CHARGE_TYPE = "ROOM_CHARGE";

export type RevenueStream = "ROOM" | "MENU_IN_HOUSE" | "MENU_EXTERNAL";

export type RoomChargeMeta = {
  reservationId: string;
  dateKey: string; // YYYY-MM-DD
  rate: number;
  postedByEmail?: string | null;
};

/**
 * We “tag” Room Charges in Order.note so we can:
 * - split revenue in dashboard
 * - render folio breakdown
 * - find missing charges & prevent duplicates
 *
 * Format example:
 *   FOLIO:TYPE=ROOM_CHARGE;RES=<reservationId>;DATE=2025-12-21;RATE=199;BY=staff%40mail.com
 */
export function buildRoomChargeNote(meta: RoomChargeMeta): string {
  const parts = [
    `${FOLIO_PREFIX}TYPE=${ROOM_CHARGE_TYPE}`,
    `RES=${meta.reservationId}`,
    `DATE=${meta.dateKey}`,
    `RATE=${meta.rate}`,
  ];

  if (meta.postedByEmail) {
    parts.push(`BY=${encodeURIComponent(meta.postedByEmail)}`);
  }

  return parts.join(";");
}

function parseNotePairs(note: string): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = note.split(";").map((s) => s.trim()).filter(Boolean);

  for (const token of raw) {
    // token could be "FOLIO:TYPE=..." or "RES=..."
    const normalized = token.startsWith(FOLIO_PREFIX) ? token.slice(FOLIO_PREFIX.length) : token;
    const idx = normalized.indexOf("=");
    if (idx === -1) continue;

    const k = normalized.slice(0, idx).trim().toUpperCase();
    const v = normalized.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = v;
  }

  return out;
}

export function parseRoomChargeMeta(note?: string | null): {
  reservationId: string | null;
  dateKey: string | null;
  rate: number | null;
  postedByEmail: string | null;
} {
  if (!note) return { reservationId: null, dateKey: null, rate: null, postedByEmail: null };
  const pairs = parseNotePairs(note);

  const reservationId = pairs["RES"] ?? null;
  const dateKey = pairs["DATE"] ?? null;

  const rateRaw = pairs["RATE"];
  const rateNum = rateRaw != null ? Number(rateRaw) : NaN;
  const rate = Number.isFinite(rateNum) ? rateNum : null;

  const by = pairs["BY"] ? decodeURIComponent(pairs["BY"]) : null;

  return { reservationId, dateKey, rate, postedByEmail: by };
}

export function isRoomChargeOrder(order: {
  orderNumber?: string | null;
  note?: string | null;
  cart?: any;
}): boolean {
  const note = order.note ?? "";
  if (note.includes(`${FOLIO_PREFIX}TYPE=${ROOM_CHARGE_TYPE}`)) return true;

  const orderNumber = order.orderNumber ?? "";
  if (orderNumber.startsWith("ROOM-")) return true;

  const cart = (order as any).cart;
  if (Array.isArray(cart)) {
    return cart.some((x) => String(x?.id ?? x?.sku ?? "").toUpperCase() === "ROOM_CHARGE");
  }

  return false;
}

export function orderIsPaid(order: { paid?: boolean | null; paymentToken?: string | null }): boolean {
  return order?.paid === true || Boolean(order?.paymentToken && order.paymentToken.trim());
}

/**
 * For graphs:
 * - Menu orders use orderDate
 * - Room charges prefer the DATE=YYYY-MM-DD in note (so revenue tracks to the night)
 */
export function effectiveOrderDateKey(order: { orderDate: string; note?: string | null }): string {
  const meta = parseRoomChargeMeta(order.note);
  if (meta.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(meta.dateKey)) return meta.dateKey;
  return toLocalDateKey(order.orderDate);
}

/**
 * Revenue stream split:
 * - ROOM: tagged room charge
 * - MENU_IN_HOUSE: tableId present (room-service / dine-in), not room charge
 * - MENU_EXTERNAL: no tableId (delivery / takeaway), not room charge
 */
export function inferRevenueStream(order: {
  tableId?: string | null;
  deliveryAddress?: string | null;
  note?: string | null;
  orderNumber?: string | null;
  cart?: any;
}): RevenueStream {
  if (isRoomChargeOrder(order)) return "ROOM";
  if (order.tableId) return "MENU_IN_HOUSE";
  return "MENU_EXTERNAL";
}

export function formatMoney(amount: number, currency: string = "USD") {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(safe);
  } catch {
    return `$${safe.toFixed(2)}`;
  }
}
