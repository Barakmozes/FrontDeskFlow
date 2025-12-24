// lib/folioRoomCharges.ts
/**
 * Auto-post nightly room charges into the Folio without any schema changes.
 *
 * Implementation strategy:
 * - Room charges are stored as Orders associated to the room (tableId).
 * - We stamp Order.note with a machine-readable prefix so we can:
 *    - avoid duplicates (idempotency)
 *    - split revenue later (ROOM vs MENU) via note prefix
 *
 * NOTE: We also immediately set the order status to COMPLETED
 * so room-charge "orders" don't appear in kitchen/delivery flows.
 */

import type { Client } from "urql";

import {
  AddOrderToTableDocument,
  EditOrderDocument,
  GetTableOrderDocument,
  OrderStatus,
} from "@/graphql/generated";

const ROOM_CHARGE_PREFIX = "FD:ROOM_CHARGE" as const;

export type NightRef = {
  reservationId: string;
  dateKey: string; // YYYY-MM-DD
};

export type EnsureNightlyRoomChargesArgs = {
  client: Client;

  tableId: string;
  hotelId: string;
  roomNumber: number;

  guestEmail: string;
  guestName: string;

  nightlyRate: number;
  currency: string;

  nights: NightRef[];
};

function buildRoomChargeNote(args: {
  reservationId: string;
  dateKey: string;
  hotelId: string;
  roomNumber: number;
  nightlyRate: number;
  currency: string;
}) {
  return [
    ROOM_CHARGE_PREFIX,
    `reservationId=${args.reservationId}`,
    `dateKey=${args.dateKey}`,
    `hotelId=${args.hotelId}`,
    `room=${args.roomNumber}`,
    `rate=${args.nightlyRate}`,
    `currency=${args.currency}`,
  ].join("|");
}

function parseRoomChargeNote(note: string | null | undefined): {
  reservationId?: string;
  dateKey?: string;
} | null {
  if (!note) return null;
  const s = String(note);
  if (!s.startsWith(ROOM_CHARGE_PREFIX)) return null;

  const parts = s.split("|").slice(1);
  const kv: Record<string, string> = {};
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    if (k) kv[k] = v;
  }

  return { reservationId: kv["reservationId"], dateKey: kv["dateKey"] };
}

/**
 * Ensures there is exactly one Nightly Room Charge order per night reservationId.
 * Safe to call multiple times (idempotent).
 */
export async function ensureNightlyRoomCharges(
  args: EnsureNightlyRoomChargesArgs
): Promise<{ created: number; skipped: number }> {
  const {
    client,
    tableId,
    hotelId,
    roomNumber,
    guestEmail,
    guestName,
    nightlyRate,
    currency,
    nights,
  } = args;

  if (!client) throw new Error("ensureNightlyRoomCharges: missing urql client");
  if (!tableId) throw new Error("ensureNightlyRoomCharges: missing tableId");
  if (!Array.isArray(nights) || nights.length === 0) return { created: 0, skipped: 0 };

  const rate = Number(nightlyRate);
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error("ensureNightlyRoomCharges: invalid nightlyRate");
  }

  // If the rate is 0, don't spam the DB with 0-value orders.
  if (rate === 0) return { created: 0, skipped: nights.length };

  // 1) Load existing orders for this room to avoid duplicates
  const existingRes = await client
    .query(GetTableOrderDocument, { tableId }, { requestPolicy: "network-only" })
    .toPromise();

  if (existingRes.error) throw existingRes.error;

  const existingOrders = existingRes.data?.getTableOrder ?? [];

  const existingChargeReservationIds = new Set<string>();
  for (const o of existingOrders as any[]) {
    const parsed = parseRoomChargeNote(o.note);
    if (parsed?.reservationId) existingChargeReservationIds.add(parsed.reservationId);
  }

  // 2) Create missing charges
  let created = 0;
  let skipped = 0;

  const wanted = [...nights].sort((a, b) => {
    const dk = a.dateKey.localeCompare(b.dateKey);
    if (dk !== 0) return dk;
    return a.reservationId.localeCompare(b.reservationId);
  });

  for (const n of wanted) {
    if (!n?.reservationId || !n?.dateKey) continue;

    if (existingChargeReservationIds.has(n.reservationId)) {
      skipped += 1;
      continue;
    }

    const orderNumber = `FDROOM-${n.reservationId}`; // unique + stable

    const note = buildRoomChargeNote({
      reservationId: n.reservationId,
      dateKey: n.dateKey,
      hotelId,
      roomNumber,
      nightlyRate: rate,
      currency,
    });

    const cart = [
      {
        id: `FDROOM-${n.reservationId}`,
        title: `Nightly Room Charge • Room ${roomNumber} • ${n.dateKey}`,
        price: rate,
        quantity: 1,
        image: "",
      },
    ];

    const addRes = await client
      .mutation(AddOrderToTableDocument, {
        cart,
        orderNumber,
        serviceFee: 0,
        tableId,
        total: rate,
        userEmail: guestEmail,
        userName: guestName || guestEmail,
        discount: null,
        note,
        paymentToken: null,
      })
      .toPromise();

    if (addRes.error) {
      const msg = String(addRes.error?.message ?? "").toLowerCase();
      // if a rare race happens, treat it as already-created
      if (msg.includes("unique") || msg.includes("ordernumber")) {
        skipped += 1;
        continue;
      }
      throw addRes.error;
    }

    const newOrderId = addRes.data?.addOrderToTable?.id;
    if (!newOrderId) throw new Error("ensureNightlyRoomCharges: addOrderToTable returned no order id");

    // 3) Mark as COMPLETED to keep it out of kitchen/delivery queues.
    const editRes = await client
      .mutation(EditOrderDocument, {
        editOrderId: newOrderId,
        status: OrderStatus.Completed,
        deliveryTime: null,
      })
      .toPromise();

    if (editRes.error) throw editRes.error;

    created += 1;
    existingChargeReservationIds.add(n.reservationId);
  }

  return { created, skipped };
}

export function isRoomChargeOrderNote(note: string | null | undefined): boolean {
  return !!note && String(note).startsWith(ROOM_CHARGE_PREFIX);
}

export const ROOM_CHARGE_NOTE_PREFIX = ROOM_CHARGE_PREFIX;
