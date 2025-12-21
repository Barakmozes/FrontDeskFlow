"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";
import Link from "next/link";
import {
  // hotels
  GetAreasNameDescriptionDocument,
  GetAreasNameDescriptionQuery,
  GetAreasNameDescriptionQueryVariables,

  // reservations (generated after you add reservation.graphql + codegen)
  GetReservationsDocument,
  GetReservationsQuery,
  GetReservationsQueryVariables,

  EditReservationDocument,
  EditReservationMutation,
  EditReservationMutationVariables,

  CompleteReservationDocument,
  CompleteReservationMutation,
  CompleteReservationMutationVariables,

  // tables
  ToggleTableReservationDocument,
  ToggleTableReservationMutation,
  ToggleTableReservationMutationVariables,

  UpdateManyTablesDocument,
  UpdateManyTablesMutation,
  UpdateManyTablesMutationVariables,

  ReservationStatus,
} from "@/graphql/generated";

import { useOperationsUIStore } from "@/lib/operationsUIStore";

// housekeeping “hotel dressing”
import {
  applyHousekeepingPatch,
  deriveRoomStatus,
  parseHousekeepingTags,
} from "@/lib/housekeepingTags";

import { toLocalDateKey } from "./opsDate";
import TasksPanel from "../Tasks/TasksPanel";

type Res = GetReservationsQuery["getReservations"][number];

const isManagerish = (role?: string) => role === "ADMIN" || role === "MANAGER";

export default function OperationsBoard({
  currentUserEmail,
}: {
  currentUserEmail: string | null;
}) {
  const { hotelId, setHotelId, dateKey, setDateKey, tab, setTab, search, setSearch } =
    useOperationsUIStore();

  const [{ data: hotelsData, fetching: hotelsFetching, error: hotelsError }] =
    useQuery<GetAreasNameDescriptionQuery, GetAreasNameDescriptionQueryVariables>({
      query: GetAreasNameDescriptionDocument,
      variables: { orderBy: { createdAt: "asc" as any } },
    });

  const hotels = hotelsData?.getAreasNameDescription ?? [];

  // default hotel selection
  useEffect(() => {
    if (!hotelId && hotels.length > 0) setHotelId(hotels[0].id);
  }, [hotelId, hotels, setHotelId]);

  const [
    { data: resData, fetching: resFetching, error: resError },
    refetchReservations,
  ] = useQuery<GetReservationsQuery, GetReservationsQueryVariables>({
    query: GetReservationsDocument,
    variables: {}, // fetch all and filter in-memory for now
    requestPolicy: "cache-first",
  });

  const reservations = resData?.getReservations ?? [];

  // Mutations
  const [{ fetching: toggling }, toggleTableReservation] = useMutation<
    ToggleTableReservationMutation,
    ToggleTableReservationMutationVariables
  >(ToggleTableReservationDocument);

  const [{ fetching: editing }, editReservation] = useMutation<
    EditReservationMutation,
    EditReservationMutationVariables
  >(EditReservationDocument);

  const [{ fetching: completing }, completeReservation] = useMutation<
    CompleteReservationMutation,
    CompleteReservationMutationVariables
  >(CompleteReservationDocument);

  const [{ fetching: updatingTables }, updateManyTables] = useMutation<
    UpdateManyTablesMutation,
    UpdateManyTablesMutationVariables
  >(UpdateManyTablesDocument);

  const loading = hotelsFetching || resFetching;

  // quick maps
  const hotelNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of hotels) m.set(h.id, h.name);
    return m;
  }, [hotels]);

  const filteredByHotel = useMemo(() => {
    if (!hotelId) return [];
    return reservations.filter((r) => r.table.areaId === hotelId);
  }, [reservations, hotelId]);

  const normalizedSearch = search.trim().toLowerCase();

  const applySearch = (list: Res[]) => {
    if (!normalizedSearch) return list;

    return list.filter((r) => {
      const room = String(r.table.tableNumber);
      const guestName = (r.user?.profile?.name ?? "").toLowerCase();
      const guestEmail = (r.userEmail ?? "").toLowerCase();
      return (
        room.includes(normalizedSearch) ||
        guestName.includes(normalizedSearch) ||
        guestEmail.includes(normalizedSearch)
      );
    });
  };

  // ARRIVALS: reservationTime = selected date, status Pending/Confirmed
  const arrivals = useMemo(() => {
    const list = filteredByHotel.filter((r) => {
      const d = toLocalDateKey(r.reservationTime);
      if (d !== dateKey) return false;
      return r.status === ReservationStatus.Pending || r.status === ReservationStatus.Confirmed;
    });

    return applySearch(list).sort((a, b) => a.table.tableNumber - b.table.tableNumber);
  }, [filteredByHotel, dateKey, normalizedSearch]);

  // IN-HOUSE: status Confirmed + room currently occupied (table.reserved = true)
  const inHouse = useMemo(() => {
    const list = filteredByHotel.filter((r) => {
      return r.status === ReservationStatus.Confirmed && r.table.reserved === true;
    });

    return applySearch(list).sort((a, b) => a.table.tableNumber - b.table.tableNumber);
  }, [filteredByHotel, normalizedSearch]);

  // DEPARTURES: status Completed AND updatedAt = selected date (works because check-out updates updatedAt)
  const departures = useMemo(() => {
    const list = filteredByHotel.filter((r) => {
      if (r.status !== ReservationStatus.Completed) return false;
      const d = toLocalDateKey(r.createdBy);
      return d === dateKey;
    });

    return applySearch(list).sort((a, b) => a.table.tableNumber - b.table.tableNumber);
  }, [filteredByHotel, dateKey, normalizedSearch]);

  const listForTab = tab === "ARRIVALS" ? arrivals : tab === "IN_HOUSE" ? inHouse : departures;

  const statusPill = (r: Res) => {
    const { hk } = parseHousekeepingTags(r.table.specialRequests);
    const roomStatus = deriveRoomStatus(r.table.reserved, hk);

    // small, readable color mapping
    const cls =
      roomStatus === "OCCUPIED"
        ? "bg-red-100 text-red-800"
        : roomStatus === "VACANT_DIRTY"
        ? "bg-amber-100 text-amber-800"
        : roomStatus === "VACANT_CLEAN"
        ? "bg-emerald-100 text-emerald-800"
        : roomStatus === "MAINTENANCE"
        ? "bg-slate-200 text-slate-800"
        : "bg-gray-200 text-gray-700";

    return (
      <span className={`text-[10px] px-2 py-1 rounded-full ${cls}`}>
        {roomStatus.replaceAll("_", " ")}
      </span>
    );
  };

  /**
   * CHECK-IN logic (client “hotel dressing”):
   * - block if room isn't ready (dirty/maintenance/OOO)
   * - toggle table.reserved = true
   * - set reservation status CONFIRMED
   *
   * This is the shortest compliant flow for your module 3 requirement. :contentReference[oaicite:7]{index=7}
   */
  const handleCheckIn = async (r: Res) => {
    const { hk } = parseHousekeepingTags(r.table.specialRequests);
    const roomStatus = deriveRoomStatus(r.table.reserved, hk);

    if (r.table.reserved) {
      toast.error("Room is already occupied.");
      return;
    }
    if (roomStatus !== "VACANT_CLEAN") {
      toast.error(`Room not ready for check-in (${roomStatus.replaceAll("_", " ")}).`);
      return;
    }

    const t = await toggleTableReservation({
      toggleTableReservationId: r.table.id,
      reserved: true,
    });

    if (t.error) {
      console.error(t.error);
      toast.error("Failed to set room as occupied.");
      return;
    }

    const e = await editReservation({
      editReservationId: r.id,
      status: ReservationStatus.Confirmed,
    });

    if (e.error) {
      console.error(e.error);
      toast.error("Room occupied, but failed to update reservation status.");
      return;
    }

    toast.success(`Checked-in: Room ${r.table.tableNumber}`);
    refetchReservations({ requestPolicy: "network-only" });
  };

  /**
   * CHECK-OUT logic:
   * - complete reservation
   * - set room vacant (reserved=false)
   * - mark room DIRTY + add to cleaning list (HK tags)
   *
   * This implements the “room becomes dirty after checkout” requirement. :contentReference[oaicite:8]{index=8}
   */
  const handleCheckOut = async (r: Res) => {
    const c = await completeReservation({ completeReservationId: r.id });
    if (c.error) {
      console.error(c.error);
      toast.error("Failed to complete reservation.");
      return;
    }

    const t = await toggleTableReservation({
      toggleTableReservationId: r.table.id,
      reserved: false,
    });
    if (t.error) {
      console.error(t.error);
      toast.error("Reservation completed, but failed to release room.");
      return;
    }

    const nextSpecialRequests = applyHousekeepingPatch(r.table.specialRequests, {
      status: "DIRTY",
      inCleaningList: true,
    });

    const u = await updateManyTables({
      updates: [{ id: r.table.id, specialRequests: nextSpecialRequests }],
    });

    if (u.error) {
      console.error(u.error);
      toast.error("Checked-out, but failed to mark room dirty.");
      return;
    }

    toast.success(`Checked-out: Room ${r.table.tableNumber} marked DIRTY`);
    refetchReservations({ requestPolicy: "network-only" });
  };

  return (
    <div className="px-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Front Desk Operations</h1>
            <p className="text-xs text-gray-500">
              Daily arrivals / departures / in-house guests + quick check-in/out.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={hotelId ?? ""}
              onChange={(e) => setHotelId(e.target.value || null)}
              className="text-sm border rounded-lg px-3 py-2 bg-white"
            >
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              className="text-sm border rounded-lg px-3 py-2 bg-white"
              title="Operational day"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search room / guest / email"
              className="text-sm border rounded-lg px-3 py-2 bg-white"
            />

            <button
              onClick={() => refetchReservations({ requestPolicy: "network-only" })}
              className="text-sm bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-950"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setTab("ARRIVALS")}
            className={`text-xs px-3 py-2 rounded-lg border ${
              tab === "ARRIVALS" ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            Arrivals ({arrivals.length})
          </button>

          <button
            onClick={() => setTab("IN_HOUSE")}
            className={`text-xs px-3 py-2 rounded-lg border ${
              tab === "IN_HOUSE" ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            In-house ({inHouse.length})
          </button>

          <button
            onClick={() => setTab("DEPARTURES")}
            className={`text-xs px-3 py-2 rounded-lg border ${
              tab === "DEPARTURES" ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            Departures ({departures.length})
          </button>
        </div>
      </div>

      {loading ? <p className="text-sm text-gray-500 mb-2">Loading…</p> : null}
      {hotelsError || resError ? (
        <p className="text-sm text-red-600 mb-2">
          Failed to load: {(hotelsError || resError)?.message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT: Daily lists */}
        <div className="lg:col-span-2 space-y-3">
          {hotelId ? (
            <div className="text-xs text-gray-500 px-1">
              Hotel: <span className="text-gray-800 font-medium">{hotelNameById.get(hotelId) ?? "-"}</span>
            </div>
          ) : null}

          {listForTab.length === 0 ? (
            <div className="bg-white rounded-lg p-6 text-sm text-gray-600">
              No items for this view.
            </div>
          ) : (
            <div className="space-y-2">
              {listForTab.map((r) => {
                const guestName = r.user?.profile?.name || r.userEmail;
                const time = new Date(r.reservationTime).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={r.id}
                    className="bg-white rounded-lg border shadow-sm p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          Room {r.table.tableNumber}
                        </p>
                        {statusPill(r)}
                        <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          {r.status}
                        </span>
                      </div>

                      <p className="text-xs text-gray-700 mt-1 truncate">
                        Guest: <span className="font-medium">{guestName}</span>
                        {r.user?.profile?.phone ? (
                          <span className="text-gray-500"> • {r.user.profile.phone}</span>
                        ) : null}
                      </p>

                      <p className="text-xs text-gray-500">
                        {tab === "DEPARTURES" ? (
                          <>Checked-out at: {new Date(r.createdBy).toLocaleString()}</>
                        ) : (
                          <>Arrival time: {time} • Guests: {r.numOfDiners}</>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link
                         href={`/dashboard/folio/${r.id}`}
                                className="text-xs px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                        >
                                         Folio
                      </Link>
                      {tab === "ARRIVALS" ? (
                        
                        <button
                          onClick={() => handleCheckIn(r)}
                          disabled={toggling || editing}
                          className="text-xs px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                        >
                          Check-in
                        </button>
                      ) : null}

                      {tab === "IN_HOUSE" ? (
                        <button
                          onClick={() => handleCheckOut(r)}
                          disabled={completing || toggling || updatingTables}
                          className="text-xs px-3 py-2 rounded-lg bg-blue-800 text-white hover:bg-blue-900 disabled:bg-gray-300"
                        >
                          Check-out
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Tasks */}
        <div className="lg:col-span-1">
          <TasksPanel currentUserEmail={currentUserEmail} />
        </div>
      </div>
    </div>
  );
}
