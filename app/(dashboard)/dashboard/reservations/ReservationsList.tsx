"use client";

import React, { useEffect, useMemo, useState } from "react";
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

type Res = GetReservationsQuery["getReservations"][number];

type Tab = "EXISTING" | "FUTURE" | "PAST" | "ALL";

type StayBlock = {
  stayId: string;

  hotelId: string;
  hotelName: string;

  roomId: string;
  roomNumber: number;

  userEmail: string;
  guestName: string;
  guestPhone: string | null;

  // Derived from grouped nights:
  startDateKey: string; // check-in date (first night key)
  lastNightKey: string; // last night in the sequence (inclusive)
  endDateKey: string; // checkout date (day after lastNightKey)
  nights: number;

  status: ReservationStatus; // aggregated status
  isOccupiedToday: boolean; // derived by date-range (not just room.reserved)
  isArrivalTodayNotCheckedIn: boolean;

  // Under the hood:
  reservations: Res[]; // sorted by date
  reservationIds: string[];
};

const isStaffRole = (role?: string | null) =>
  role === "ADMIN" || role === "MANAGER" || role === "WAITER"; // until hotel roles migrate

const pad2 = (n: number) => String(n).padStart(2, "0");

function localTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * We compare YYYY-MM-DD strings lexicographically (works correctly).
 */
function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDateKeyToLocalMidday(dateKey: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Use midday local to avoid DST boundary issues.
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const dt = parseDateKeyToLocalMidday(dateKey);
  if (!dt) return dateKey;
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function isDateKey(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

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

/**
 * Aggregate status for a stay.
 * We keep it simple and hotel-friendly:
 * - If ALL cancelled => Cancelled
 * - Else if ANY confirmed => Confirmed
 * - Else if ANY pending => Pending
 * - Else if ANY completed => Completed
 */
function aggregateStayStatus(nights: Res[]): ReservationStatus {
  if (nights.length === 0) return ReservationStatus.Pending;

  const allCancelled = nights.every((r) => r.status === ReservationStatus.Cancelled);
  if (allCancelled) return ReservationStatus.Cancelled;

  if (nights.some((r) => r.status === ReservationStatus.Confirmed)) return ReservationStatus.Confirmed;
  if (nights.some((r) => r.status === ReservationStatus.Pending)) return ReservationStatus.Pending;
  if (nights.some((r) => r.status === ReservationStatus.Completed)) return ReservationStatus.Completed;

  return nights[0].status;
}

/**
 * Split a sorted list of dateKeys into contiguous sequences.
 * Example: 20,21,22 => one block. 20,22 => two blocks.
 */
function splitContiguousDateKeys(sorted: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const dk of sorted) {
    if (current.length === 0) {
      current = [dk];
      continue;
    }

    const prev = current[current.length - 1];
    const prevPlus1 = addDaysToDateKey(prev, 1);

    if (dk === prevPlus1) {
      current.push(dk);
    } else {
      blocks.push(current);
      current = [dk];
    }
  }

  if (current.length) blocks.push(current);
  return blocks;
}

/**
 * Build multi-night stays from the "one reservation per night" bridge model.
 *
 * Grouping rules:
 * - Same roomId + same userEmail
 * - Nights are stitched into contiguous sequences by dateKey
 */
function groupReservationsIntoStays(args: {
  reservations: Res[];
  todayKey: string;
  hotelNameById: Map<string, string>;
}): StayBlock[] {
  const { reservations, todayKey, hotelNameById } = args;

  // 1) Group by (roomId + userEmail)
  const byRoomUser = new Map<string, Res[]>();

  for (const r of reservations) {
    const roomId = r.table.id;
    const userEmail = r.userEmail ?? "";
    const k = `${roomId}||${userEmail}`;
    const list = byRoomUser.get(k) ?? [];
    list.push(r);
    byRoomUser.set(k, list);
  }

  const stays: StayBlock[] = [];

  // 2) Within each group: sort by dateKey and split contiguous sequences
  for (const list of Array.from(byRoomUser.values())) {
  const withKeys = list
    .map((r) => ({ r, dk: toLocalDateKey(r.reservationTime) }))
    .filter((x) => !!x.dk);

  withKeys.sort((a, b) => a.dk.localeCompare(b.dk));

  const byDate = new Map<string, Res>();
  for (const x of withKeys) {
    if (!byDate.has(x.dk)) byDate.set(x.dk, x.r);
  }

    const dateKeys = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));
    const blocks = splitContiguousDateKeys(dateKeys);

    for (const blockKeys of blocks) {
      const nights = blockKeys.map((dk) => byDate.get(dk)!).filter(Boolean);

      // Defensive: nights might be empty
      if (nights.length === 0) continue;

      const first = nights[0];
      const last = nights[nights.length - 1];

      const hotelId = first.table.areaId;
      const hotelName = hotelNameById.get(hotelId) ?? "—";
      const roomId = first.table.id;
      const roomNumber = first.table.tableNumber;

      const userEmail = first.userEmail ?? "";
      const guestName = first.user?.profile?.name || userEmail || "—";
      const guestPhone = first.user?.profile?.phone ?? null;

      const startDateKey = blockKeys[0];
      const lastNightKey = blockKeys[blockKeys.length - 1];
      const endDateKey = addDaysToDateKey(lastNightKey, 1);

      // Determine current occupancy for THIS stay:
      // - coversToday: start <= today <= lastNight
      const coversToday = startDateKey <= todayKey && lastNightKey >= todayKey;

      // table.reserved represents current room occupancy. But it is not per-reservation,
      // so we only interpret it within the stay that covers today.
      const tableReservedNow = !!first.table.reserved;

      const isOccupiedToday = coversToday && tableReservedNow;
      const isArrivalTodayNotCheckedIn = coversToday && !tableReservedNow && startDateKey === todayKey;

      const stay: StayBlock = {
        stayId: `${roomId}::${userEmail}::${startDateKey}`,

        hotelId,
        hotelName,

        roomId,
        roomNumber,

        userEmail,
        guestName,
        guestPhone,

        startDateKey,
        lastNightKey,
        endDateKey,
        nights: nights.length,

        status: aggregateStayStatus(nights),
        isOccupiedToday,
        isArrivalTodayNotCheckedIn,

        reservations: nights,
        reservationIds: nights.map((r) => r.id),
      };

      stays.push(stay);
    }
  }

  // Sort stays: hotel, room, date
  stays.sort((a, b) => {
    const ha = a.hotelName.localeCompare(b.hotelName);
    if (ha !== 0) return ha;
    if (a.roomNumber !== b.roomNumber) return a.roomNumber - b.roomNumber;
    return a.startDateKey.localeCompare(b.startDateKey);
  });

  return stays;
}

function stayMatchesSearch(stay: StayBlock, q: string): boolean {
  if (!q) return true;

  const qLower = q.toLowerCase();

  // If query is a dateKey, allow "date inside stay range"
  if (isDateKey(qLower)) {
    return stay.startDateKey <= qLower && stay.lastNightKey >= qLower;
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

  return hay.includes(qLower);
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
  const [tab, setTab] = useState<Tab>("FUTURE");
  const [hotelId, setHotelId] = useState<string>("ALL");
  const [roomId, setRoomId] = useState<string>("ALL");
  const [showGuestDetails, setShowGuestDetails] = useState(true);
  const [includeCancelled, setIncludeCancelled] = useState(false);

  // ✅ improvement: group into stays (toggle)
  const [groupByStay, setGroupByStay] = useState(true);

  // expand/collapse for stays
  const [expandedStayIds, setExpandedStayIds] = useState<Record<string, boolean>>({});

  const todayKey = useMemo(() => localTodayKey(), []);

  // Permission gate
  const canView = isStaffRole(staffRole);

  useEffect(() => {
    if (staffEmail && !canView) {
      toast.error("You do not have permission to view reservations.");
    }
  }, [staffEmail, canView]);

  // Hotels
  const [
    { data: hotelsData, fetching: hotelsFetching, error: hotelsError },
  ] = useQuery<GetAreasNameDescriptionQuery, GetAreasNameDescriptionQueryVariables>({
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
  const [
    { data: roomsData, fetching: roomsFetching, error: roomsError },
    refetchRooms,
  ] = useQuery<GetTablesQuery, GetTablesQueryVariables>({
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
  const [
    { data: resData, fetching: resFetching, error: resError },
    refetchReservations,
  ] = useQuery<GetReservationsQuery, GetReservationsQueryVariables>({
    query: GetReservationsDocument,
    variables: {},
    requestPolicy: "cache-and-network",
  });

  const allReservations = resData?.getReservations ?? [];

  const loading = hotelsFetching || roomsFetching || resFetching;

  // Base filtering by hotel/room/cancelled (search is applied later)
  const base = useMemo(() => {
    let list = allReservations;

    if (hotelId !== "ALL") list = list.filter((r) => r.table.areaId === hotelId);
    if (roomId !== "ALL") list = list.filter((r) => r.table.id === roomId);

    if (!includeCancelled) {
      list = list.filter((r) => r.status !== ReservationStatus.Cancelled);
    }

    return list;
  }, [allReservations, hotelId, roomId, includeCancelled]);

  // --------- STAYS (grouped) ---------
  const staysAll = useMemo(() => {
    return groupReservationsIntoStays({
      reservations: base,
      todayKey,
      hotelNameById,
    });
  }, [base, todayKey, hotelNameById]);

  const staysFilteredBySearch = useMemo(() => {
    const qTrim = q.trim();
    if (!qTrim) return staysAll;
    return staysAll.filter((s) => stayMatchesSearch(s, qTrim));
  }, [staysAll, q]);

  const staysExisting = useMemo(() => {
    // in-house = covers today AND reserved=true (derived inside block)
    return staysFilteredBySearch.filter((s) => s.isOccupiedToday);
  }, [staysFilteredBySearch]);

  const staysPast = useMemo(() => {
    return staysFilteredBySearch.filter((s) => s.lastNightKey < todayKey);
  }, [staysFilteredBySearch, todayKey]);

  const staysFuture = useMemo(() => {
    // Future = NOT past and NOT in-house
    return staysFilteredBySearch.filter((s) => !s.isOccupiedToday && !(s.lastNightKey < todayKey));
  }, [staysFilteredBySearch, todayKey]);

  // --------- RESERVATIONS (ungrouped) ---------
  const reservationsFiltered = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    if (!qLower) return base;

    return base.filter((r) => {
      const roomNo = String(r.table.tableNumber);
      const dateKey = toLocalDateKey(r.reservationTime);
      const guestName = (r.user?.profile?.name ?? "").toLowerCase();
      const guestEmail = (r.userEmail ?? "").toLowerCase();
      const guestPhone = (r.user?.profile?.phone ?? "").toLowerCase();
      const status = String(r.status).toLowerCase();

      const hay = `${roomNo} ${dateKey} ${guestName} ${guestEmail} ${guestPhone} ${status}`.toLowerCase();
      return hay.includes(qLower);
    });
  }, [base, q]);

  const reservationsPast = useMemo(() => {
    return reservationsFiltered.filter((r) => toLocalDateKey(r.reservationTime) < todayKey);
  }, [reservationsFiltered, todayKey]);

  const reservationsFuture = useMemo(() => {
    return reservationsFiltered.filter((r) => toLocalDateKey(r.reservationTime) >= todayKey);
  }, [reservationsFiltered, todayKey]);

  const reservationsExisting = useMemo(() => {
    // Keep "in-house" strict: room reserved=true + confirmed + latest <= today per room
    const candidates = reservationsFiltered.filter((r) => {
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
  }, [reservationsFiltered, todayKey]);

  // --------- Counters & list selection ---------
  const counts = useMemo(() => {
    if (groupByStay) {
      return {
        all: staysFilteredBySearch.length,
        existing: staysExisting.length,
        future: staysFuture.length,
        past: staysPast.length,
      };
    }
    return {
      all: reservationsFiltered.length,
      existing: reservationsExisting.length,
      future: reservationsFuture.length,
      past: reservationsPast.length,
    };
  }, [
    groupByStay,
    staysFilteredBySearch.length,
    staysExisting.length,
    staysFuture.length,
    staysPast.length,
    reservationsFiltered.length,
    reservationsExisting.length,
    reservationsFuture.length,
    reservationsPast.length,
  ]);

  const listModeLabel = groupByStay ? "stays" : "reservations";

  const stayListForTab = useMemo(() => {
    if (tab === "EXISTING") return staysExisting;
    if (tab === "FUTURE") return staysFuture;
    if (tab === "PAST") return staysPast;
    return staysFilteredBySearch;
  }, [tab, staysExisting, staysFuture, staysPast, staysFilteredBySearch]);

  const reservationListForTab = useMemo(() => {
    if (tab === "EXISTING") return reservationsExisting;
    if (tab === "FUTURE") return reservationsFuture;
    if (tab === "PAST") return reservationsPast;
    return reservationsFiltered;
  }, [tab, reservationsExisting, reservationsFuture, reservationsPast, reservationsFiltered]);

  const toggleStayExpand = (stayId: string) => {
    setExpandedStayIds((prev) => ({ ...prev, [stayId]: !prev[stayId] }));
  };

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
              View bookings by Hotel (Area) → Room (Table). Toggle “Group by stay” to see multi-night blocks.
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
            onClick={() => setTab("EXISTING")}
            className={`text-xs px-3 py-2 rounded-lg border ${
              tab === "EXISTING" ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            Existing (In‑house) ({counts.existing})
          </button>

          <button
            type="button"
            onClick={() => setTab("FUTURE")}
            className={`text-xs px-3 py-2 rounded-lg border ${
              tab === "FUTURE" ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            Future ({counts.future})
          </button>

          <button
            type="button"
            onClick={() => setTab("PAST")}
            className={`text-xs px-3 py-2 rounded-lg border ${
              tab === "PAST" ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            Past ({counts.past})
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
                    const folioId = s.reservationIds[0]; // first night folio until a real stay-folio exists

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
                            {s.isOccupiedToday ? (
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
                              <Link
                                href={`/dashboard/folio/${folioId}`}
                                className="text-xs px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                                title="Folio is per-night in current schema. This opens the first night."
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

                        {/* Expanded nights */}
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
                                      {s.reservations.map((r) => (
                                        <tr key={r.id} className="border-t">
                                          <td className="py-2 pr-3">{toLocalDateKey(r.reservationTime)}</td>
                                          <td className="py-2 pr-3">{statusPill(r.status)}</td>
                                          <td className="py-2 pr-3">{r.numOfDiners}</td>
                                          <td className="py-2 pr-3">{formatLocalDateTime(r.reservationTime)}</td>
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
          // ------------------- NIGHTLY RESERVATION VIEW -------------------
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
