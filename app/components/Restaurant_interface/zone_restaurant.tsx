"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useMutation, useQuery } from "@urql/next";
import toast from "react-hot-toast";
import gql from "graphql-tag";

import {
  GetAreasNameDescriptionDocument,
  GetAreasNameDescriptionQuery,
  GetAreasNameDescriptionQueryVariables,
  GetTablesDocument,
  GetTablesQuery,
  GetTablesQueryVariables,
  ReservationStatus,
  UpdateManyTablesDocument,
  UpdateManyTablesMutation,
  UpdateManyTablesMutationVariables,
} from "@/graphql/generated";

import { useHotelStore, type RoomInStore } from "@/lib/AreaStore";
import { useFrontDeskUIStore } from "@/lib/frontDeskUIStore";

import RoomsSection from "./TablesSection"; // keep layout mechanics intact
import RoomSummaryCard, { type RoomReservationPreview } from "./RoomSummaryCard";

import AddHotelForm from "./CRUD_Zone-CRUD_Table/AddZoneForm";
import DeleteHotelModal from "./CRUD_Zone-CRUD_Table/DeleteZoneModal";
import EditHotelModal from "./CRUD_Zone-CRUD_Table/EditZoneModal";
import AddRoomModal from "./CRUD_Zone-CRUD_Table/AddTableModal";
import AddReservationModal from "./CRUD_Reservation/AddReservationModal";

type ListFilter = "ALL" | "AVAILABLE" | "OCCUPIED";

const asIsoString = (value: unknown): string => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  try {
    return String(value);
  } catch {
    return "";
  }
};

// Convert any DateTime into a local YYYY-MM-DD key.
// We use local keys because <input type="date"> is local-day based.
const toLocalDateKey = (value: unknown): string => {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Board reservations query:
 * We intentionally do ONE query and map in memory,
 * to avoid N queries (one per room).
 *
 * Later (Step-2/3) you’ll add backend query like:
 *   getReservationsByDate(hotelId, from, to)
 * for performance at scale.
 */
const GetReservationsForBoardDocument = gql`
  query GetReservationsForBoard {
    getReservations {
      id
      tableId
      reservationTime
      numOfDiners
      status
      userEmail
      user {
        profile {
          name
          phone
        }
      }
    }
  }
`;

type GetReservationsForBoardQuery = {
  getReservations: Array<{
    id: string;
    tableId: string;
    reservationTime: string;
    numOfDiners: number;
    status: ReservationStatus;
    userEmail: string;
    user: {
      profile: null | {
        name: string | null;
        phone: string | null;
      };
    };
  }>;
};

/**
 * HotelLayout
 * Client-side mapping only:
 *  - Backend Area  => Hotel
 *  - Backend Table => Room
 *  - Backend Reservation => Booking (day-level for now)
 */
const HotelLayout = () => {
  const [listFilter, setListFilter] = useState<ListFilter>("ALL");

  const {
    hotels,
    setHotels,
    selectedHotel,
    setSelectedHotel,
    clearSelectedHotel,
    rooms,
    setRooms,
    moveRoom,
    scale,
    adjustScale,
  } = useHotelStore();

  // Global UI state for board date + modal
  const selectedDate = useFrontDeskUIStore((s) => s.selectedDate);
  const setSelectedDate = useFrontDeskUIStore((s) => s.setSelectedDate);
  const reservationModal = useFrontDeskUIStore((s) => s.reservationModal);
  const closeReservationModal = useFrontDeskUIStore((s) => s.closeReservationModal);

  // ---- Fetch hotels (areas) ----
  const [{ data: hotelsData, fetching: hotelsFetching, error: hotelsError }] =
    useQuery<GetAreasNameDescriptionQuery, GetAreasNameDescriptionQueryVariables>({
      query: GetAreasNameDescriptionDocument,
      variables: {
        orderBy: { createdAt: "asc" as any },
      },
    });

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
  }, [hotelsData, setHotels]);

  // ---- Fetch rooms (tables) ----
  const [{ data: roomsData, fetching: roomsFetching, error: roomsError }, reexecuteRoomsQuery] =
    useQuery<GetTablesQuery, GetTablesQueryVariables>({
      query: GetTablesDocument,
      variables: {},
    });

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

  // ---- Fetch reservations for board (one query) ----
  const [{ data: reservationsData, fetching: reservationsFetching, error: reservationsError }, reexecuteReservations] =
    useQuery<GetReservationsForBoardQuery>({
      query: GetReservationsForBoardDocument,
      variables: {},
      requestPolicy: "cache-first",
    });

  // Build a map: roomId -> reservations for the selected board date
  const reservationsByRoomForDate = useMemo(() => {
    const map = new Map<string, RoomReservationPreview[]>();

    const all = reservationsData?.getReservations ?? [];
    for (const r of all) {
      // For board: ignore cancelled/completed
      if (r.status === ReservationStatus.Cancelled || r.status === ReservationStatus.Completed) continue;

      // Only keep reservations matching selected board date
      if (toLocalDateKey(r.reservationTime) !== selectedDate) continue;

      const entry: RoomReservationPreview = {
        id: r.id,
        reservationTime: r.reservationTime,
        status: r.status,
        numOfDiners: r.numOfDiners,
        guestEmail: r.userEmail,
        guestName: r.user.profile?.name ?? null,
        guestPhone: r.user.profile?.phone ?? null,
      };

      const list = map.get(r.tableId) ?? [];
      list.push(entry);
      map.set(r.tableId, list);
    }

    // Sort each room’s reservations by time for stable UI
map.forEach((list, roomId) => {
  list.sort(
    (a, b) =>
      new Date(a.reservationTime).getTime() -
      new Date(b.reservationTime).getTime()
  );
});

    return map;
  }, [reservationsData, selectedDate]);

  // ---- Bulk save (layout positions) ----
  const [{ fetching: savingLayout }, updateManyRooms] = useMutation<
    UpdateManyTablesMutation,
    UpdateManyTablesMutationVariables
  >(UpdateManyTablesDocument);

  const handleSaveLayout = async () => {
    const changed = useHotelStore.getState().rooms.filter((r) => r.dirty);
    if (changed.length === 0) {
      toast("No layout changes to save.", { duration: 900 });
      return;
    }

    const updates = changed.map((r) => ({
      id: r.id,
      areaId: r.hotelId,
      position: r.position,
    }));

    const result = await updateManyRooms({ updates });

    if (result.error) {
      console.error("updateManyTables error:", result.error);
      toast.error("Failed to save layout.");
      return;
    }

    // Clear dirty flags locally
    useHotelStore.setState((state) => ({
      rooms: state.rooms.map((room) => ({ ...room, dirty: false })),
    }));

    toast.success("Layout saved.", { duration: 900 });
    reexecuteRoomsQuery({ requestPolicy: "network-only" });
  };

  // ---- Derived room sets ----
  const selectedHotelRooms = useMemo(() => {
    if (!selectedHotel) return [];
    return rooms
      .filter((r) => r.hotelId === selectedHotel.id)
      .slice()
      .sort((a, b) => a.roomNumber - b.roomNumber);
  }, [rooms, selectedHotel]);

  const roomsForList = useMemo(() => {
    if (listFilter === "AVAILABLE") return rooms.filter((r) => !r.isOccupied);
    if (listFilter === "OCCUPIED") return rooms.filter((r) => r.isOccupied);
    return rooms;
  }, [rooms, listFilter]);

  // ---- UI actions ----
  const showAllRooms = () => {
    clearSelectedHotel();
    setListFilter("ALL");
  };

  const showAvailableRooms = () => {
    clearSelectedHotel();
    setListFilter("AVAILABLE");
  };

  const showOccupiedRooms = () => {
    clearSelectedHotel();
    setListFilter("OCCUPIED");
  };

  const handleOpenHotelLayout = (hotelId: string) => {
    setSelectedHotel(hotelId);
  };

  // Resolve selected room for modal
  const modalRoom = useMemo(() => {
    if (!reservationModal.roomId) return null;
    return rooms.find((r) => r.id === reservationModal.roomId) ?? null;
  }, [reservationModal.roomId, rooms]);

  const modalExistingReservations = useMemo(() => {
    if (!modalRoom) return [];
    return reservationsByRoomForDate.get(modalRoom.id) ?? [];
  }, [modalRoom, reservationsByRoomForDate]);

  // ---- Render ----
  const isLoading = hotelsFetching || roomsFetching || reservationsFetching;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="px-6 bg-gray-50 min-h-screen">
        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white px-4 py-3 rounded-lg shadow-md mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Hotel Layout
              {selectedHotel?.name ? (
                <span className="text-gray-500 font-medium"> — {selectedHotel.name}</span>
              ) : null}
            </h2>
            <p className="text-xs text-gray-500">
              Hotels are Areas in the backend. Rooms are Tables. Drag rooms on the floor plan, then click “Save Layout”.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
            {/* Board date */}
            <div className="flex items-center gap-2 bg-gray-50 border rounded-lg px-2 py-1">
              <span className="text-xs text-gray-600">Board date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs bg-transparent outline-none"
              />
            </div>

            <button
              type="button"
              onClick={clearSelectedHotel}
              className="text-sm bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 transition"
            >
              Clear Selection
            </button>

            <button
              type="button"
              onClick={showAllRooms}
              className="text-sm bg-green-600 text-white px-3 py-2 rounded-lg shadow hover:bg-green-700 transition"
            >
              All Rooms
            </button>

            <button
              type="button"
              onClick={showAvailableRooms}
              className="text-sm bg-green-600 text-white px-3 py-2 rounded-lg shadow hover:bg-green-700 transition"
            >
              Available Rooms
            </button>

            <button
              type="button"
              onClick={showOccupiedRooms}
              className="text-sm bg-green-600 text-white px-3 py-2 rounded-lg shadow hover:bg-green-700 transition"
            >
              Occupied Rooms
            </button>

            <div className="w-px bg-gray-200 mx-1" />

            <AddHotelForm />
            <DeleteHotelModal areas={hotels} areaSelectToDelete={selectedHotel} />
            <EditHotelModal areas={hotels} areaSelectToEdit={selectedHotel} />
            <AddRoomModal hotels={hotels} selectedHotel={selectedHotel} />

            <div className="w-px bg-gray-200 mx-1" />

            <button
              type="button"
              onClick={() => adjustScale(0.1)}
              className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg shadow hover:bg-blue-700 transition"
            >
              Zoom In
            </button>

            <button
              type="button"
              onClick={() => adjustScale(-0.1)}
              className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg shadow hover:bg-blue-700 transition"
            >
              Zoom Out
            </button>

            <button
              type="button"
              onClick={handleSaveLayout}
              disabled={savingLayout}
              className={`text-sm px-3 py-2 rounded-lg shadow transition ${
                savingLayout
                  ? "bg-gray-300 text-gray-700 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {savingLayout ? "Saving…" : "Save Layout"}
            </button>
          </div>
        </div>

        {/* Loading & errors */}
        {isLoading ? <p className="text-sm text-gray-500 mb-2">Loading…</p> : null}

        {hotelsError || roomsError || reservationsError ? (
          <p className="text-sm text-red-600 mb-2">
            Failed to load data: {(hotelsError || roomsError || reservationsError)?.message}
          </p>
        ) : null}

        {/* Content */}
        {selectedHotel ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
            {/* Keep your existing DnD layout section intact */}
            <RoomsSection hotel={selectedHotel} rooms={selectedHotelRooms} scale={scale} moveRoom={moveRoom} />

            {/* Front-desk side panel (fast + clear) */}
            <aside className="bg-white rounded-lg shadow-md p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800">
                  Rooms • {selectedDate}
                </h3>
                <button
                  type="button"
                  onClick={() => reexecuteReservations({ requestPolicy: "network-only" })}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                >
                  Refresh
                </button>
              </div>

              <div className="space-y-3 max-h-[72vh] overflow-auto pr-1">
                {selectedHotelRooms.map((room) => (
                  <RoomSummaryCard
                    key={room.id}
                    room={room}
                    dateKey={selectedDate}
                    reservationsForDate={reservationsByRoomForDate.get(room.id) ?? []}
                    compact
                  />
                ))}
              </div>
            </aside>
          </div>
        ) : hotels.length === 0 ? (
          <div className="text-center text-gray-500 mt-12">
            <p className="text-lg font-medium">
              No hotels found yet. Create your first hotel to start placing rooms.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {hotels.map((hotel) => {
              const hotelRooms = roomsForList
                .filter((r) => r.hotelId === hotel.id)
                .slice()
                .sort((a, b) => a.roomNumber - b.roomNumber);

              const total = rooms.filter((r) => r.hotelId === hotel.id).length;
              const available = rooms.filter((r) => r.hotelId === hotel.id && !r.isOccupied).length;
              const occupied = total - available;

              return (
                <div key={hotel.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{hotel.name}</h3>
                      <p className="text-xs text-gray-500">
                        Rooms: {total} • Available: {available} • Occupied: {occupied}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Board date: <span className="font-medium text-gray-600">{selectedDate}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenHotelLayout(hotel.id)}
                      className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg shadow hover:bg-blue-700 transition"
                    >
                      Open Layout
                    </button>
                  </div>

                  {hotelRooms.length === 0 ? (
                    <p className="text-sm text-gray-500">No rooms match this filter.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {hotelRooms.map((room) => (
                        <RoomSummaryCard
                          key={room.id}
                          room={room}
                          dateKey={selectedDate}
                          reservationsForDate={reservationsByRoomForDate.get(room.id) ?? []}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Booking modal (mounted once, driven by global UI store) */}
        <AddReservationModal
          open={reservationModal.isOpen}
          onClose={closeReservationModal}
          room={modalRoom}
          dateKey={selectedDate}
          existingReservationsForDate={modalExistingReservations}
          onCreated={() => reexecuteReservations({ requestPolicy: "network-only" })}
        />
      </div>
    </DndProvider>
  );
};

export default HotelLayout;
