"use client";

import React, { useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";
import { useClient } from "urql";
import Link from "next/link";

import {
  GetAreasDocument,
  type GetAreasQuery,
  type GetAreasQueryVariables,

  GetReservationsDocument,
  type GetReservationsQuery,
  type GetReservationsQueryVariables,

  EditReservationDocument,
  type EditReservationMutation,
  type EditReservationMutationVariables,

  CompleteReservationDocument,
  type CompleteReservationMutation,
  type CompleteReservationMutationVariables,

  ToggleTableReservationDocument,
  type ToggleTableReservationMutation,
  type ToggleTableReservationMutationVariables,

  UpdateManyTablesDocument,
  type UpdateManyTablesMutation,
  type UpdateManyTablesMutationVariables,

  ReservationStatus,
} from "@/graphql/generated";

import { useOperationsUIStore } from "@/lib/operationsUIStore";

import {
  applyHousekeepingPatch,
  deriveRoomStatus,
  parseHousekeepingTags,
} from "@/lib/housekeepingTags";

import TasksPanel from "../Tasks/TasksPanel";

// ✅ SINGLE shared utility — matches Reception exactly
import {
  groupReservationsIntoStays,
  coversDateKey,
  folioReservationIdForDateKey,
  todayLocalDateKey,
  sumStayGuests,
  type StayBlock,
} from "@/lib/stayGrouping";

// ✅ Step 5: auto-post nightly room charges into folio after check-in
import { ensureNightlyRoomCharges } from "@/lib/folioRoomCharges";
import { parseHotelSettings } from "@/lib/hotelSettingsTags";
import { parseRoomRateTags, getEffectiveNightlyRate } from "@/lib/roomRateTags";

export default function OperationsBoard({
  currentUserEmail,
}: {
  currentUserEmail: string | null;
}) {
  const client = useClient();

  const {
    hotelId,
    setHotelId,
    dateKey,
    setDateKey,
    tab,
    setTab,
    search,
    setSearch,
  } = useOperationsUIStore();

  const todayKey = useMemo(() => todayLocalDateKey(), []);

  useEffect(() => {
    if (!dateKey) setDateKey(todayKey);
  }, [dateKey, setDateKey, todayKey]);

  const selectedDateKey = dateKey || todayKey;

  const [{ data: hotelsData, fetching: hotelsFetching, error: hotelsError }] =
    useQuery<GetAreasQuery, GetAreasQueryVariables>({
      query: GetAreasDocument,
      variables: {},
      requestPolicy: "cache-and-network",
    });

  const hotels = useMemo(() => {
    const list = hotelsData?.getAreas ?? [];
    return [...list].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }, [hotelsData?.getAreas]);

  useEffect(() => {
    if (!hotelId && hotels.length > 0) setHotelId(hotels[0].id);
  }, [hotelId, hotels, setHotelId]);

  const selectedHotel = useMemo(() => {
    return hotels.find((h) => h.id === hotelId) ?? null;
  }, [hotels, hotelId]);

  const [{ data: resData, fetching: resFetching, error: resError }, refetchReservations] =
    useQuery<GetReservationsQuery, GetReservationsQueryVariables>({
      query: GetReservationsDocument,
      variables: {},
      requestPolicy: "cache-and-network",
    });

  const reservations = resData?.getReservations ?? [];

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

  const hotelNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of hotels) m.set(h.id, h.name);
    return m;
  }, [hotels]);

  const filteredByHotel = useMemo(() => {
    if (!hotelId) return [];
    return reservations.filter((r) => r.table.areaId === hotelId);
  }, [reservations, hotelId]);

  const staysForHotel = useMemo(() => {
    return groupReservationsIntoStays(filteredByHotel);
  }, [filteredByHotel]);

  const normalizedSearch = search.trim().toLowerCase();

  const staysAfterSearch = useMemo(() => {
    if (!normalizedSearch) return staysForHotel;
    return staysForHotel.filter((s) => {
      const room = String(s.roomNumber);
      const guestName = (s.guestName ?? "").toLowerCase();
      const guestEmail = (s.userEmail ?? "").toLowerCase();
      return room.includes(normalizedSearch) || guestName.includes(normalizedSearch) || guestEmail.includes(normalizedSearch);
    });
  }, [staysForHotel, normalizedSearch]);

  const arrivals = useMemo(() => {
    const list = staysAfterSearch.filter((s) => {
      if (s.startDateKey !== selectedDateKey) return false;
      if (s.status === ReservationStatus.Cancelled) return false;
      if (selectedDateKey === todayKey && s.tableReservedNow) return false;

      return s.status === ReservationStatus.Pending || s.status === ReservationStatus.Confirmed;
    });
    return list.sort((a, b) => a.roomNumber - b.roomNumber);
  }, [staysAfterSearch, selectedDateKey, todayKey]);

  const inHouse = useMemo(() => {
    const list = staysAfterSearch.filter((s) => {
      if (s.status === ReservationStatus.Cancelled) return false;
      if (!coversDateKey(s, selectedDateKey)) return false;

      if (selectedDateKey === todayKey) return s.tableReservedNow;
      return true;
    });
    return list.sort((a, b) => a.roomNumber - b.roomNumber);
  }, [staysAfterSearch, selectedDateKey, todayKey]);

  const departures = useMemo(() => {
    const list = staysAfterSearch.filter((s) => {
      if (s.status === ReservationStatus.Cancelled) return false;
      return s.endDateKey === selectedDateKey;
    });
    return list.sort((a, b) => a.roomNumber - b.roomNumber);
  }, [staysAfterSearch, selectedDateKey]);

  const listForTab = tab === "ARRIVALS" ? arrivals : tab === "IN_HOUSE" ? inHouse : departures;

  const tabTotals = useMemo(() => {
    return {
      arrivalsGuests: sumStayGuests(arrivals),
      inHouseGuests: sumStayGuests(inHouse),
      departuresGuests: sumStayGuests(departures),
    };
  }, [arrivals, inHouse, departures]);

  const roomStatusPill = (s: StayBlock) => {
    const { hk } = parseHousekeepingTags(s.specialRequests);
    const roomStatus = deriveRoomStatus(s.tableReservedNow, hk);

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

    return <span className={`text-[10px] px-2 py-1 rounded-full ${cls}`}>{roomStatus.replaceAll("_", " ")}</span>;
  };

  const canOperateToday = selectedDateKey === todayKey;

  const handleCheckInStay = async (s: StayBlock) => {
    if (!canOperateToday) return toast.error("Check-in is only allowed for today.");
    if (s.startDateKey !== todayKey) return toast.error("This stay is not an arrival for today.");

    const { hk } = parseHousekeepingTags(s.specialRequests);
    const roomStatus = deriveRoomStatus(s.tableReservedNow, hk);

    if (s.tableReservedNow) return toast.error("Room is already occupied.");
    if (roomStatus !== "VACANT_CLEAN") return toast.error(`Room not ready for check-in (${roomStatus.replaceAll("_", " ")}).`);

    const t = await toggleTableReservation({
      toggleTableReservationId: s.roomId,
      reserved: true,
    });

    if (t.error) {
      console.error(t.error);
      toast.error("Failed to set room as occupied.");
      return;
    }

    const idsToConfirm = s.reservations
      .filter((r) => r.status !== ReservationStatus.Cancelled && r.status !== ReservationStatus.Completed)
      .map((r) => r.id);

    for (const id of idsToConfirm) {
      const e = await editReservation({ editReservationId: id, status: ReservationStatus.Confirmed });
      if (e.error) {
        console.error(e.error);
        toast.error("Room occupied, but failed to confirm all stay nights.");
        break;
      }
    }

    // ✅ Post nightly room charges into Folio (from Settings)
    if (selectedHotel) {
      const hotelSettings = parseHotelSettings(selectedHotel.description).settings;

      const roomRate = parseRoomRateTags(s.specialRequests).rate;
      const nightlyRate = getEffectiveNightlyRate(hotelSettings.baseNightlyRate, roomRate.overrideNightlyRate);

      if (hotelSettings.autoPostRoomCharges) {
        try {
          const result = await ensureNightlyRoomCharges({
            client,
            tableId: s.roomId,
            hotelId: s.hotelId,
            roomNumber: s.roomNumber,
            guestEmail: s.userEmail,
            guestName: s.guestName,
            nightlyRate,
            currency: hotelSettings.currency,
            nights: s.nightsList,
          });

          if (result.created > 0) {
            toast.success(`Room charges posted: ${result.created} night${result.created === 1 ? "" : "s"}`);
          }
        } catch (err) {
          console.error(err);
          toast.error("Checked in, but room charges failed to post. Open folio and try again.");
        }
      }
    }

    toast.success(`Checked-in: Room ${s.roomNumber}`);
    refetchReservations({ requestPolicy: "network-only" });
  };

  const handleCheckOutStay = async (s: StayBlock) => {
    if (!canOperateToday) return toast.error("Check-out is only allowed for today.");
    if (!s.tableReservedNow) return toast.error("Room is already vacant.");

    const idsToComplete = s.reservations
      .filter((r) => r.status !== ReservationStatus.Cancelled && r.status !== ReservationStatus.Completed)
      .map((r) => r.id);

    for (const id of idsToComplete) {
      const c = await completeReservation({ completeReservationId: id });
      if (c.error) {
        console.error(c.error);
        toast.error("Failed to complete all reservation nights.");
        return;
      }
    }

    const t = await toggleTableReservation({ toggleTableReservationId: s.roomId, reserved: false });
    if (t.error) {
      console.error(t.error);
      toast.error("Stay completed, but failed to release room.");
      return;
    }

    const nextSpecialRequests = applyHousekeepingPatch(s.specialRequests, {
      status: "DIRTY",
      inCleaningList: true,
    });

    const u = await updateManyTables({
      updates: [{ id: s.roomId, specialRequests: nextSpecialRequests }],
    });

    if (u.error) {
      console.error(u.error);
      toast.error("Checked-out, but failed to mark room DIRTY.");
      return;
    }

    toast.success(`Checked-out: Room ${s.roomNumber} marked DIRTY`);
    refetchReservations({ requestPolicy: "network-only" });
  };

  return (
    <div className="px-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Front Desk Operations</h1>
            <p className="text-xs text-gray-500">Daily arrivals / departures / in-house guests + quick check-in/out.</p>
            {selectedDateKey !== todayKey ? (
              <p className="text-[11px] mt-1 text-amber-700">
                Planning mode: selected date is not today. Actions are disabled.
              </p>
            ) : null}
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
              value={selectedDateKey}
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
            Arrivals ({arrivals.length}) • Guests {tabTotals.arrivalsGuests}
          </button>

          <button
            onClick={() => setTab("IN_HOUSE")}
            className={`text-xs px-3 py-2 rounded-lg border ${
              tab === "IN_HOUSE" ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            In-house ({inHouse.length}) • Guests {tabTotals.inHouseGuests}
          </button>

          <button
            onClick={() => setTab("DEPARTURES")}
            className={`text-xs px-3 py-2 rounded-lg border ${
              tab === "DEPARTURES" ? "bg-gray-900 text-white" : "bg-white"
            }`}
          >
            Departures ({departures.length}) • Guests {tabTotals.departuresGuests}
          </button>
        </div>
      </div>

      {loading ? <p className="text-sm text-gray-500 mb-2">Loading…</p> : null}
      {hotelsError || resError ? (
        <p className="text-sm text-red-600 mb-2">Failed to load: {(hotelsError || resError)?.message}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {hotelId ? (
            <div className="text-xs text-gray-500 px-1">
              Hotel: <span className="text-gray-800 font-medium">{hotelNameById.get(hotelId) ?? "-"}</span>
            </div>
          ) : null}

          {listForTab.length === 0 ? (
            <div className="bg-white rounded-lg p-6 text-sm text-gray-600">No items for this view.</div>
          ) : (
            <div className="space-y-2">
              {listForTab.map((s) => {
                const folioId = folioReservationIdForDateKey(s, selectedDateKey);

                return (
                  <div
                    key={s.stayId}
                    className="bg-white rounded-lg border shadow-sm p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">Room {s.roomNumber}</p>
                        {roomStatusPill(s)}

                        <span
                          className={`text-[10px] px-2 py-1 rounded-full ${
                            s.status === ReservationStatus.Pending
                              ? "bg-amber-100 text-amber-800"
                              : s.status === ReservationStatus.Confirmed
                              ? "bg-emerald-100 text-emerald-800"
                              : s.status === ReservationStatus.Completed
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {String(s.status).toUpperCase()}
                        </span>

                        <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          {s.startDateKey} → {s.endDateKey} ({s.nights} night{s.nights === 1 ? "" : "s"})
                        </span>
                      </div>

                      <p className="text-xs text-gray-700 mt-1 truncate">
                        Guest: <span className="font-medium">{s.guestName}</span>
                        {s.guestPhone ? <span className="text-gray-500"> • {s.guestPhone}</span> : null}
                        <span className="text-gray-500"> • {s.userEmail}</span>
                      </p>

                      <p className="text-xs text-gray-500">
                        Guests: <span className="font-medium text-gray-800">{s.guests}</span>
                        {tab === "DEPARTURES" ? (
                          <>
                            {" "}
                            • Checkout day: <span className="font-medium text-gray-800">{s.endDateKey}</span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {folioId ? (
                        <Link
                          href={`/dashboard/folio/${folioId}`}
                          className="text-xs px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                        >
                          Folio
                        </Link>
                      ) : null}

                      {tab === "ARRIVALS" ? (
                        <button
                          onClick={() => handleCheckInStay(s)}
                          disabled={!canOperateToday || toggling || editing}
                          className="text-xs px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
                        >
                          Check-in
                        </button>
                      ) : null}

                      {tab !== "ARRIVALS" ? (
                        <button
                          onClick={() => handleCheckOutStay(s)}
                          disabled={!canOperateToday || completing || toggling || updatingTables}
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

        <div className="lg:col-span-1">
          <TasksPanel currentUserEmail={currentUserEmail} />
        </div>
      </div>
    </div>
  );
}
