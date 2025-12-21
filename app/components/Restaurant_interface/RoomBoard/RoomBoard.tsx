"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useQuery } from "@urql/next";

import {
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

  ReservationStatus,
  Role,
} from "@/graphql/generated";

import { buildDateRange, addDaysToDateKey, toLocalDateKey } from "@/lib/datekeyy";
import { parseHousekeepingTags } from "@/lib/housekeepingTags";
import { useRoomBoardStore } from "@/lib/roomBoardStore";
import { Pill, hkTone, reservationTone } from "./edgeUI";
import { CreateReservationModal, StayDetailsModal } from "./ReservationModals";
import type { StayBlock } from "./types";

/**
 * RoomBoard v0:
 * - Shows a hotel-style calendar grid
 * - Multi-night stays are represented by multiple Reservation records (one per date)
 * - We group consecutive nights (same room + same userEmail) into blocks
 *
 * This matches your "check reservation by date" backend behavior and enables
 * "blocks by range" without Prisma migrations. :contentReference[oaicite:7]{index=7}
 */

function deriveFloor(roomNumber: number): number {
  // Common convention: 204 => floor 2, 1203 => floor 12
  if (roomNumber >= 100) return Math.floor(roomNumber / 100);
  return 0;
}

function formatHeader(dk: string) {
  // dk = YYYY-MM-DD
  const d = new Date(`${dk}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function RoomBoard({ staffEmail }: { staffEmail: string | null }) {
  const ui = useRoomBoardStore();

  const [{ data: meData }] = useQuery<GetUserQuery, GetUserQueryVariables>({
    query: GetUserDocument,
    variables: staffEmail ? { email: staffEmail } : ({} as any),
    pause: !staffEmail,
  });

  const staffRole = meData?.getUser?.role ?? null;

  // Hotels + rooms
  const [{ data: hotelsData }] = useQuery<GetAreasNameDescriptionQuery, GetAreasNameDescriptionQueryVariables>({
    query: GetAreasNameDescriptionDocument,
    variables: { orderBy: { createdAt: "asc" as any } },
  });

  const hotels = hotelsData?.getAreasNameDescription ?? [];

  const [{ data: roomsData }] = useQuery<GetTablesQuery, GetTablesQueryVariables>({
    query: GetTablesDocument,
    variables: {},
  });

  const rooms = roomsData?.getTables ?? [];

  // Reservations (all, then filter in client)
  const [{ data: resData, fetching: resFetching, error: resError }, refetchReservations] = useQuery<
    GetReservationsQuery,
    GetReservationsQueryVariables
  >({
    query: GetReservationsDocument,
    variables: {}, // optionally { status: ReservationStatus.Confirmed } etc
  });

  const allReservations = resData?.getReservations ?? [];

  const dateKeys = useMemo(() => buildDateRange(ui.startDateKey, ui.days), [ui.startDateKey, ui.days]);
  const dateKeySet = useMemo(() => new Set(dateKeys), [dateKeys]);

  // Filter rooms (hotel/occupancy/hk/floor/capacity)
  const filteredRooms = useMemo(() => {
    return rooms
      .filter((r) => (ui.hotelId === "ALL" ? true : r.areaId === ui.hotelId))
      .filter((r) => {
        if (ui.occupancy === "AVAILABLE") return !r.reserved;
        if (ui.occupancy === "OCCUPIED") return r.reserved;
        return true;
      })
      .filter((r) => {
        const {hk} = parseHousekeepingTags(r.specialRequests);
        if (ui.hkStatus === "ALL") return true;
        return hk.status === ui.hkStatus;
      })
      .filter((r) => (ui.floor === "ALL" ? true : deriveFloor(r.tableNumber) === ui.floor))
      .filter((r) => (ui.capacity === "ALL" ? true : r.diners === ui.capacity))
      .sort((a, b) => a.tableNumber - b.tableNumber);
  }, [rooms, ui.hotelId, ui.occupancy, ui.hkStatus, ui.floor, ui.capacity]);

  // Index reservations by (roomId + dateKey)
  const resByRoomDate = useMemo(() => {
    const map = new Map<string, Map<string, (typeof allReservations)[number]>>();
    for (const r of allReservations) {
      if (r.status === ReservationStatus.Cancelled) continue;

      const dk = toLocalDateKey(r.reservationTime);
      if (!dateKeySet.has(dk)) continue;

      const m = map.get(r.tableId) ?? new Map<string, (typeof allReservations)[number]>();
      // If multiple exist (shouldn't), prefer CONFIRMED
      const existing = m.get(dk);
      if (!existing || (existing.status === ReservationStatus.Pending && r.status === ReservationStatus.Confirmed)) {
        m.set(dk, r);
      }
      map.set(r.tableId, m);
    }
    return map;
  }, [allReservations, dateKeySet]);

  // Board modal state (local)
  const [createOpen, setCreateOpen] = useState(false);
  const [createRoomId, setCreateRoomId] = useState<string>("");
  const [createRoomNumber, setCreateRoomNumber] = useState<number>(0);
  const [createHotelName, setCreateHotelName] = useState<string>("");
  const [createStartDateKey, setCreateStartDateKey] = useState<string>("");

  const [stayOpen, setStayOpen] = useState(false);
  const [selectedStay, setSelectedStay] = useState<StayBlock | null>(null);

  const hotelNameById = useMemo(() => {
    const m = new Map<string, string>();
    hotels.forEach((h) => m.set(h.id, h.name));
    return m;
  }, [hotels]);

  function openCreate(room: (typeof rooms)[number], dateKey: string) {
    if (!staffEmail || !staffRole) {
      toast.error("Login required.");
      return;
    }

    setCreateRoomId(room.id);
    setCreateRoomNumber(room.tableNumber);
    setCreateHotelName(hotelNameById.get(room.areaId) ?? "Hotel");
    setCreateStartDateKey(dateKey);
    setCreateOpen(true);
  }

  function openStayFromSegment(stay: StayBlock) {
    setSelectedStay(stay);
    setStayOpen(true);
  }

  const uniqueFloors = useMemo(() => {
    const set = new Set<number>();
    rooms.forEach((r) => set.add(deriveFloor(r.tableNumber)));
    return Array.from(set).sort((a, b) => a - b);
  }, [rooms]);

  const uniqueCapacities = useMemo(() => {
    const set = new Set<number>();
    rooms.forEach((r) => set.add(r.diners));
    return Array.from(set).sort((a, b) => a - b);
  }, [rooms]);

  return (
    <div className="px-6 py-6 bg-gray-50 min-h-screen">
      {/* Header / filters */}
      <div className="mb-4 rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Room Board</h1>
            <p className="text-sm text-gray-600">
              Rooms × dates grid with reservation blocks + collision prevention. 
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div>
              <div className="text-xs text-gray-600">Start</div>
              <input
                type="date"
                className="rounded-md border px-3 py-2 text-sm bg-white"
                value={ui.startDateKey}
                onChange={(e) => ui.setStartDateKey(e.target.value)}
              />
            </div>

            <div>
              <div className="text-xs text-gray-600">Days</div>
              <input
                type="number"
                className="rounded-md border px-3 py-2 text-sm bg-white w-24"
                min={7}
                max={31}
                value={ui.days}
                onChange={(e) => ui.setDays(Number(e.target.value))}
              />
            </div>

            <div className="flex gap-2 items-end">
              <button
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => ui.setStartDateKey(addDaysToDateKey(ui.startDateKey, -ui.days))}
              >
                ← Prev
              </button>
              <button
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => ui.setStartDateKey(addDaysToDateKey(ui.startDateKey, ui.days))}
              >
                Next →
              </button>
            </div>

            <div>
              <div className="text-xs text-gray-600">Hotel</div>
              <select
                className="rounded-md border px-3 py-2 text-sm bg-white"
                value={ui.hotelId}
                onChange={(e) => ui.setHotelId(e.target.value as any)}
              >
                <option value="ALL">All</option>
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-600">Occupancy</div>
              <select
                className="rounded-md border px-3 py-2 text-sm bg-white"
                value={ui.occupancy}
                onChange={(e) => ui.setOccupancy(e.target.value as any)}
              >
                <option value="ALL">All</option>
                <option value="AVAILABLE">Available</option>
                <option value="OCCUPIED">Occupied</option>
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-600">Housekeeping</div>
              <select
                className="rounded-md border px-3 py-2 text-sm bg-white"
                value={ui.hkStatus}
                onChange={(e) => ui.setHkStatus(e.target.value as any)}
              >
                <option value="ALL">All</option>
                <option value="CLEAN">CLEAN</option>
                <option value="DIRTY">DIRTY</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="OUT_OF_ORDER">OUT OF ORDER</option>
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-600">Floor</div>
              <select
                className="rounded-md border px-3 py-2 text-sm bg-white"
                value={ui.floor}
                onChange={(e) => ui.setFloor(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
              >
                <option value="ALL">All</option>
                {uniqueFloors.map((f) => (
                  <option key={f} value={f}>{f === 0 ? "—" : `Floor ${f}`}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-600">Capacity</div>
              <select
                className="rounded-md border px-3 py-2 text-sm bg-white"
                value={ui.capacity}
                onChange={(e) => ui.setCapacity(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
              >
                <option value="ALL">All</option>
                {uniqueCapacities.map((c) => (
                  <option key={c} value={c}>{c} guests</option>
                ))}
              </select>
            </div>

            <button
              className="rounded-md bg-black px-3 py-2 text-sm text-white hover:opacity-90"
              onClick={() => refetchReservations({ requestPolicy: "network-only" })}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs items-center">
          <span className="text-gray-600 font-semibold">Legend:</span>
          <Pill label="PENDING" tone={reservationTone(ReservationStatus.Pending)} />
          <Pill label="CONFIRMED" tone={reservationTone(ReservationStatus.Confirmed)} />
          <Pill label="COMPLETED" tone={reservationTone(ReservationStatus.Completed)} />
          <span className="mx-2 w-px h-4 bg-gray-200" />
          <Pill label="CLEAN" tone={hkTone("CLEAN")} />
          <Pill label="DIRTY" tone={hkTone("DIRTY")} />
          <Pill label="MAINTENANCE" tone={hkTone("MAINTENANCE")} />
          <Pill label="OUT OF ORDER" tone={hkTone("OUT_OF_ORDER")} />
        </div>
      </div>

      {resFetching ? <div className="text-sm text-gray-500 mb-2">Loading reservations…</div> : null}
      {resError ? <div className="text-sm text-red-600 mb-2">Error: {resError.message}</div> : null}

      {/* Grid */}
      <div className="rounded-xl border bg-white overflow-auto">
        <table className="min-w-[1100px] w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="text-left px-3 py-2 border-b sticky left-0 bg-gray-50 z-20 w-[240px]">
                Room
              </th>
              {dateKeys.map((dk) => (
                <th key={dk} className="px-2 py-2 border-b text-center whitespace-nowrap">
                  {formatHeader(dk)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filteredRooms.length === 0 ? (
              <tr>
                <td colSpan={1 + dateKeys.length} className="px-3 py-6 text-center text-gray-500">
                  No rooms match filters.
                </td>
              </tr>
            ) : (
              filteredRooms.map((room) => {
                const {hk} = parseHousekeepingTags(room.specialRequests);
                const roomResMap = resByRoomDate.get(room.id) ?? new Map();

                // Build cells with colSpan for “stay blocks”
                const cells: React.ReactNode[] = [];
                let i = 0;

                while (i < dateKeys.length) {
                  const dk = dateKeys[i];
                  const r = roomResMap.get(dk);

                  if (!r) {
                    // empty cell
                    cells.push(
                      <td
                        key={`empty:${room.id}:${dk}`}
                        className="border-b border-l px-2 py-2 text-center hover:bg-gray-50 cursor-pointer"
                        onClick={() => openCreate(room, dk)}
                        title="Click to create reservation"
                      >
                        <span className="text-gray-300">+</span>
                      </td>
                    );
                    i += 1;
                    continue;
                  }

                  // Build a stay segment: consecutive days, same userEmail, same status
                  const first = r;
                  const userEmail = first.userEmail;
                  const status = first.status;
                  const reservationIds: string[] = [first.id];

                  let j = i + 1;
                  while (j < dateKeys.length) {
                    const rj = roomResMap.get(dateKeys[j]);
                    if (!rj) break;
                    if (rj.userEmail !== userEmail) break;
                    if (rj.status !== status) break;
                    reservationIds.push(rj.id);
                    j++;
                  }

                  const nights = j - i;
                  const startDateKey = dateKeys[i];
                  const endDateKey = j < dateKeys.length ? dateKeys[j] : addDaysToDateKey(dateKeys[dateKeys.length - 1], 1);

                  const guestName =
                    first.user?.profile?.name?.trim() || first.userEmail;

                  const stay: StayBlock = {
                    stayId: `${room.id}|${userEmail}|${startDateKey}`,
                    roomId: room.id,
                    roomNumber: room.tableNumber,
                    hotelId: room.areaId,
                    startDateKey,
                    endDateKey,
                    nights,
                    userEmail,
                    guestName,
                    guestPhone: first.user?.profile?.phone ?? null,
                    status,
                    reservationIds,
                  };

                  cells.push(
                    <td
                      key={`stay:${stay.stayId}`}
                      colSpan={nights}
                      className="border-b border-l px-2 py-1 cursor-pointer"
                      onClick={() => openStayFromSegment(stay)}
                      title="Click to open stay"
                    >
                      <div
                        className={`rounded-md px-2 py-2 text-white ${
                          status === ReservationStatus.Pending
                            ? "bg-amber-500"
                            : status === ReservationStatus.Confirmed
                            ? "bg-blue-600"
                            : status === ReservationStatus.Completed
                            ? "bg-emerald-600"
                            : "bg-gray-400"
                        }`}
                      >
                        <div className="font-semibold truncate">{guestName}</div>
                        <div className="text-[11px] opacity-90 flex gap-2">
                          <span>{nights} night(s)</span>
                          <span>•</span>
                          <span>{status}</span>
                        </div>
                      </div>
                    </td>
                  );

                  i = j;
                }

                return (
                  <tr key={room.id} className="hover:bg-gray-50/40">
                    <td className="border-b px-3 py-2 sticky left-0 bg-white z-10">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">Room {room.tableNumber}</span>
                          <Pill label={hk.status} tone={hkTone(hk.status)} />
                          {room.reserved ? <Pill label="OCCUPIED" tone="gray" /> : <Pill label="AVAILABLE" tone="green" />}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Capacity: {room.diners} • Floor: {deriveFloor(room.tableNumber) || "—"}
                        </div>
                      </div>
                    </td>
                    {cells}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <CreateReservationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => refetchReservations({ requestPolicy: "network-only" })}
        roomId={createRoomId}
        roomNumber={createRoomNumber}
        hotelName={createHotelName}
        startDateKey={createStartDateKey}
        hasCollision={(dk) => {
          const m = resByRoomDate.get(createRoomId);
          if (!m) return false;
          const r = m.get(dk);
          return !!r && r.status !== ReservationStatus.Cancelled;
        }}
        staffEmail={staffEmail}
        staffRole={staffRole}
      />

      {/* Stay modal */}
      <StayDetailsModal
        open={stayOpen}
        onClose={() => setStayOpen(false)}
        stay={selectedStay}
        onChanged={() => refetchReservations({ requestPolicy: "network-only" })}
      />
    </div>
  );
}
