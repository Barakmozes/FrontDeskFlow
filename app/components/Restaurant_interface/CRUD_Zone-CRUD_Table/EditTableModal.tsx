"use client";

import React, { useEffect, useState } from "react";
import { useMutation } from "@urql/next";
import toast from "react-hot-toast";
import { HiPencilSquare } from "react-icons/hi2";

import Modal from "../../Common/Modal";

import {
  EditTableDocument,
  EditTableMutation,
  EditTableMutationVariables,
} from "@/graphql/generated";

import { useHotelStore, type RoomInStore } from "@/lib/AreaStore";

interface EditRoomModalProps {
  room: RoomInStore;
}

/**
 * EditRoomModal
 * Backend mapping: Table -> Room
 */
const EditRoomModal: React.FC<EditRoomModalProps> = ({ room }) => {
  const hotels = useHotelStore((s) => s.hotels);
  const updateRoom = useHotelStore((s) => s.updateRoom);

  const [isOpen, setIsOpen] = useState(false);

  const [hotelId, setHotelId] = useState(room.hotelId);
  const [roomNumber, setRoomNumber] = useState(room.roomNumber);
  const [capacity, setCapacity] = useState(room.capacity);
  const [isOccupied, setIsOccupied] = useState(room.isOccupied);
  const [posX, setPosX] = useState(room.position?.x ?? 0);
  const [posY, setPosY] = useState(room.position?.y ?? 0);

  useEffect(() => {
    // Keep form in sync if the room changes in the store
    if (!isOpen) return;
    setHotelId(room.hotelId);
    setRoomNumber(room.roomNumber);
    setCapacity(room.capacity);
    setIsOccupied(room.isOccupied);
    setPosX(room.position?.x ?? 0);
    setPosY(room.position?.y ?? 0);
  }, [isOpen, room]);

  const closeModal = () => setIsOpen(false);
  const openModal = () => setIsOpen(true);

  const [{ fetching, error }, editTable] = useMutation<
    EditTableMutation,
    EditTableMutationVariables
  >(EditTableDocument);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
const result = await editTable({
  editTableId: room.id,
  areaId: hotelId,
  tableNumber: roomNumber,
  diners: capacity,
  reserved: isOccupied,
  position: { x: posX, y: posY },
});


    if (result.error) {
      console.error("editTable error:", result.error);
      toast.error("Failed to update room.");
      return;
    }

    updateRoom(room.id, {
      hotelId,
      roomNumber,
      capacity,
      isOccupied,
      position: { x: posX, y: posY },
      dirty: false,
    });

    toast.success("Room updated.", { duration: 900 });
    closeModal();
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="p-2 rounded hover:bg-gray-100 transition"
        aria-label="Edit room"
        title="Edit room"
      >
        <HiPencilSquare className="w-5 h-5 text-gray-700" />
      </button>

      <Modal isOpen={isOpen} closeModal={closeModal} title={`Edit Room ${room.roomNumber}`}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="editRoomHotel" className="block text-sm font-medium mb-1">
              Hotel
            </label>
            <select
              id="editRoomHotel"
              value={hotelId}
              onChange={(e) => setHotelId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              required
            >
              {hotels.length === 0 ? (
                <option value={hotelId}>{hotelId}</option>
              ) : (
                hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="editRoomNumber" className="block text-sm font-medium mb-1">
                Room Number
              </label>
              <input
                id="editRoomNumber"
                type="number"
                value={roomNumber}
                onChange={(e) => setRoomNumber(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
                min={1}
                required
              />
            </div>

            <div>
              <label htmlFor="editCapacity" className="block text-sm font-medium mb-1">
                Max Guests
              </label>
              <input
                id="editCapacity"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
                min={1}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="editOccupied"
              type="checkbox"
              checked={isOccupied}
              onChange={(e) => setIsOccupied(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="editOccupied" className="text-sm text-gray-700">
              Occupied
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="editPosX" className="block text-sm font-medium mb-1">
                Position X
              </label>
              <input
                id="editPosX"
                type="number"
                value={posX}
                onChange={(e) => setPosX(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="editPosY" className="block text-sm font-medium mb-1">
                Position Y
              </label>
              <input
                id="editPosY"
                type="number"
                value={posY}
                onChange={(e) => setPosY(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-red-600">{error.message}</p>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={fetching}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition disabled:opacity-50"
            >
              {fetching ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default EditRoomModal;
