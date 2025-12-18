"use client";

import React from "react";

import type { RoomInStore } from "@/lib/AreaStore";

import ToggleOccupancy from "./Table_Settings/ToggleReservation";
import RoomBookings from "./Table_Settings/TableReservations";
import EditRoomModal from "./CRUD_Zone-CRUD_Table/EditTableModal";
import DeleteRoomModal from "./CRUD_Zone-CRUD_Table/DeleteTableModal";

interface RoomCardProps {
  room: RoomInStore;
}

/**
 * RoomCard (list view)
 * A compact summary card for a room in a hotel.
 */
const RoomCard: React.FC<RoomCardProps> = ({ room }) => {
  const statusLabel = room.isOccupied ? "Occupied" : "Available";
  const statusClass = room.isOccupied
    ? "bg-red-100 text-red-700"
    : "bg-green-100 text-green-700";

  return (
    <div className="relative bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-base font-semibold text-gray-800">
            Room {room.roomNumber}
            {room.dirty ? (
              <span className="ml-2 text-xs text-orange-600 font-medium">
                • unsaved
              </span>
            ) : null}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Max guests: {room.capacity}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusClass}`}>
            {statusLabel}
          </span>
          <EditRoomModal room={room} />
          <DeleteRoomModal room={room} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ToggleOccupancy room={room} />
        <RoomBookings room={room} />
      </div>

      {room.notes?.length ? (
        <p className="mt-3 text-xs text-gray-600 line-clamp-2">
          <span className="font-semibold">Notes:</span> {room.notes.join(", ")}
        </p>
      ) : null}
    </div>
  );
};

export default React.memo(RoomCard);
