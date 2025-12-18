"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useMutation, useQuery } from "@urql/next";
import toast from "react-hot-toast";

import {
  GetAreasNameDescriptionDocument,
  GetAreasNameDescriptionQuery,
  GetAreasNameDescriptionQueryVariables,
  GetTablesDocument,
  GetTablesQuery,
  GetTablesQueryVariables,
  UpdateManyTablesDocument,
  UpdateManyTablesMutation,
  UpdateManyTablesMutationVariables,
} from "@/graphql/generated";

import { useHotelStore, type RoomInStore } from "@/lib/AreaStore";

import RoomsSection from "./TablesSection";
import RoomCard from "./TableCard";

import AddHotelForm from "./CRUD_Zone-CRUD_Table/AddZoneForm";
import DeleteHotelModal from "./CRUD_Zone-CRUD_Table/DeleteZoneModal";
import EditHotelModal from "./CRUD_Zone-CRUD_Table/EditZoneModal";
import AddRoomModal from "./CRUD_Zone-CRUD_Table/AddTableModal";

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

/**
 * HotelLayout
 * Client-side mapping only:
 *  - Backend Area  => Hotel
 *  - Backend Table => Room
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

  // ---- Fetch hotels (areas) ----
  const [
    { data: hotelsData, fetching: hotelsFetching, error: hotelsError },
  ] = useQuery<GetAreasNameDescriptionQuery, GetAreasNameDescriptionQueryVariables>({
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
  const [
    { data: roomsData, fetching: roomsFetching, error: roomsError },
    reexecuteRoomsQuery,
  ] = useQuery<GetTablesQuery, GetTablesQueryVariables>({
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
    return rooms.filter((r) => r.hotelId === selectedHotel.id);
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

  // ---- Render ----
  const isLoading = hotelsFetching || roomsFetching;

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
        {isLoading ? (
          <p className="text-sm text-gray-500 mb-2">Loading…</p>
        ) : null}

        {hotelsError || roomsError ? (
          <p className="text-sm text-red-600 mb-2">
            Failed to load data: {(hotelsError || roomsError)?.message}
          </p>
        ) : null}

        {/* Content */}
        {selectedHotel ? (
          <RoomsSection
            hotel={selectedHotel}
            rooms={selectedHotelRooms}
            scale={scale}
            moveRoom={moveRoom}
          />
        ) : hotels.length === 0 ? (
          <div className="text-center text-gray-500 mt-12">
            <p className="text-lg font-medium">
              No hotels found yet. Create your first hotel to start placing rooms.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {hotels.map((hotel) => {
              const hotelRooms = roomsForList.filter((r) => r.hotelId === hotel.id);

              const total = rooms.filter((r) => r.hotelId === hotel.id).length;
              const available = rooms.filter(
                (r) => r.hotelId === hotel.id && !r.isOccupied
              ).length;
              const occupied = total - available;

              return (
                <div key={hotel.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {hotel.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        Rooms: {total} • Available: {available} • Occupied: {occupied}
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
                        <RoomCard key={room.id} room={room} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DndProvider>
  );
};

export default HotelLayout;
