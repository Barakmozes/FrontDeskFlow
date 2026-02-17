"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "@urql/next";
import toast from "react-hot-toast";

import Modal from "../../Common/Modal";

import {
  AddTableDocument,
  AddTableMutation,
  AddTableMutationVariables,
  BasicArea,
  GetTablesDocument,
} from "@/graphql/generated";

interface AddRoomModalProps {
  hotels: BasicArea[];
  selectedHotel?: BasicArea | null;
}

/**
 * AddRoomModal
 * Backend mapping: Table -> Room
 */
const AddRoomModal: React.FC<AddRoomModalProps> = ({ hotels, selectedHotel }) => {
  const [isOpen, setIsOpen] = useState(false);

  const [hotelId, setHotelId] = useState<string>(selectedHotel?.id ?? "");
  const [roomNumber, setRoomNumber] = useState<number>(0);
  const [capacity, setCapacity] = useState<number>(2);
  const [posX, setPosX] = useState<number>(0);
  const [posY, setPosY] = useState<number>(0);

  useEffect(() => {
    setHotelId(selectedHotel?.id ?? "");
  }, [selectedHotel?.id]);

  const openModal = () => {
    setHotelId(selectedHotel?.id ?? hotelId);
    setIsOpen(true);
  };

  const closeModal = () => setIsOpen(false);

  // Re-fetch rooms after adding
  const [, reexecuteRoomsQuery] = useQuery({
    query: GetTablesDocument,
    pause: true,
  });

  const [{ fetching, error }, addTable] = useMutation<
    AddTableMutation,
    AddTableMutationVariables
  >(AddTableDocument);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelId) {
      toast.error("Please select a hotel.");
      return;
    }
    if (!Number.isFinite(roomNumber) || roomNumber <= 0) {
      toast.error("Room number must be a positive number.");
      return;
    }

const result = await addTable({
  areaId: hotelId,
  tableNumber: roomNumber,
  diners: capacity,
  position: { x: posX, y: posY },
});
    if (result.error) {
      console.error("addTable error:", result.error);
      toast.error("Failed to add room.");
      return;
    }

    toast.success("Room added.", { duration: 900 });
    await reexecuteRoomsQuery({ requestPolicy: "network-only" });
    closeModal();

    // Reset form but keep selected hotel
    setRoomNumber(0);
    setCapacity(2);
    setPosX(0);
    setPosY(0);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg shadow hover:bg-blue-700 transition"
        aria-label="Add room"
      >
        Add Room
      </button>

      <Modal isOpen={isOpen} closeModal={closeModal} title="Add Room">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label htmlFor="hotelSelect" className="block text-sm font-medium mb-1">
              Hotel
            </label>
            <select
              id="hotelSelect"
              value={hotelId}
              onChange={(e) => setHotelId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              required
            >
              <option value="">-- Select a hotel --</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="roomNumber" className="block text-sm font-medium mb-1">
                Room Number
              </label>
              <input
                id="roomNumber"
                type="number"
                value={roomNumber}
                onChange={(e) => setRoomNumber(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
                min={1}
                required
              />
            </div>

            <div>
              <label htmlFor="capacity" className="block text-sm font-medium mb-1">
                Max Guests
              </label>
              <input
                id="capacity"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
                min={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="posX" className="block text-sm font-medium mb-1">
                Position X
              </label>
              <input
                id="posX"
                type="number"
                value={posX}
                onChange={(e) => setPosX(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="posY" className="block text-sm font-medium mb-1">
                Position Y
              </label>
              <input
                id="posY"
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
              {fetching ? "Adding…" : "Add Room"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default AddRoomModal;
