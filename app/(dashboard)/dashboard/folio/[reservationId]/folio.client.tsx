"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";
import { useClient } from "urql";
import { printInvoice } from "@/app/components/Restaurant_interface/Folio/printInvoice";
import {
  // staff
  GetUserDocument,
  type GetUserQuery,
  type GetUserQueryVariables,
  Role,

  // hotel
  GetAreaDocument,
  type GetAreaQuery,
  type GetAreaQueryVariables,

  // reservations
  GetReservationsDocument,
  type GetReservationsQuery,
  type GetReservationsQueryVariables,
  ReservationStatus,
  CompleteReservationDocument,
  type CompleteReservationMutation,
  type CompleteReservationMutationVariables,

  // rooms/tables
  ToggleTableReservationDocument,
  type ToggleTableReservationMutation,
  type ToggleTableReservationMutationVariables,
  UpdateManyTablesDocument,
  type UpdateManyTablesMutation,
  type UpdateManyTablesMutationVariables,

  // orders
  GetTableOrderDocument,
  type GetTableOrderQuery,
  type GetTableOrderQueryVariables,
  EditOrderOnPaymentDocument,
  type EditOrderOnPaymentMutation,
  type EditOrderOnPaymentMutationVariables,

  OrderStatus,
} from "@/graphql/generated";

import { applyHousekeepingPatch, parseHousekeepingTags } from "@/lib/housekeepingTags";
import { parseHotelSettings } from "@/lib/hotelSettingsTags";
import { parseRoomRateTags, getEffectiveNightlyRate } from "@/lib/roomRateTags";

import {
  effectiveOrderDateKey,
  formatMoney,
  inferRevenueStream,
  isRoomChargeOrder,
  orderIsPaid,
  parseRoomChargeMeta,
} from "@/lib/folioOrders";

import { groupReservationsIntoStays, type StayBlock } from "@/lib/stayGrouping";
import { toLocalDateKey } from "@/lib/dateKey";

// ✅ Use the SAME idempotent room-charge poster used by Reception check-in logic
import { ensureNightlyRoomCharges } from "@/lib/folioRoomCharges";

/* --------------------------------- Types --------------------------------- */

type Res = GetReservationsQuery["getReservations"][number];
type Order = GetTableOrderQuery["getTableOrder"][number];

type PaymentMethod = "CARD" | "CASH" | "TRANSFER";

/* --------------------------------- UI bits -------------------------------- */

function Badge({
  tone,
  children,
}: {
  tone: "gray" | "green" | "amber" | "red" | "blue";
  children: React.ReactNode;
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : tone === "red"
      ? "bg-red-100 text-red-800"
      : tone === "blue"
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-800";

  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] ${cls}`}>{children}</span>;
}

function Card({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-gray-500">{subtitle}</div> : null}
    </div>
  );
}

/* ------------------------------ Small helpers ------------------------------ */

function safeLower(s: string | null | undefined) {
  return String(s ?? "").trim().toLowerCase();
}

function orderTotal(o: Order): number {
  const n = Number((o as any).total);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * We store paymentToken strings like:
 *   MANUAL|CARD|by=email@x.com|ts=1700000000000
 *
 * But we also tolerate unknown formats (Stripe tokens, etc.)
 */
function paymentMethodFromToken(token: string | null | undefined): string {
  if (!token) return "—";
  const parts = token.split("|");
  if (parts.length >= 2 && parts[0] === "MANUAL") return parts[1] || "MANUAL";
  if (token.toLowerCase().includes("stripe")) return "STRIPE";
  return "OTHER";
}

function buildPaymentToken(args: { method: PaymentMethod; staffEmail: string; currency: string }) {
  // Keep it short-ish but informative, and stable for audit.
  return `MANUAL|${args.method}|by=${args.staffEmail}|currency=${args.currency}|ts=${Date.now()}`;
}

function findStayByReservationIdLocal(stays: StayBlock[], reservationId: string): StayBlock | null {
  for (const s of stays) {
    const ids = (s as any).reservationIds as string[] | undefined;
    if (ids?.includes(reservationId)) return s;

    const rs = (s as any).reservations as Array<{ id: string }> | undefined;
    if (rs?.some((r) => r.id === reservationId)) return s;
  }
  return null;
}

/* -------------------------------- Component -------------------------------- */

export default function FolioClient({
  reservationId,
  staffEmail,
}: {
  reservationId: string;
  staffEmail: string | null;
}) {
  const router = useRouter();
  const urqlClient = useClient(); // ✅ for ensureNightlyRoomCharges

  /* ------------------------------ Who am I? -------------------------------- */
  const [{ data: meData }] = useQuery<GetUserQuery, GetUserQueryVariables>({
    query: GetUserDocument,
    variables: staffEmail ? { email: staffEmail } : ({} as any),
    pause: !staffEmail,
    requestPolicy: "cache-and-network",
  });

  const myRole = meData?.getUser?.role ?? null;
  const canOverride = myRole === Role.Admin || myRole === Role.Manager;

  /* ---------------------------- Reservations -------------------------------- */
  const [{ data: resData, fetching: resFetching, error: resError }, refetchReservations] = useQuery<
    GetReservationsQuery,
    GetReservationsQueryVariables
  >({
    query: GetReservationsDocument,
    variables: {},
    requestPolicy: "cache-and-network",
  });

  const reservations = (resData?.getReservations ?? []) as Res[];

  const anchor: Res | null = useMemo(() => {
    return reservations.find((r) => r.id === reservationId) ?? null;
  }, [reservations, reservationId]);

  const room = anchor?.table ?? null;
  const roomId = room?.id ?? null;
  const roomNumber = room?.tableNumber ?? null;
  const hotelId = room?.areaId ?? null;

  const guestName = anchor?.user?.profile?.name?.trim() || anchor?.userEmail || "—";
  const guestEmail = anchor?.userEmail || "—";
  const guestPhone = anchor?.user?.profile?.phone ?? null;

  /* ------------------------------ Hotel data -------------------------------- */
  const [{ data: hotelData, fetching: hotelFetching, error: hotelError }] = useQuery<GetAreaQuery, GetAreaQueryVariables>({
    query: GetAreaDocument,
    variables: hotelId ? { getAreaId: hotelId } : ({} as any),
    pause: !hotelId,
    requestPolicy: "cache-and-network",
  });

  const hotel = hotelData?.getArea ?? null;

  const hotelSettings = useMemo(() => {
    // parseHotelSettings must stay resilient – keep local guard anyway
    return parseHotelSettings(hotel?.description ?? "").settings;
  }, [hotel?.description]);

  // Currency is the *single source of truth* for formatting + payment token metadata
  const currency = hotelSettings.currency ?? "USD";

  // Optional settings (do NOT rely on type having them; keep safe)
  const checkoutRequiresPaidFolio =
    (hotelSettings as unknown as { checkoutRequiresPaidFolio?: boolean }).checkoutRequiresPaidFolio ?? true;

  /* ------------------------------- Stay lookup ------------------------------ */
  const stay: StayBlock | null = useMemo(() => {
    if (!anchor) return null;

    // Narrow candidates: same room + same guest email, exclude cancelled
    const candidates = reservations
      .filter((r) => r.tableId === anchor.tableId)
      .filter((r) => safeLower(r.userEmail) === safeLower(anchor.userEmail))
      .filter((r) => r.status !== ReservationStatus.Cancelled);

    const stays = groupReservationsIntoStays(candidates as any) as any as StayBlock[];
    return findStayByReservationIdLocal(stays, reservationId);
  }, [anchor, reservations, reservationId]);

  // Fallback: if stay grouping fails for some reason, still render the anchor as a "single-night stay"
  const stayStartKey = (stay as any)?.startDateKey ?? (anchor?.reservationTime ? toLocalDateKey(anchor.reservationTime) : "—");
  const stayEndKey = (stay as any)?.endDateKey ?? "—";
  const stayGuests = (stay as any)?.guests ?? anchor?.numOfDiners ?? 0;
  const stayNightsCount = (stay as any)?.nights ?? ((stay as any)?.reservations?.length ?? 1);

  const stayReservations = useMemo(() => {
    const rs = (stay as any)?.reservations as Res[] | undefined;
    if (rs?.length) return rs;
    return anchor ? [anchor] : [];
  }, [stay, anchor]);

  const activeNightReservationIds = useMemo(() => {
    return stayReservations
      .filter((r) => r.status !== ReservationStatus.Cancelled)
      .map((r) => r.id);
  }, [stayReservations]);

  const nightsList = useMemo(() => {
    // Reception already provides stay.nightsList; we use it when present
    const nl = (stay as any)?.nightsList as Array<{ reservationId: string; dateKey: string }> | undefined;
    if (nl?.length) return nl;

    // Fallback from reservations list
    const out = stayReservations
      .map((r) => ({
        reservationId: r.id,
        dateKey: r.reservationTime ? toLocalDateKey(r.reservationTime) : "",
      }))
      .filter((n) => !!n.dateKey)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    return out;
  }, [stay, stayReservations]);

  /* ---------------------------- Nightly rate -------------------------------- */
  const roomRateTags = useMemo(() => {
    if (!room) return { overrideNightlyRate: null as number | null };
    return parseRoomRateTags(room.specialRequests).rate;
  }, [room]);

  const nightlyRate = useMemo(() => {
    const base = Number(hotelSettings.baseNightlyRate ?? 0);
    const override = roomRateTags.overrideNightlyRate ?? null;
    const eff = getEffectiveNightlyRate(base, override);
    return Number.isFinite(eff) ? eff : 0;
  }, [hotelSettings.baseNightlyRate, roomRateTags.overrideNightlyRate]);

  /* ------------------------------ Orders ----------------------------------- */
  const [{ data: ordersData, fetching: ordersFetching, error: ordersError }, refetchOrders] = useQuery<
    GetTableOrderQuery,
    GetTableOrderQueryVariables
  >({
    query: GetTableOrderDocument,
    variables: { tableId: roomId ?? "" },
    pause: !roomId,
    requestPolicy: "cache-and-network",
  });

  const allTableOrders = (ordersData?.getTableOrder ?? []) as Order[];

  /**
   * Room charge orders linked to THIS stay:
   * - Must be a room charge
   * - Must include reservationId in note meta OR fall back to a known convention
   */
  const roomChargeOrders = useMemo(() => {
    if (!stayReservations.length) return [];
    const ids = new Set(activeNightReservationIds);

    return allTableOrders.filter((o) => {
      if ((o as any).status === OrderStatus.Cancelled) return false;
      if (!isRoomChargeOrder(o as any)) return false;

      const meta = parseRoomChargeMeta((o as any).note);
      if (meta.reservationId && ids.has(meta.reservationId)) return true;

      // Fallback: some systems prefix orderNumber with ROOM-
      const on = String((o as any).orderNumber ?? "");
      if (on.startsWith("ROOM-")) {
        const rid = on.slice("ROOM-".length);
        return ids.has(rid);
      }

      return false;
    });
  }, [allTableOrders, activeNightReservationIds, stayReservations.length]);

  /**
   * Menu orders for the stay:
   * - Always include unpaid (to keep money correct)
   * - Include paid only if orderDate is within the stay date range (prevents old paid noise)
   */
  const menuOrders = useMemo(() => {
    if (!stay) {
      // if we don't have a stay, show non-room orders for anchor room anyway
      return allTableOrders.filter((o) => (o as any).status !== OrderStatus.Cancelled && !isRoomChargeOrder(o as any));
    }

    const start = String((stay as any).startDateKey ?? "");
    const endExclusive = String((stay as any).endDateKey ?? "");

    return allTableOrders.filter((o) => {
      if ((o as any).status === OrderStatus.Cancelled) return false;
      if (isRoomChargeOrder(o as any)) return false;

      const paid = orderIsPaid(o as any);
      if (!paid) return true;

      const dk = toLocalDateKey((o as any).orderDate);
      if (!dk) return false;

      // Within stay bounds only
      return dk >= start && dk < endExclusive;
    });
  }, [allTableOrders, stay]);

  const missingRoomChargeReservationIds = useMemo(() => {
    if (!stayReservations.length) return [];

    const existing = new Set<string>();
    for (const o of roomChargeOrders) {
      const meta = parseRoomChargeMeta((o as any).note);
      if (meta.reservationId) existing.add(meta.reservationId);

      const on = String((o as any).orderNumber ?? "");
      if (on.startsWith("ROOM-")) existing.add(on.slice("ROOM-".length));
    }

    return activeNightReservationIds.filter((id) => !existing.has(id));
  }, [roomChargeOrders, activeNightReservationIds, stayReservations.length]);

  const totals = useMemo(() => {
    const relevant = [...roomChargeOrders, ...menuOrders];

    const roomTotal = roomChargeOrders.reduce((s, o) => s + orderTotal(o), 0);
    const menuTotal = menuOrders.reduce((s, o) => s + orderTotal(o), 0);

    const paidOrders = relevant.filter((o) => orderIsPaid(o as any));
    const unpaidOrders = relevant.filter((o) => !orderIsPaid(o as any));

    const paidTotal = paidOrders.reduce((s, o) => s + orderTotal(o), 0);
    const balanceDue = unpaidOrders.reduce((s, o) => s + orderTotal(o), 0);

    return {
      roomTotal,
      menuTotal,
      grandTotal: roomTotal + menuTotal,
      paidTotal,
      balanceDue,
      unpaidCount: unpaidOrders.length,
      paidCount: paidOrders.length,
    };
  }, [roomChargeOrders, menuOrders]);

  const paymentsByMethod = useMemo(() => {
    const paid = [...roomChargeOrders, ...menuOrders].filter((o) => orderIsPaid(o as any));
    const m = new Map<string, { method: string; amount: number; count: number }>();

    for (const o of paid) {
      const token = (o as any).paymentToken as string | null | undefined;
      const method = paymentMethodFromToken(token);
      const prev = m.get(method);
      if (!prev) {
        m.set(method, { method, amount: orderTotal(o), count: 1 });
      } else {
        prev.amount += orderTotal(o);
        prev.count += 1;
      }
    }

    return Array.from(m.values()).sort((a, b) => b.amount - a.amount);
  }, [roomChargeOrders, menuOrders]);

  const hk = useMemo(() => {
    if (!room) return null;
    return parseHousekeepingTags(room.specialRequests);
  }, [room]);

  /* ------------------------------ Mutations -------------------------------- */
  const [{ fetching: paying }, editOrderOnPayment] = useMutation<EditOrderOnPaymentMutation, EditOrderOnPaymentMutationVariables>(
    EditOrderOnPaymentDocument
  );

  const [{ fetching: completing }, completeReservation] = useMutation<
    CompleteReservationMutation,
    CompleteReservationMutationVariables
  >(CompleteReservationDocument);

  const [{ fetching: toggling }, toggleTableReservation] = useMutation<
    ToggleTableReservationMutation,
    ToggleTableReservationMutationVariables
  >(ToggleTableReservationDocument);

  const [{ fetching: updatingTables }, updateManyTables] = useMutation<
    UpdateManyTablesMutation,
    UpdateManyTablesMutationVariables
  >(UpdateManyTablesDocument);

  /* ------------------------------- State ----------------------------------- */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  const [overrideCheckout, setOverrideCheckout] = useState(false);

  const isLoading = resFetching || ordersFetching || hotelFetching;
  const anyError = resError || ordersError || hotelError;

  /* ------------------------------- Actions --------------------------------- */

  const refreshAll = useCallback(() => {
    refetchOrders({ requestPolicy: "network-only" });
    refetchReservations({ requestPolicy: "network-only" });
  }, [refetchOrders, refetchReservations]);

  async function postMissingRoomCharges() {
    if (!stay || !room) {
      toast.error("Stay/room not found.");
      return;
    }

    if (!staffEmail) {
      toast.error("Login required.");
      return;
    }

    if (missingRoomChargeReservationIds.length === 0) {
      toast.success("No missing nightly charges.");
      return;
    }

    if (!nightlyRate || nightlyRate <= 0) {
      toast.error("Nightly rate is missing or zero. Set it in Settings first.");
      return;
    }

    // Only post the missing nights (idempotency is still handled by ensureNightlyRoomCharges)
    const missingNights = nightsList.filter((n) => missingRoomChargeReservationIds.includes(n.reservationId));

    try {
      const result = await ensureNightlyRoomCharges({
        client: urqlClient,
        tableId: (stay as any).roomId ?? room.id,
        hotelId: (stay as any).hotelId ?? room.areaId,
        roomNumber: (stay as any).roomNumber ?? room.tableNumber,
        guestEmail: (stay as any).userEmail ?? guestEmail,
        guestName: (stay as any).guestName ?? guestName,
        nightlyRate,
        currency,
        nights: missingNights,
      });

      if (result.created > 0) toast.success(`Posted ${result.created} nightly charge(s).`);
      if (result.skipped > 0) toast(`Skipped ${result.skipped} (already posted).`);

      refetchOrders({ requestPolicy: "network-only" });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed posting nightly charges.");
    }
  }

  async function markOrderPaid(orderId: string) {
    if (!staffEmail) {
      toast.error("Login required.");
      return;
    }

    const token = buildPaymentToken({ method: paymentMethod, staffEmail, currency });

    const res = await editOrderOnPayment({
      editOrderOnPaymentId: orderId,
      paymentToken: token,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to mark paid.");
      return;
    }

    toast.success("Marked as paid.");
    refetchOrders({ requestPolicy: "network-only" });
  }

  async function markAllUnpaidPaid() {
    if (!staffEmail) {
      toast.error("Login required.");
      return;
    }

    const unpaid = [...roomChargeOrders, ...menuOrders].filter((o) => !orderIsPaid(o as any));
    if (unpaid.length === 0) return toast.success("Nothing to pay.");

    const ok = window.confirm(`Mark ${unpaid.length} item(s) as PAID via ${paymentMethod}?`);
    if (!ok) return;

    for (const o of unpaid) {
      const token = buildPaymentToken({ method: paymentMethod, staffEmail, currency });
      const res = await editOrderOnPayment({
        editOrderOnPaymentId: (o as any).id,
        paymentToken: token,
      });
      if (res.error) {
        console.error(res.error);
        toast.error("Failed paying some items.");
        break;
      }
    }

    toast.success("Payment recorded.");
    refetchOrders({ requestPolicy: "network-only" });
  }

  async function doCheckout() {
    if (!stay || !room) {
      toast.error("Stay/room not found.");
      return;
    }

    if (!staffEmail) {
      toast.error("Login required.");
      return;
    }

    // ✅ Missing charges can block checkout ONLY when hotel policy enforces it
    const missingChargesEnforced = Boolean(hotelSettings.autoPostRoomCharges) && missingRoomChargeReservationIds.length > 0;

    if (missingChargesEnforced && !(overrideCheckout && canOverride)) {
      toast.error("Post missing nightly room charges before checkout (or manager override).");
      return;
    }

    // ✅ Paid-only checkout (respects optional hotel setting if present)
    if (checkoutRequiresPaidFolio && totals.balanceDue > 0 && !(overrideCheckout && canOverride)) {
      toast.error("Checkout blocked: Balance due. Take payment first (or manager override).");
      return;
    }

    if (overrideCheckout && !canOverride) {
      toast.error("Manager/Admin override required.");
      return;
    }

    const warning =
      totals.balanceDue > 0
        ? `Override checkout with balance due: ${formatMoney(totals.balanceDue, currency)} ?`
        : "Checkout this stay?";

    const ok = window.confirm(warning);
    if (!ok) return;

    // 1) complete all nights (non-cancelled, non-completed)
    for (const r of stayReservations) {
      if (r.status === ReservationStatus.Cancelled || r.status === ReservationStatus.Completed) continue;

      const c = await completeReservation({ completeReservationId: r.id });
      if (c.error) {
        console.error(c.error);
        toast.error("Failed completing stay reservations.");
        return;
      }
    }

    // 2) release room
    const t = await toggleTableReservation({
      toggleTableReservationId: room.id,
      reserved: false,
    });
    if (t.error) {
      console.error(t.error);
      toast.error("Stay completed, but failed to release room.");
      return;
    }

    // 3) mark DIRTY + cleaning list
    const nextSpecialRequests = applyHousekeepingPatch(room.specialRequests, {
      status: "DIRTY",
      inCleaningList: true,
    });

    const u = await updateManyTables({
      updates: [{ id: room.id, specialRequests: nextSpecialRequests }],
    });

    if (u.error) {
      console.error(u.error);
      toast.error("Checked-out, but failed to mark room DIRTY.");
      return;
    }

    toast.success(`Checked-out: Room ${room.tableNumber} released + marked DIRTY`);

    refetchReservations({ requestPolicy: "network-only" });
    refetchOrders({ requestPolicy: "network-only" });

    router.push("/dashboard/reception");
  }


  /* ------------------------------ Empty state ------------------------------ */

  if (!anchor && !isLoading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="rounded-xl border bg-white p-6">
          <div className="text-lg font-semibold">Folio not found</div>
          <div className="text-sm text-gray-600 mt-1">Reservation id: {reservationId}</div>
          <div className="mt-4">
            <Link className="text-sm text-blue-700 hover:underline" href="/dashboard/reception">
              Back to Reception →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hotelName = hotel?.name ?? "Hotel";

  /* -------------------------------- Render -------------------------------- */

  return (
    <div className="px-6 py-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="rounded-2xl border bg-white shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">Folio</h1>

              <Badge tone="gray">{hotelName}</Badge>
              {roomNumber != null ? <Badge tone="blue">Room {roomNumber}</Badge> : null}
              <Badge tone="gray">{stayNightsCount} night(s)</Badge>

              {hk ? (
                <Badge
                  tone={
                    hk.hk.status === "CLEAN"
                      ? "green"
                      : hk.hk.status === "DIRTY"
                      ? "amber"
                      : hk.hk.status === "MAINTENANCE"
                      ? "blue"
                      : "red"
                  }
                >
                  {hk.hk.status}
                </Badge>
              ) : null}

              {room?.reserved ? <Badge tone="red">OCCUPIED</Badge> : <Badge tone="gray">VACANT</Badge>}
              {myRole ? <Badge tone="gray">Role: {myRole}</Badge> : <Badge tone="gray">Role: —</Badge>}
            </div>

            <div className="mt-2 text-sm text-gray-700">
              <div className="font-medium">{guestName}</div>
              <div className="text-xs text-gray-500">
                {guestEmail}
                {guestPhone ? ` • ${guestPhone}` : ""}
              </div>
            </div>

            <div className="mt-2 text-xs text-gray-600">
              Stay: <span className="font-semibold">{stayStartKey}</span> →{" "}
              <span className="font-semibold">{stayEndKey}</span>
              {" • "}
              Guests: <span className="font-semibold">{stayGuests}</span>
              {" • "}
              Nightly rate:{" "}
              {nightlyRate > 0 ? (
                <span className="font-semibold">{formatMoney(nightlyRate, currency)}</span>
              ) : (
                <span className="text-amber-700 font-semibold">Not set</span>
              )}
              {" • "}
              Currency: <span className="font-semibold">{currency}</span>
            </div>

            <div className="mt-1 text-[11px] text-gray-500">
              Policies: Auto-post room charges{" "}
              <span className="font-semibold">{hotelSettings.autoPostRoomCharges ? "ON" : "OFF"}</span>
              {" • "}
              Checkout requires paid folio{" "}
              <span className="font-semibold">{checkoutRequiresPaidFolio ? "YES" : "NO"}</span>
            </div>

            {anchor?.createdByUserEmail ? (
              <div className="mt-1 text-[11px] text-gray-500">
                Booking created by: <span className="font-semibold">{anchor.createdByUserEmail}</span>{" "}
                {anchor.createdBy ? <span className="text-gray-400">({String(anchor.createdBy)})</span> : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={refreshAll}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              disabled={isLoading}
            >
              Refresh
            </button>

          

            <Link
              href={`/dashboard/folio/${reservationId}/print`}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              title="Open the legacy print view for this reservation id (day-scope)"
            >
              Print view →
            </Link>

            <Link href="/dashboard/reception" className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
              Reception →
            </Link>
          </div>
        </div>

        {anyError ? (
          <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm p-3">Error: {anyError.message}</div>
        ) : null}

        {isLoading ? <div className="mt-3 text-sm text-gray-500">Loading…</div> : null}
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 mt-4 md:grid-cols-5">
        <Card title="Room Charges" value={formatMoney(totals.roomTotal, currency)} subtitle="Nightly charges" />
        <Card title="Menu Charges" value={formatMoney(totals.menuTotal, currency)} subtitle="Room service / orders" />
        <Card title="Total" value={formatMoney(totals.grandTotal, currency)} subtitle="Room + Menu" />
        <Card title="Paid" value={formatMoney(totals.paidTotal, currency)} subtitle={`${totals.paidCount} paid item(s)`} />
        <Card
          title="Balance Due"
          value={formatMoney(totals.balanceDue, currency)}
          subtitle={totals.unpaidCount ? `${totals.unpaidCount} unpaid item(s)` : "All paid ✅"}
        />
      </div>

      {/* Payment breakdown */}
      {paymentsByMethod.length ? (
        <div className="mt-3 rounded-2xl border bg-white shadow-sm p-4">
          <div className="text-sm font-semibold">Payments breakdown</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {paymentsByMethod.map((p) => (
              <Badge key={p.method} tone="green">
                {p.method}: {formatMoney(p.amount, currency)} • {p.count} item(s)
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {missingRoomChargeReservationIds.length > 0 ? (
              <div className="rounded-lg bg-amber-50 text-amber-900 px-3 py-2 text-sm">
                Missing nightly room charges:{" "}
                <span className="font-semibold">{missingRoomChargeReservationIds.length}</span>
              </div>
            ) : (
              <div className="rounded-lg bg-emerald-50 text-emerald-900 px-3 py-2 text-sm">
                Nightly room charges are posted ✅
              </div>
            )}

            <button
              onClick={postMissingRoomCharges}
              disabled={missingRoomChargeReservationIds.length === 0 || !staffEmail}
              className="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm hover:bg-gray-950 disabled:bg-gray-300"
              title={
                !staffEmail
                  ? "Login required"
                  : nightlyRate <= 0
                  ? "Nightly rate not set"
                  : "Posts ONLY missing nights using system idempotency rules"
              }
            >
              Post missing room charges
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="rounded-lg border px-3 py-2 text-sm bg-white"
              title="Payment method marker"
            >
              <option value="CARD">Card</option>
              <option value="CASH">Cash</option>
              <option value="TRANSFER">Bank transfer</option>
            </select>

            <button
              onClick={markAllUnpaidPaid}
              disabled={paying || totals.balanceDue <= 0 || !staffEmail}
              className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm hover:bg-emerald-700 disabled:bg-gray-300"
              title={!staffEmail ? "Login required" : "Marks all unpaid orders as paid (records paymentToken)"}
            >
              {paying ? "Paying…" : "Mark all unpaid as paid"}
            </button>

            <div className="flex items-center gap-2 ml-2">
              <input
                type="checkbox"
                checked={overrideCheckout}
                onChange={(e) => setOverrideCheckout(e.target.checked)}
                disabled={!canOverride}
              />
              <span className={`text-xs ${canOverride ? "text-gray-700" : "text-gray-400"}`}>
                Manager override checkout
              </span>
            </div>

            <button
              onClick={doCheckout}
              disabled={completing || toggling || updatingTables || !staffEmail}
              className="rounded-lg bg-blue-700 text-white px-3 py-2 text-sm hover:bg-blue-800 disabled:bg-gray-300"
              title="Completes stay + releases room + marks DIRTY. Blocked when unpaid (unless override)."
            >
              {completing || toggling || updatingTables ? "Processing…" : "Checkout stay"}
            </button>
          </div>
        </div>

        {!staffEmail ? (
          <div className="mt-3 text-xs text-amber-700">
            Login required to take payment / post charges / checkout.
          </div>
        ) : null}
      </div>

      {/* Charges Breakdown */}
      <div className="grid gap-4 mt-4 lg:grid-cols-2">
        {/* Room Charges */}
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <div className="text-sm font-semibold">Room Charges</div>
            <div className="text-xs text-gray-500">Nightly room charge lines linked to this stay</div>
          </div>

          <div className="p-4">
            {roomChargeOrders.length === 0 ? (
              <div className="text-sm text-gray-500">No room charges posted.</div>
            ) : (
              <div className="divide-y">
                {roomChargeOrders
                  .slice()
                  .sort((a, b) => effectiveOrderDateKey(a as any).localeCompare(effectiveOrderDateKey(b as any)))
                  .map((o) => {
                    const meta = parseRoomChargeMeta((o as any).note);
                    const dk = meta.dateKey ?? effectiveOrderDateKey(o as any);
                    const paid = orderIsPaid(o as any);
                    const method = paid ? paymentMethodFromToken((o as any).paymentToken) : "—";

                    return (
                      <div key={(o as any).id} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900">Nightly Room Charge</div>
                            <div className="text-xs text-gray-500">
                              Date: <span className="font-medium">{dk}</span> • Ref:{" "}
                              <span className="font-mono">{String((o as any).orderNumber ?? "")}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-semibold">{formatMoney(orderTotal(o), currency)}</div>
                            <div className="mt-1">
                              {paid ? (
                                <Badge tone="green">PAID • {method}</Badge>
                              ) : (
                                <Badge tone="amber">UNPAID</Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {!paid ? (
                          <div className="mt-2 flex justify-end">
                            <button
                              onClick={() => markOrderPaid((o as any).id)}
                              className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
                            >
                              Mark paid
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Menu Charges */}
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-4 py-3">
            <div className="text-sm font-semibold">Menu Charges</div>
            <div className="text-xs text-gray-500">Room service / in-house orders</div>
          </div>

          <div className="p-4">
            {menuOrders.length === 0 ? (
              <div className="text-sm text-gray-500">No menu charges for this stay.</div>
            ) : (
              <div className="divide-y">
                {menuOrders
                  .slice()
                  .sort((a, b) => {
                    const ta = new Date(String((a as any).orderDate ?? "")).getTime() || 0;
                    const tb = new Date(String((b as any).orderDate ?? "")).getTime() || 0;
                    return ta - tb;
                  })
                  .map((o) => {
                    const dk = toLocalDateKey((o as any).orderDate) || "—";
                    const paid = orderIsPaid(o as any);
                    const method = paid ? paymentMethodFromToken((o as any).paymentToken) : "—";
                    const stream = inferRevenueStream(o as any);

                    return (
                      <div key={(o as any).id} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900">
                              Menu Order{" "}
                              <span className="font-mono text-xs text-gray-500">{String((o as any).orderNumber ?? "")}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              Date: <span className="font-medium">{dk}</span>{" "}
                              {stream === "MENU_EXTERNAL" ? "• External" : "• In‑house"}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-semibold">{formatMoney(orderTotal(o), currency)}</div>
                            <div className="mt-1">
                              {paid ? (
                                <Badge tone="green">PAID • {method}</Badge>
                              ) : (
                                <Badge tone="amber">UNPAID</Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {!paid ? (
                          <div className="mt-2 flex justify-end">
                            <button
                              onClick={() => markOrderPaid((o as any).id)}
                              className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
                            >
                              Mark paid
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-xs text-gray-500">
        Checkout completes all nights in the stay, releases the room, and marks it DIRTY + adds to cleaning list.
        Checkout is blocked when unpaid balance exists (unless manager override). Missing room charges block checkout only
        when Auto‑Post Room Charges policy is ON.
      </div>
    </div>
  );
}
