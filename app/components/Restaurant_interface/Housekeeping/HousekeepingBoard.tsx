"use client";

import React, { useEffect, useMemo } from "react";
import { useQuery } from "@urql/next";

import {
  GetAreasNameDescriptionDocument,
  GetAreasNameDescriptionQuery,
  GetAreasNameDescriptionQueryVariables,
  GetTablesDocument,
  GetTablesQuery,
  GetTablesQueryVariables,
} from "@/graphql/generated";

import { useHotelStore, type RoomInStore } from "@/lib/AreaStore";
import { useHousekeepingUIStore } from "@/lib/housekeepingUIStore";
import { deriveRoomStatus, parseHousekeepingTags } from "@/lib/housekeepingTags";

import HousekeepingRoomCard from "./HousekeepingRoomCard";

const asIsoString = (value: unknown): string => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

export default function HousekeepingBoard() {
  const hotels = useHotelStore((s) => s.hotels);
  const setHotels = useHotelStore((s) => s.setHotels);
  const rooms = useHotelStore((s) => s.rooms);
  const setRooms = useHotelStore((s) => s.setRooms);

  const {
    selectedHotelId,
    setSelectedHotelId,
    filter,
    setFilter,
    occupancy,
    setOccupancy,
    search,
    setSearch,
  } = useHousekeepingUIStore();

  const [{ data: hotelsData, fetching: hotelsFetching, error: hotelsError }] =
    useQuery<GetAreasNameDescriptionQuery, GetAreasNameDescriptionQueryVariables>({
      query: GetAreasNameDescriptionDocument,
      variables: { orderBy: { createdAt: "asc" as any } },
    });

  const [{ data: roomsData, fetching: roomsFetching, error: roomsError }, refetchRooms] =
    useQuery<GetTablesQuery, GetTablesQueryVariables>({
      query: GetTablesDocument,
      variables: {},
    });

  // hydrate store (same pattern as HotelLayout) :contentReference[oaicite:5]{index=5}
  useEffect(() => {
    const fetched = hotelsData?.getAreasNameDescription;
    if (!fetched) return;

    setHotels(
      fetched.map((h) => ({
        id: h.id,
        name: h.name,
        floorPlanImage: h.floorPlanImage ?? null,
        createdAt: h.createdAt,
      }))
    );

    // default selection: first hotel
    if (!selectedHotelId && fetched.length > 0) {
      setSelectedHotelId(fetched[0].id);
    }
  }, [hotelsData, setHotels, selectedHotelId, setSelectedHotelId]);

  useEffect(() => {
    const fetched = roomsData?.getTables;
    if (!fetched) return;

    const mapped: RoomInStore[] = fetched.map((t) => ({
      id: t.id,
      roomNumber: t.tableNumber,
      hotelId: t.areaId,
      position: (t.position as { x: number; y: number }) ?? { x: 0, y: 0 },
      capacity: t.diners,
      isOccupied: t.reserved,
      notes: t.specialRequests ?? [],
      createdAt: asIsoString(t.createdAt),
      updatedAt: asIsoString(t.updatedAt),
      dirty: false,
    }));

    setRooms(mapped);
  }, [roomsData, setRooms]);

  const hotelNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of hotels) map.set(h.id, h.name);
    return map;
  }, [hotels]);

  const filteredRooms = useMemo(() => {
    let list = rooms.slice();

    if (selectedHotelId) list = list.filter((r) => r.hotelId === selectedHotelId);

    if (occupancy === "AVAILABLE") list = list.filter((r) => !r.isOccupied);
    if (occupancy === "OCCUPIED") list = list.filter((r) => r.isOccupied);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => String(r.roomNumber).includes(q));
    }

    list = list.sort((a, b) => a.roomNumber - b.roomNumber);

    if (filter === "ALL") return list;

    return list.filter((room) => {
      const { hk } = parseHousekeepingTags(room.notes);
      const derived = deriveRoomStatus(room.isOccupied, hk);

      if (filter === "NEEDS_CLEANING") return hk.inCleaningList || derived === "VACANT_DIRTY";
      if (filter === "IN_CLEANING_LIST") return hk.inCleaningList;
      if (filter === "MAINTENANCE") return derived === "MAINTENANCE";
      if (filter === "OUT_OF_ORDER") return derived === "OUT_OF_ORDER";
      return true;
    });
  }, [rooms, selectedHotelId, occupancy, search, filter]);

  const counts = useMemo(() => {
    let total = 0;
    let occupied = 0;
    let dirty = 0;
    let inList = 0;
    let maint = 0;
    let ooo = 0;

    for (const r of rooms) {
      if (selectedHotelId && r.hotelId !== selectedHotelId) continue;
      total++;

      if (r.isOccupied) occupied++;

      const { hk } = parseHousekeepingTags(r.notes);
      const derived = deriveRoomStatus(r.isOccupied, hk);

      if (derived === "VACANT_DIRTY") dirty++;
      if (hk.inCleaningList) inList++;
      if (derived === "MAINTENANCE") maint++;
      if (derived === "OUT_OF_ORDER") ooo++;
    }

    return { total, occupied, dirty, inList, maint, ooo };
  }, [rooms, selectedHotelId]);

  const isLoading = hotelsFetching || roomsFetching;

  return (
    <div className="px-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Housekeeping</h1>
            <p className="text-xs text-gray-500">
              Rooms are Tables. Cleaning state is stored in Table.specialRequests as HK tags.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={selectedHotelId ?? ""}
              onChange={(e) => setSelectedHotelId(e.target.value || null)}
              className="text-sm border rounded-lg px-3 py-2 bg-white"
            >
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="text-sm border rounded-lg px-3 py-2 bg-white"
            >
              <option value="NEEDS_CLEANING">Needs cleaning</option>
              <option value="IN_CLEANING_LIST">In cleaning list</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="OUT_OF_ORDER">Out of Order</option>
              <option value="ALL">All rooms</option>
            </select>

            <select
              value={occupancy}
              onChange={(e) => setOccupancy(e.target.value as any)}
              className="text-sm border rounded-lg px-3 py-2 bg-white"
              title="Uses Table.reserved"
            >
              <option value="ALL">All occupancy</option>
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
            </select>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search room #"
              className="text-sm border rounded-lg px-3 py-2 bg-white"
            />

            <button
              onClick={() => refetchRooms({ requestPolicy: "network-only" })}
              className="text-sm bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-950"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-700">
          <span className="px-2 py-1 rounded bg-gray-100">Total: {counts.total}</span>
          <span className="px-2 py-1 rounded bg-red-100 text-red-800">Occupied: {counts.occupied}</span>
          <span className="px-2 py-1 rounded bg-amber-100 text-amber-800">Vacant Dirty: {counts.dirty}</span>
          <span className="px-2 py-1 rounded bg-purple-100 text-purple-800">In list: {counts.inList}</span>
          <span className="px-2 py-1 rounded bg-slate-200 text-slate-800">Maintenance: {counts.maint}</span>
          <span className="px-2 py-1 rounded bg-gray-200 text-gray-700">OOO: {counts.ooo}</span>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-gray-500">Loading…</p> : null}
      {hotelsError || roomsError ? (
        <p className="text-sm text-red-600">
          Failed to load: {(hotelsError || roomsError)?.message}
        </p>
      ) : null}

      {filteredRooms.length === 0 ? (
        <div className="bg-white rounded-lg p-6 text-sm text-gray-600">
          No rooms match the current filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map((room) => (
            <HousekeepingRoomCard
              key={room.id}
              room={room}
              hotelName={hotelNameById.get(room.hotelId) ?? "Hotel"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
