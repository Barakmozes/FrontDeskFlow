"use client";

import React, { useMemo, useState } from "react";
import { useMutation } from "@urql/next";
import toast from "react-hot-toast";
import { HiTrash } from "react-icons/hi2";

import Modal from "../../Common/Modal";

import {
  DeleteTableDocument,
  type DeleteTableMutation,
  type DeleteTableMutationVariables,
} from "@/graphql/generated";

import { useHotelStore, type HotelInStore, type RoomInStore } from "@/lib/AreaStore";

type Props = {
  hotels?: HotelInStore[]; // לשמירה על API עקבי עם שאר המודלים (לא חובה בפועל)
  selectedHotel?: HotelInStore | null;
};

/**
 * DeleteTableModal
 * Backend mapping: Table -> Room
 * UI: מוחק חדר מתוך המלון שנבחר
 */
export default function DeleteTableModals({ selectedHotel }: Props) {
  const rooms = useHotelStore((s) => s.rooms);
  const removeRoom = useHotelStore((s) => s.removeRoom);

  const [isOpen, setIsOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [confirmValue, setConfirmValue] = useState("");

  const hotelRooms = useMemo(() => {
    if (!selectedHotel) return [];
    return rooms
      .filter((r) => r.hotelId === selectedHotel.id)
      .slice()
      .sort((a, b) => a.roomNumber - b.roomNumber);
  }, [rooms, selectedHotel]);

  const selectedRoom: RoomInStore | null = useMemo(() => {
    if (!selectedRoomId) return null;
    return hotelRooms.find((r) => r.id === selectedRoomId) ?? null;
  }, [hotelRooms, selectedRoomId]);

  const closeModal = () => setIsOpen(false);

  const openModal = () => {
    setConfirmValue("");
    setSelectedRoomId(hotelRooms[0]?.id ?? "");
    setIsOpen(true);
  };

  const [{ fetching, error }, deleteTable] = useMutation<
    DeleteTableMutation,
    DeleteTableMutationVariables
  >(DeleteTableDocument);

  const handleDelete = async () => {
    if (!selectedHotel) {
      toast.error("Select a hotel first.");
      return;
    }
    if (!selectedRoom) {
      toast.error("Select a room to delete.");
      return;
    }

    const mustType = String(selectedRoom.roomNumber);
    if (confirmValue.trim() !== mustType) {
      toast.error(`Type ${mustType} to confirm deletion.`);
      return;
    }

    const result = await deleteTable({ deleteTableId: selectedRoom.id });

    if (result.error) {
      console.error("deleteTable error:", result.error);
      toast.error("Failed to delete room.");
      return;
    }

    removeRoom(selectedRoom.id);
    toast.success(`Room ${selectedRoom.roomNumber} deleted.`, { duration: 900 });
    closeModal();
  };

  const disabled = !selectedHotel || hotelRooms.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={disabled}
        className="text-sm bg-red-600 text-white px-3 py-2 rounded-lg shadow hover:bg-red-700 transition"
        aria-label="Delete room"
        title={disabled ? "Select a hotel (and make sure it has rooms)" : "Delete room"}
      >
        Delete room
      </button>

      <Modal
        isOpen={isOpen}
        closeModal={closeModal}
        title={
          selectedHotel
            ? `Delete Room (Hotel: ${selectedHotel.name})`
            : "Delete Room"
        }
      >
        <div className="space-y-4">
          {!selectedHotel ? (
            <p className="text-sm text-gray-700">Please select a hotel first.</p>
          ) : hotelRooms.length === 0 ? (
            <p className="text-sm text-gray-700">
              No rooms found for <span className="font-semibold">{selectedHotel.name}</span>.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-700">
                This will permanently delete the selected room.
              </p>

              <div>
                <label className="block text-sm font-medium mb-1">Select room</label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => {
                    setSelectedRoomId(e.target.value);
                    setConfirmValue("");
                  }}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
                >
                  {hotelRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="confirmRoomNumber">
                  Type{" "}
                  <span className="font-semibold">
                    {selectedRoom ? selectedRoom.roomNumber : ""}
                  </span>{" "}
                  to confirm
                </label>
                <input
                  id="confirmRoomNumber"
                  type="text"
                  value={confirmValue}
                  onChange={(e) => setConfirmValue(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              {error ? <p className="text-sm text-red-600">{error.message}</p> : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={fetching || !selectedRoom}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition disabled:opacity-50"
                >
                  {fetching ? "Deleting…" : "Delete"}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
