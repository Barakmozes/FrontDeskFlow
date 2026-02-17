"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@urql/next";
import toast from "react-hot-toast";

import {
  // Hotels (Areas)
  GetAreasNameDescriptionDocument,
  type GetAreasNameDescriptionQuery,
  type GetAreasNameDescriptionQueryVariables,

  // Rooms (Tables)
  GetTablesDocument,
  type GetTablesQuery,
  type GetTablesQueryVariables,

  // Reservations
  GetReservationsDocument,
  type GetReservationsQuery,
  type GetReservationsQueryVariables,

  ReservationStatus,
} from "@/graphql/generated";

// ✅ Use the shared grouping logic (already used in your Orders/Reception side)
import {
  groupReservationsIntoStays,
  todayLocalDateKey,
  toLocalDateKey,
  type StayBlock,
} from "@/lib/stayGrouping";

type Res = GetReservationsQuery["getReservations"][number];

type Tab = "OPEN" | "IN_HOUSE" | "HISTORY" | "ALL";

type StayVM = StayBlock & {
  hotelName: string;
  coversToday: boolean;
  isInHouseToday: boolean;
  isArrivalTodayNotCheckedIn: boolean;
};

const isStaffRole = (role?: string | null) =>
  role === "ADMIN" || role === "MANAGER" || role === "WAITER"; // until hotel roles migrate

const isClosedStatus = (s: ReservationStatus) =>
  s === ReservationStatus.Completed || s === ReservationStatus.Cancelled;

const isOpenStatus = (s: ReservationStatus) => !isClosedStatus(s);

function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusPill(s: ReservationStatus) {
  const cls =
    s === ReservationStatus.Pending
      ? "bg-amber-100 text-amber-800"
      : s === ReservationStatus.Confirmed
      ? "bg-emerald-100 text-emerald-800"
      : s === ReservationStatus.Completed
      ? "bg-blue-100 text-blue-800"
      : "bg-gray-100 text-gray-700";

  return (
    <span className={`text-[10px] px-2 py-1 rounded-full ${cls}`}>
      {String(s).toUpperCase()}
    </span>
  );
}

function isDateKey(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function stayMatchesSearch(stay: StayVM, q: string): boolean {
  if (!q) return true;
  const query = q.toLowerCase();

  // dateKey search: match if the date is inside stay range
  if (isDateKey(query)) {
    return stay.startDateKey <= query && stay.lastNightKey >= query;
  }

  const hay = [
    stay.hotelName,
    `room ${stay.roomNumber}`,
    stay.roomNumber,
    stay.guestName,
    stay.userEmail,
    stay.guestPhone ?? "",
    stay.startDateKey,
    stay.endDateKey,
    stay.lastNightKey,
    stay.status,
  ]
    .join(" ")
    .toLowerCase();

  return hay.includes(query);
}

function reservationMatchesSearch(r: Res, q: string): boolean {
  if (!q) return true;
  const query = q.toLowerCase();

  const roomNo = String(r.table?.tableNumber ?? "");
  const dateKey = toLocalDateKey(r.reservationTime);
  const guestName = (r.user?.profile?.name ?? "").toLowerCase();
  const guestEmail = (r.userEmail ?? "").toLowerCase();
  const guestPhone = (r.user?.profile?.phone ?? "").toLowerCase();
  const status = String(r.status ?? "").toLowerCase();

  const hay = `${roomNo} ${dateKey} ${guestName} ${guestEmail} ${guestPhone} ${status}`.toLowerCase();
  return hay.includes(query);
}

export default function ReservationsList({
  staffEmail,
  staffRole,
}: {
  staffEmail: string | null;
  staffRole: string | null;
}) {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();

  // UI state
  const [tab, setTab] = useState<Tab>("OPEN");
  const [hotelId, setHotelId] = useState<string>("ALL");
  const [roomId, setRoomId] = useState<string>("ALL");
  const [showGuestDetails, setShowGuestDetails] = useState(true);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [groupByStay, setGroupByStay] = useState(true);

  // expand/collapse for stays
  const [expandedStayIds, setExpandedStayIds] = useState<Record<string, boolean>>({});

  // ✅ keep “today” fresh (prevents stale view if user leaves page open)
  const [todayKey, setTodayKey] = useState(() => todayLocalDateKey());
  useEffect(() => {
    const t = setInterval(() => setTodayKey(todayLocalDateKey()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Permission gate
  const canView = isStaffRole(staffRole);

  useEffect(() => {
    if (staffEmail && !canView) toast.error("You do not have permission to view reservations.");
  }, [staffEmail, canView]);

  // Hotels
  const [{ data: hotelsData, fetching: hotelsFetching, error: hotelsError }] =
    useQuery<GetAreasNameDescriptionQuery, GetAreasNameDescriptionQueryVariables>({
      query: GetAreasNameDescriptionDocument,
      variables: { orderBy: { createdAt: "asc" as any } },
      requestPolicy: "cache-and-network",
    });

  const hotels = hotelsData?.getAreasNameDescription ?? [];
  const hotelNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of hotels) m.set(h.id, h.name);
    return m;
  }, [hotels]);

  // Rooms
  const [{ data: roomsData, fetching: roomsFetching, error: roomsError }, refetchRooms] =
    useQuery<GetTablesQuery, GetTablesQueryVariables>({
      query: GetTablesDocument,
      variables: {},
      requestPolicy: "cache-and-network",
    });

  const rooms = roomsData?.getTables ?? [];

  const roomsForHotel = useMemo(() => {
    if (hotelId === "ALL") return rooms;
    return rooms.filter((r) => r.areaId === hotelId);
  }, [rooms, hotelId]);

  // Reset room selection if it doesn't belong to selected hotel
  useEffect(() => {
    if (roomId === "ALL") return;
    const exists = roomsForHotel.some((r) => r.id === roomId);
    if (!exists) setRoomId("ALL");
  }, [roomsForHotel, roomId]);

  // Reservations
  const [{ data: resData, fetching: resFetching, error: resError }, refetchReservations] =
    useQuery<GetReservationsQuery, GetReservationsQueryVariables>({
      query: GetReservationsDocument,
      variables: {},
      requestPolicy: "cache-and-network",
    });

  const allReservations = resData?.getReservations ?? [];
  const loading = hotelsFetching || roomsFetching || resFetching;

  // Base filtering by hotel/room/cancelled
  const baseReservations = useMemo(() => {
    let list = allReservations;

    if (hotelId !== "ALL") list = list.filter((r) => r.table.areaId === hotelId);
    if (roomId !== "ALL") list = list.filter((r) => r.table.id === roomId);

    // ✅ only hide cancelled if toggle off (Completed stays are still kept for history)
    if (!includeCancelled) {
      list = list.filter((r) => r.status !== ReservationStatus.Cancelled);
    }

    return list;
  }, [allReservations, hotelId, roomId, includeCancelled]);

  // ---------------- STAYS ----------------
const staysAll: StayVM[] = useMemo(() => {
  const stays = groupReservationsIntoStays(baseReservations); // ✅ FIX

  return stays.map((s) => {
    const hotelName = hotelNameById.get(s.hotelId) ?? "—";

    const coversToday = s.startDateKey <= todayKey && s.lastNightKey >= todayKey;

    const isInHouseToday = coversToday && !!s.tableReservedNow;

    const isArrivalTodayNotCheckedIn =
      coversToday && s.startDateKey === todayKey && !s.tableReservedNow;

    return {
      ...s,
      hotelName,
      coversToday,
      isInHouseToday,
      isArrivalTodayNotCheckedIn,
    };
  });
}, [baseReservations, todayKey, hotelNameById]);

  const staysSearch = useMemo(() => {
    if (!q) return staysAll;
    return staysAll.filter((s) => stayMatchesSearch(s, q));
  }, [staysAll, q]);

  const staysOpen = useMemo(() => staysSearch.filter((s) => isOpenStatus(s.status)), [staysSearch]);
  const staysInHouse = useMemo(
    () => staysOpen.filter((s) => s.isInHouseToday),
    [staysOpen]
  );
  const staysHistory = useMemo(
    () => staysSearch.filter((s) => isClosedStatus(s.status)),
    [staysSearch]
  );

  // ---------------- NIGHTLY RESERVATIONS ----------------
  const reservationsSearch = useMemo(() => {
    if (!q) return baseReservations;
    return baseReservations.filter((r) => reservationMatchesSearch(r, q));
  }, [baseReservations, q]);

  const reservationsOpen = useMemo(
    () => reservationsSearch.filter((r) => isOpenStatus(r.status)),
    [reservationsSearch]
  );

  const reservationsHistory = useMemo(
    () => reservationsSearch.filter((r) => isClosedStatus(r.status)),
    [reservationsSearch]
  );

  // “In-house” nightly view: pick latest <= today per room, confirmed & reserved
  const reservationsInHouse = useMemo(() => {
    const candidates = reservationsOpen.filter((r) => {
      if (!r.table?.reserved) return false;
      if (r.status !== ReservationStatus.Confirmed) return false;
      const dk = toLocalDateKey(r.reservationTime);
      return dk !== "" && dk <= todayKey;
    });

    const byRoom = new Map<string, Res>();
    for (const r of candidates) {
      const prev = byRoom.get(r.table.id);
      if (!prev) {
        byRoom.set(r.table.id, r);
        continue;
      }
      const tp = new Date(prev.reservationTime).getTime();
      const tn = new Date(r.reservationTime).getTime();
      if (tn > tp) byRoom.set(r.table.id, r);
    }

    return Array.from(byRoom.values()).sort((a, b) => a.table.tableNumber - b.table.tableNumber);
  }, [reservationsOpen, todayKey]);

  // ---------------- COUNTS + ACTIVE LIST ----------------
  const counts = useMemo(() => {
    if (groupByStay) {
      return {
        open: staysOpen.length,
        inHouse: staysInHouse.length,
        history: staysHistory.length,
        all: staysSearch.length,
      };
    }
    return {
      open: reservationsOpen.length,
      inHouse: reservationsInHouse.length,
      history: reservationsHistory.length,
      all: reservationsSearch.length,
    };
  }, [
    groupByStay,
    staysOpen.length,
    staysInHouse.length,
    staysHistory.length,
    staysSearch.length,
    reservationsOpen.length,
    reservationsInHouse.length,
    reservationsHistory.length,
    reservationsSearch.length,
  ]);

  const listModeLabel = groupByStay ? "stays" : "reservations";

  const stayListForTab = useMemo(() => {
    if (tab === "IN_HOUSE") return staysInHouse;
    if (tab === "OPEN") return staysOpen;
    if (tab === "HISTORY") return staysHistory;
    return staysSearch;
  }, [tab, staysInHouse, staysOpen, staysHistory, staysSearch]);

  const reservationListForTab = useMemo(() => {
    if (tab === "IN_HOUSE") return reservationsInHouse;
    if (tab === "OPEN") return reservationsOpen;
    if (tab === "HISTORY") return reservationsHistory;
    return reservationsSearch;
  }, [tab, reservationsInHouse, reservationsOpen, reservationsHistory, reservationsSearch]);

  const toggleStayExpand = useCallback((stayId: string) => {
    setExpandedStayIds((prev) => ({ ...prev, [stayId]: !prev[stayId] }));
  }, []);

  if (!staffEmail) {
    return (
      <div className="px-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-md p-6 mt-6 text-sm text-gray-700">
          Please sign in to view reservations.
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="px-6 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-md p-6 mt-6 text-sm text-gray-700">
          You do not have permission to view this page.
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Reservations</h1>
            <p className="text-xs text-gray-500">
              ✅ Open reservations never disappear on check‑in. They move to History only after
              Checkout (Completed) or Cancelled.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                refetchReservations({ requestPolicy: "network-only" });
                refetchRooms({ requestPolicy: "network-only" });
                toast.success("Refreshed.");
              }}
              className="text-sm bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-950"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {/* Hotel */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Hotel</label>
            <select
              value={hotelId}
              onChange={(e) => setHotelId(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
            >
              <option value="ALL">All hotels</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {/* Room */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Room</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
            >
              <option value="ALL">All rooms</option>
              {roomsForHotel
                .slice()
                .sort((a, b) => a.tableNumber - b.tableNumber)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.tableNumber}
                  </option>
                ))}
            </select>
          </div>

          {/* Flags */}
          <div className="flex items-end gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={groupByStay}
                onChange={(e) => setGroupByStay(e.target.checked)}
              />
              Group by stay
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showGuestDetails}
                onChange={(e) => setShowGuestDetails(e.target.checked)}
              />
              Show guest details
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeCancelled}
                onChange={(e) => setIncludeCancelled(e.target.checked)}
              />
              Include cancelled
            </label>
          </div>

          {/* Today + search */}
          <div className="flex items-end justify-start md:justify-end">
            <div className="text-xs text-gray-500">
              Today: <span className="font-medium text-gray-800">{todayKey}</span>
              {q ? (
                <div className="mt-1">
                  Search: <span className="font-medium text-gray-800">{q}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("IN_HOUSE")}
            className={`text-xs px-3 py-2 rounded-lg border ${
              tab === "IN_HOUSE" ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            In‑house ({counts.inHouse})
          </button>

          <button
            type="button"
            onClick={() => setTab("OPEN")}
            className={`text-xs px-3 py-2 rounded-lg border ${
              tab === "OPEN" ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            Open ({counts.open})
          </button>

          <button
            type="button"
            onClick={() => setTab("HISTORY")}
            className={`text-xs px-3 py-2 rounded-lg border ${
              tab === "HISTORY" ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            History ({counts.history})
          </button>

          <button
            type="button"
            onClick={() => setTab("ALL")}
            className={`text-xs px-3 py-2 rounded-lg border ${
              tab === "ALL" ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            All ({counts.all})
          </button>
        </div>
      </div>

      {/* Errors */}
      {hotelsError || roomsError || resError ? (
        <div className="bg-white rounded-lg p-4 border text-sm text-red-600 mb-3">
          Failed to load: {(hotelsError || roomsError || resError)?.message}
        </div>
      ) : null}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-3 border-b text-xs text-gray-600">
          Showing{" "}
          <span className="font-medium text-gray-900">
            {groupByStay ? stayListForTab.length : reservationListForTab.length}
          </span>{" "}
          {listModeLabel}
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        ) : groupByStay ? (
          // ------------------- STAY VIEW -------------------
          stayListForTab.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">No stays match this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-600">
                    <th className="px-3 py-2 w-[44px]"></th>
                    <th className="px-3 py-2">Hotel</th>
                    <th className="px-3 py-2">Room</th>
                    <th className="px-3 py-2">Stay</th>
                    <th className="px-3 py-2">Nights</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Guest</th>
                    {showGuestDetails ? <th className="px-3 py-2">Email</th> : null}
                    {showGuestDetails ? <th className="px-3 py-2">Phone</th> : null}
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {stayListForTab.map((s) => {
                    const expanded = !!expandedStayIds[s.stayId];
                    const folioId = s.reservationIds?.[0];

                    return (
                      <React.Fragment key={s.stayId}>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => toggleStayExpand(s.stayId)}
                              className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-100"
                              title={expanded ? "Collapse nights" : "Expand nights"}
                            >
                              {expanded ? "−" : "+"}
                            </button>
                          </td>

                          <td className="px-3 py-2">{s.hotelName}</td>
                          <td className="px-3 py-2 font-medium">#{s.roomNumber}</td>

                          <td className="px-3 py-2">
                            <div className="text-xs text-gray-900">
                              {s.startDateKey} → {s.endDateKey}
                            </div>

                            {s.isInHouseToday ? (
                              <div className="text-[10px] text-emerald-700 font-semibold">
                                IN‑HOUSE TODAY
                              </div>
                            ) : s.isArrivalTodayNotCheckedIn ? (
                              <div className="text-[10px] text-amber-700 font-semibold">
                                ARRIVAL TODAY (not checked‑in)
                              </div>
                            ) : null}
                          </td>

                          <td className="px-3 py-2">{s.nights}</td>
                          <td className="px-3 py-2">{statusPill(s.status)}</td>

                          <td className="px-3 py-2 max-w-[220px] truncate">{s.guestName}</td>

                          {showGuestDetails ? (
                            <td className="px-3 py-2 max-w-[240px] truncate">{s.userEmail}</td>
                          ) : null}

                          {showGuestDetails ? (
                            <td className="px-3 py-2 max-w-[180px] truncate">
                              {s.guestPhone ?? "—"}
                            </td>
                          ) : null}

                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-2">
                              {folioId ? (
                                <Link
                                  href={`/dashboard/folio/${folioId}`}
                                  className="text-xs px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                                >
                                  Folio
                                </Link>
                              ) : null}

                              <Link
                                href="/dashboard/room-board"
                                className="text-xs px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                              >
                                Room Board
                              </Link>
                            </div>
                          </td>
                        </tr>

                        {expanded ? (
                          <tr className="border-b bg-white">
                            <td colSpan={showGuestDetails ? 10 : 8} className="px-3 py-3">
                              <div className="rounded-lg border bg-gray-50 p-3">
                                <div className="text-xs font-semibold text-gray-800 mb-2">
                                  Nights ({s.nights})
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs">
                                    <thead className="text-left text-[11px] text-gray-600">
                                      <tr>
                                        <th className="py-2 pr-3">Date</th>
                                        <th className="py-2 pr-3">Status</th>
                                        <th className="py-2 pr-3">Guests</th>
                                        <th className="py-2 pr-3">Created</th>
                                        <th className="py-2 pr-3 text-right">Actions</th>
                                      </tr>
                                    </thead>

                                    <tbody>
                                      {s.reservations.map((r: Res) => (
                                        <tr key={r.id} className="border-t">
                                          <td className="py-2 pr-3">
                                            {toLocalDateKey(r.reservationTime)}
                                          </td>
                                          <td className="py-2 pr-3">{statusPill(r.status)}</td>
                                          <td className="py-2 pr-3">{r.numOfDiners}</td>
                                          <td className="py-2 pr-3">
                                            {formatLocalDateTime(r.reservationTime)}
                                          </td>
                                          <td className="py-2 pr-3">
                                            <div className="flex justify-end gap-2">
                                              <Link
                                                href={`/dashboard/folio/${r.id}`}
                                                className="text-[11px] px-2 py-1 rounded bg-white border hover:bg-gray-100"
                                              >
                                                Folio
                                              </Link>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          // ------------------- NIGHTLY VIEW -------------------
          reservationListForTab.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">No reservations match this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs text-gray-600">
                    <th className="px-3 py-2">Hotel</th>
                    <th className="px-3 py-2">Room</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Guest</th>
                    {showGuestDetails ? <th className="px-3 py-2">Email</th> : null}
                    {showGuestDetails ? <th className="px-3 py-2">Phone</th> : null}
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {reservationListForTab.map((r) => {
                    const hotelName = hotelNameById.get(r.table.areaId) ?? "—";
                    const roomNo = r.table.tableNumber;

                    const guestName = r.user?.profile?.name || r.userEmail || "—";
                    const guestEmail = r.userEmail || "—";
                    const guestPhone = r.user?.profile?.phone ?? "—";

                    return (
                      <tr key={r.id} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2">{hotelName}</td>
                        <td className="px-3 py-2 font-medium">#{roomNo}</td>
                        <td className="px-3 py-2">{formatLocalDateTime(r.reservationTime)}</td>
                        <td className="px-3 py-2">{statusPill(r.status)}</td>
                        <td className="px-3 py-2 max-w-[220px] truncate">{guestName}</td>

                        {showGuestDetails ? (
                          <td className="px-3 py-2 max-w-[240px] truncate">{guestEmail}</td>
                        ) : null}

                        {showGuestDetails ? (
                          <td className="px-3 py-2 max-w-[180px] truncate">{guestPhone}</td>
                        ) : null}

                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/dashboard/folio/${r.id}`}
                              className="text-xs px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                            >
                              Folio
                            </Link>

                            <Link
                              href="/dashboard/room-board"
                              className="text-xs px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                              Room Board
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
