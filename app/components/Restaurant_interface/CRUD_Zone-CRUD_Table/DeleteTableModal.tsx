"use client";

import React, { useState } from "react";
import { useMutation } from "@urql/next";
import toast from "react-hot-toast";
import { HiTrash } from "react-icons/hi2";

import Modal from "../../Common/Modal";

import {
  DeleteTableDocument,
  DeleteTableMutation,
  DeleteTableMutationVariables,
} from "@/graphql/generated";

import { useHotelStore, type RoomInStore } from "@/lib/AreaStore";

interface DeleteRoomModalProps {
  room: RoomInStore;
}

/**
 * DeleteRoomModal
 * Backend mapping: Table -> Room
 */
const DeleteRoomModal: React.FC<DeleteRoomModalProps> = ({ room }) => {
  const removeRoom = useHotelStore((s) => s.removeRoom);

  const [isOpen, setIsOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");

  const closeModal = () => setIsOpen(false);
  const openModal = () => {
    setConfirmValue("");
    setIsOpen(true);
  };

  const [{ fetching, error }, deleteTable] = useMutation<
    DeleteTableMutation,
    DeleteTableMutationVariables
  >(DeleteTableDocument);

  const handleDelete = async () => {
    const mustType = String(room.roomNumber);
    if (confirmValue.trim() !== mustType) {
      toast.error(`Type ${mustType} to confirm deletion.`);
      return;
    }

    const result = await deleteTable({ deleteTableId: room.id });

    if (result.error) {
      console.error("deleteTable error:", result.error);
      toast.error("Failed to delete room.");
      return;
    }

    removeRoom(room.id);
    toast.success("Room deleted.", { duration: 900 });
    closeModal();
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="p-2 rounded hover:bg-gray-100 transition"
        aria-label="Delete room"
        title="Delete room"
      >
        <HiTrash className="w-5 h-5 text-red-600" />
      </button>

      <Modal isOpen={isOpen} closeModal={closeModal} title={`Delete Room ${room.roomNumber}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            This will permanently delete <span className="font-semibold">Room {room.roomNumber}</span>.
          </p>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="confirmRoomNumber">
              Type <span className="font-semibold">{room.roomNumber}</span> to confirm
            </label>
            <input
              id="confirmRoomNumber"
              type="text"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
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
              type="button"
              onClick={handleDelete}
              disabled={fetching}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition disabled:opacity-50"
            >
              {fetching ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DeleteRoomModal;
