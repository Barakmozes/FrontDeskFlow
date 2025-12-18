"use client";

import React from "react";
import { useMutation } from "@urql/next";
import toast from "react-hot-toast";

import {
  ToggleTableReservationDocument,
  ToggleTableReservationMutation,
  ToggleTableReservationMutationVariables,
} from "@/graphql/generated";

import { useHotelStore, type RoomInStore } from "@/lib/AreaStore";

interface ToggleOccupancyProps {
  room: RoomInStore;
}

/**
 * ToggleOccupancy
 * Backend mapping: Table.reserved -> Room.isOccupied
 */
const ToggleOccupancy: React.FC<ToggleOccupancyProps> = ({ room }) => {
  const updateRoom = useHotelStore((state) => state.updateRoom);

  const [{ fetching }, toggleReservation] = useMutation<
    ToggleTableReservationMutation,
    ToggleTableReservationMutationVariables
  >(ToggleTableReservationDocument);

  const handleToggle = async () => {
    const previous = room.isOccupied;
    const next = !previous;

    // Optimistic UI update
    updateRoom(room.id, { isOccupied: next });

    const result = await toggleReservation({
      toggleTableReservationId: room.id,
      reserved: next,
    });

    if (result.error) {
      console.error("toggleReservation error:", result.error);
      // Revert optimistic update
      updateRoom(room.id, { isOccupied: previous });
      toast.error("Failed to update room occupancy.");
      return;
    }

    toast.success(next ? "Marked as occupied" : "Marked as available", {
      duration: 900,
    });
  };

  const buttonLabel = room.isOccupied ? "Mark Available" : "Mark Occupied";

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={fetching}
      className={`text-sm px-3 py-2 rounded-lg shadow transition ${
        fetching
          ? "bg-gray-300 text-gray-700 cursor-not-allowed"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
      aria-label={buttonLabel}
    >
      {fetching ? "Updating…" : buttonLabel}
    </button>
  );
};

export default ToggleOccupancy;
