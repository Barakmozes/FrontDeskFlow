"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";

import {
  // data
  GetAreasNameDescriptionDocument,
  GetAreasNameDescriptionQuery,
  GetAreasNameDescriptionQueryVariables,

  GetTablesDocument,
  GetTablesQuery,
  GetTablesQueryVariables,

  GetReservationsDocument,
  GetReservationsQuery,
  GetReservationsQueryVariables,

  GetUserDocument,
  GetUserQuery,
  GetUserQueryVariables,

  // actions
  ToggleTableReservationDocument,
  ToggleTableReservationMutation,
  ToggleTableReservationMutationVariables,

  EditReservationDocument,
  EditReservationMutation,
  EditReservationMutationVariables,

  CancelReservationDocument,
  CancelReservationMutation,
  CancelReservationMutationVariables,

  ReservationStatus,
  Role,
} from "@/graphql/generated";

import { addDaysToDateKey, todayLocalDateKey, toLocalDateKey } from "@/lib/dateKey";
import { parseHousekeepingTags } from "@/lib/housekeepingTags";

type HkBadgeProps = { status: "CLEAN" | "DIRTY" | "MAINTENANCE" | "OUT_OF_ORDER" };
function HkBadge({ status }: HkBadgeProps) {
  const cls =
    status === "CLEAN"
      ? "bg-emerald-100 text-emerald-800"
      : status === "DIRTY"
      ? "bg-amber-100 text-amber-800"
      : status === "MAINTENANCE"
      ? "bg-blue-100 text-blue-800"
      : "bg-red-100 text-red-800";

  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] ${cls}`}>{status}</span>;
}

function ResStatusBadge({ status }: { status: ReservationStatus }) {
  const cls =
    status === ReservationStatus.Confirmed
      ? "bg-emerald-100 text-emerald-800"
      : status === ReservationStatus.Pending
      ? "bg-amber-100 text-amber-800"
      : status === ReservationStatus.Cancelled
      ? "bg-gray-100 text-gray-800"
      : "bg-blue-100 text-blue-800";

  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] ${cls}`}>{status}</span>;
}

function CardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-gray-500">{subtitle}</div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export default function ReceptionClient({ staffEmail }: { staffEmail: string | null }) {
  const [dateKey, setDateKey] = useState<string>(todayLocalDateKey());
  const [hotelFilterId, setHotelFilterId] = useState<string>("ALL");

  // Who am I? (role used for override rules)
  const [{ data: meData }] = useQuery<GetUserQuery, GetUserQueryVariables>({
    query: GetUserDocument,
    variables: staffEmail ? { email: staffEmail } : ({} as any),
    pause: !staffEmail,
  });

  const myRole = meData?.getUser?.role ?? null;
  const canOverride = myRole === Role.Admin || myRole === Role.Manager;

  // Hotels (Areas)
  const [{ data: hotelsData, fetching: hotelsFetching, error: hotelsError }] = useQuery<
    GetAreasNameDescriptionQuery,
    GetAreasNameDescriptionQueryVariables
  >({
    query: GetAreasNameDescriptionDocument,
    variables: { orderBy: { createdAt: "asc" as any } },
  });

  const hotels = hotelsData?.getAreasNameDescription ?? [];

  // Rooms (Tables)
  const [{ data: roomsData, fetching: roomsFetching, error: roomsError }] = useQuery<
    GetTablesQuery,
    GetTablesQueryVariables
  >({
    query: GetTablesDocument,
    variables: {},
  });

  const rooms = roomsData?.getTables ?? [];

  // Reservations
  const [{ data: resData, fetching: resFetching, error: resError }, refetchReservations] = useQuery<
    GetReservationsQuery,
    GetReservationsQueryVariables
  >({
    query: GetReservationsDocument,
    variables: {},
  });

  const reservations = resData?.getReservations ?? [];

  // Mutations
  const [{ fetching: toggling }, toggleRoomOccupied] = useMutation<
    ToggleTableReservationMutation,
    ToggleTableReservationMutationVariables
  >(ToggleTableReservationDocument);

  const [{ fetching: editing }, editReservation] = useMutation<
    EditReservationMutation,
    EditReservationMutationVariables
  >(EditReservationDocument);

  const [{ fetching: cancelling }, cancelReservation] = useMutation<
    CancelReservationMutation,
    CancelReservationMutationVariables
  >(CancelReservationDocument);

  // Maps
  const hotelNameById = useMemo(() => {
    const map = new Map<string, string>();
    hotels.forEach((h) => map.set(h.id, h.name));
    return map;
  }, [hotels]);

  const roomsById = useMemo(() => {
    const map = new Map<string, (typeof rooms)[number]>();
    rooms.forEach((r) => map.set(r.id, r));
    return map;
  }, [rooms]);

  // Filter helpers
  const inHotel = (areaId: string) => hotelFilterId === "ALL" || hotelFilterId === areaId;

  // View models
  const arrivals = useMemo(() => {
    return reservations
      .filter((r) => {
        const dk = toLocalDateKey(r.reservationTime);
        if (dk !== dateKey) return false;
        if (!inHotel(r.table.areaId)) return false;
        return r.status === ReservationStatus.Pending || r.status === ReservationStatus.Confirmed;
      })
      .sort((a, b) => new Date(a.reservationTime).getTime() - new Date(b.reservationTime).getTime());
  }, [reservations, dateKey, hotelFilterId]);

  /**
   * Departures v0:
   * - because Reservation has no checkout date in current schema,
   * - we treat “yesterday’s arrivals that are STILL occupied” as “Departures today”.
   */
  const departures = useMemo(() => {
    const yesterday = addDaysToDateKey(dateKey, -1);

    return reservations
      .filter((r) => {
        const dk = toLocalDateKey(r.reservationTime);
        if (dk !== yesterday) return false;
        if (!inHotel(r.table.areaId)) return false;

        // show only if room currently occupied
        return r.table.reserved === true && (r.status === ReservationStatus.Pending || r.status === ReservationStatus.Confirmed);
      })
      .sort((a, b) => new Date(a.reservationTime).getTime() - new Date(b.reservationTime).getTime());
  }, [reservations, dateKey, hotelFilterId]);

  const inHouseRooms = useMemo(() => {
    return rooms
      .filter((room) => room.reserved)
      .filter((room) => inHotel(room.areaId))
      .sort((a, b) => a.tableNumber - b.tableNumber)
      .map((room) => {
        // find the most recent reservation for this occupied room
        const latest = reservations
          .filter((r) => r.tableId === room.id && r.status !== ReservationStatus.Cancelled && r.status !== ReservationStatus.Completed)
          .sort((a, b) => new Date(b.reservationTime).getTime() - new Date(a.reservationTime).getTime())[0];

        return { room, latestReservation: latest ?? null };
      });
  }, [rooms, reservations, hotelFilterId]);

  const isLoading = hotelsFetching || roomsFetching || resFetching;
  const anyError = hotelsError || roomsError || resError;

  async function doCheckIn(reservationId: string) {
    const r = reservations.find((x) => x.id === reservationId);
    if (!r) return toast.error("Reservation not found.");

    const room = roomsById.get(r.tableId);
    if (!room) return toast.error("Room not found.");

    if (room.reserved) return toast.error("Room is already occupied.");

    const {hk}= parseHousekeepingTags(room.specialRequests);
    if (hk.status !== "CLEAN" && !canOverride) {
      toast.error("Room is not READY (clean). Manager/Admin override required.");
      return;
    }

    // 1) confirm reservation (if still pending)
    if (r.status === ReservationStatus.Pending) {
      const e = await editReservation({
        editReservationId: reservationId,
        status: ReservationStatus.Confirmed,
      });
      if (e.error) {
        console.error(e.error);
        toast.error("Failed to confirm reservation.");
        return;
      }
    }

    // 2) mark room occupied
    const t = await toggleRoomOccupied({
      toggleTableReservationId: r.tableId,
      reserved: true,
    });

    if (t.error) {
      console.error(t.error);
      toast.error("Failed to mark room occupied.");
      return;
    }

    toast.success(`Checked-in to Room ${room.tableNumber}`);
    refetchReservations({ requestPolicy: "network-only" });
  }

  async function doCancel(reservationId: string) {
    const ok = window.confirm("Cancel this reservation?");
    if (!ok) return;

    const res = await cancelReservation({ cancelReservationId: reservationId });
    if (res.error) {
      console.error(res.error);
      toast.error("Failed to cancel reservation.");
      return;
    }

    toast.success("Reservation cancelled.");
    refetchReservations({ requestPolicy: "network-only" });
  }

  return (
    <div className="px-6 py-6 bg-gray-50 min-h-screen">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reception • Daily Ops</h1>
          <p className="text-sm text-gray-600">
            Arrivals / Departures / In‑house guests (built on current reservations + room occupancy).
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-gray-600">Date</label>
            <input
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600">Hotel</label>
            <select
              value={hotelFilterId}
              onChange={(e) => setHotelFilterId(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm bg-white"
            >
              <option value="ALL">All hotels</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="rounded-md bg-black px-3 py-2 text-sm text-white hover:opacity-90"
            onClick={() => refetchReservations({ requestPolicy: "network-only" })}
          >
            Refresh
          </button>

          <div className="ml-2 text-xs text-gray-600">
            Role: <span className="font-semibold">{myRole ?? "—"}</span>
          </div>
        </div>
      </div>

      {isLoading ? <div className="text-sm text-gray-500 mb-3">Loading…</div> : null}
      {anyError ? (
        <div className="text-sm text-red-600 mb-3">Error: {anyError.message}</div>
      ) : null}

      {/* Legend */}
      <div className="mb-4 rounded-lg border bg-white px-4 py-3">
        <div className="text-xs text-gray-600 flex flex-wrap gap-3 items-center">
          <span className="font-semibold">Legend:</span>
          <span className="inline-flex items-center gap-1">
            <ResStatusBadge status={ReservationStatus.Pending} /> Pending arrival
          </span>
          <span className="inline-flex items-center gap-1">
            <ResStatusBadge status={ReservationStatus.Confirmed} /> Confirmed
          </span>
          <span className="inline-flex items-center gap-1">
            <HkBadge status="CLEAN" /> Ready
          </span>
          <span className="inline-flex items-center gap-1">
            <HkBadge status="DIRTY" /> Needs cleaning
          </span>
          <span className="inline-flex items-center gap-1">
            <HkBadge status="MAINTENANCE" /> Maintenance
          </span>
          <span className="inline-flex items-center gap-1">
            <HkBadge status="OUT_OF_ORDER" /> Out of order
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Arrivals */}
        <CardShell
          title={`Arrivals (${arrivals.length})`}
          subtitle={`Reservations on ${dateKey}`}
        >
          {arrivals.length === 0 ? (
            <div className="text-sm text-gray-500 p-2">No arrivals.</div>
          ) : (
            <div className="grid gap-2">
              {arrivals.map((r) => {
                const {hk}= parseHousekeepingTags(r.table.specialRequests);
                const hotelName = hotelNameById.get(r.table.areaId) ?? "Hotel";
                const guestName = r.user?.profile?.name?.trim() || r.userEmail;
                const time = new Date(r.reservationTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                return (
                  <div key={r.id} className="rounded-lg border p-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">
                          Room {r.table.tableNumber} <span className="text-xs text-gray-500">· {hotelName}</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {guestName} · {r.numOfDiners} guests · {time}
                        </div>
                        <div className="mt-1 flex gap-2 items-center">
                          <ResStatusBadge status={r.status} />
                          <HkBadge status={hk.status} />
                          {r.table.reserved ? (
                            <span className="text-[11px] bg-gray-100 text-gray-800 rounded-full px-2 py-1">OCCUPIED</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <button
                          onClick={() => doCheckIn(r.id)}
                          disabled={toggling || editing}
                          className="rounded-md bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-700 disabled:bg-gray-300"
                          title="Confirm + mark room occupied"
                        >
                          Check‑in
                        </button>

                        <button
                          onClick={() => doCancel(r.id)}
                          disabled={cancelling}
                          className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50 disabled:bg-gray-100"
                        >
                          Cancel
                        </button>

                        <Link
                          href={`/dashboard/folio/${r.id}`}
                          className="text-xs text-blue-700 hover:underline"
                          title="Open billing folio"
                        >
                          Open folio →
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardShell>

        {/* Departures */}
        <CardShell
          title={`Departures v0 (${departures.length})`}
          subtitle={`Yesterday’s arrivals still occupied (until checkout-date exists in DB)`}
        >
          {departures.length === 0 ? (
            <div className="text-sm text-gray-500 p-2">No departures (v0).</div>
          ) : (
            <div className="grid gap-2">
              {departures.map((r) => {
                const hotelName = hotelNameById.get(r.table.areaId) ?? "Hotel";
                const guestName = r.user?.profile?.name?.trim() || r.userEmail;

                return (
                  <div key={r.id} className="rounded-lg border p-3 bg-white">
                    <div className="text-sm font-semibold">
                      Room {r.table.tableNumber} <span className="text-xs text-gray-500">· {hotelName}</span>
                    </div>
                    <div className="text-xs text-gray-600">{guestName}</div>

                    <div className="mt-2 flex items-center justify-between">
                      <ResStatusBadge status={r.status} />

                      {/* Checkout is intentionally routed through Folio to respect "no checkout with open balance" policy */}
                      <Link
                        href={`/dashboard/folio/${r.id}`}
                        className="rounded-md bg-blue-700 px-3 py-2 text-xs text-white hover:bg-blue-800"
                      >
                        Checkout via folio
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardShell>

        {/* In-house */}
        <CardShell
          title={`In‑house (${inHouseRooms.length})`}
          subtitle={`Rooms with reserved=true (occupied)`}
        >
          {inHouseRooms.length === 0 ? (
            <div className="text-sm text-gray-500 p-2">No occupied rooms.</div>
          ) : (
            <div className="grid gap-2">
              {inHouseRooms.map(({ room, latestReservation }) => {
                const {hk }= parseHousekeepingTags(room.specialRequests);
                const hotelName = hotelNameById.get(room.areaId) ?? "Hotel";
                const guestName =
                  latestReservation?.user?.profile?.name?.trim() ||
                  latestReservation?.userEmail ||
                  "—";

                return (
                  <div key={room.id} className="rounded-lg border p-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">
                          Room {room.tableNumber} <span className="text-xs text-gray-500">· {hotelName}</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          Guest: {guestName}
                        </div>
                        <div className="mt-1 flex gap-2 items-center">
                          <HkBadge status={hk.status} />
                          <span className="text-[11px] bg-gray-100 text-gray-800 rounded-full px-2 py-1">OCCUPIED</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        {latestReservation ? (
                          <Link
                            href={`/dashboard/folio/${latestReservation.id}`}
                            className="text-xs text-blue-700 hover:underline"
                          >
                            Folio →
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400">No reservation linked</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardShell>
      </div>
    </div>
  );
}
