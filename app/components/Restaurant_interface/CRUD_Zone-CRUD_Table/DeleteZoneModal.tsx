"use client";

import React, { useEffect, useState } from "react";
import { useMutation, useQuery } from "@urql/next";
import toast from "react-hot-toast";

import Modal from "../../Common/Modal";

import {
  BasicArea,
  DeleteAreaDocument,
  DeleteAreaMutation,
  DeleteAreaMutationVariables,
  GetAreasNameDescriptionDocument,
} from "@/graphql/generated";

interface DeleteHotelModalProps {
  areas: BasicArea[];
  /** Optional pre-selected hotel */
  areaSelectToDelete?: BasicArea | null;
}

/**
 * DeleteHotelModal
 * Backend mapping: Area -> Hotel
 */
const DeleteHotelModal: React.FC<DeleteHotelModalProps> = ({
  areas,
  areaSelectToDelete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState<string>("");
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (areaSelectToDelete?.id) setSelectedHotelId(areaSelectToDelete.id);
  }, [areaSelectToDelete]);

  const openModal = () => {
    if (areaSelectToDelete?.id) setSelectedHotelId(areaSelectToDelete.id);
    setConfirmText("");
    setIsOpen(true);
  };

  const closeModal = () => setIsOpen(false);

  const [, reexecuteHotelsQuery] = useQuery({
    query: GetAreasNameDescriptionDocument,
    pause: true,
    variables: { orderBy: { createdAt: "asc" as any } },
  });

  const [{ fetching }, deleteArea] = useMutation<
    DeleteAreaMutation,
    DeleteAreaMutationVariables
  >(DeleteAreaDocument);

  const selectedHotel = areas.find((a) => a.id === selectedHotelId);

  const handleDelete = async () => {
    if (!selectedHotelId) return;

    const mustType = selectedHotel?.name ?? "";

    if (confirmText.trim() !== mustType) {
      toast.error("Confirmation text does not match the hotel name.");
      return;
    }

    const result = await deleteArea({ deleteAreaId: selectedHotelId });

    if (result.error) {
      console.error("deleteArea error:", result.error);
      toast.error("Failed to delete hotel.");
      return;
    }

    await reexecuteHotelsQuery({ requestPolicy: "network-only" });
    toast.success("Hotel deleted.", { duration: 900 });
    closeModal();
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-sm bg-red-600 text-white px-3 py-2 rounded-lg shadow hover:bg-red-700 transition"
        aria-label="Delete hotel"
      >
        Delete Hotel
      </button>

      <Modal isOpen={isOpen} closeModal={closeModal} title="Delete Hotel">
        <div className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="hotelSelect"
            >
              Select Hotel
            </label>
            <select
              id="hotelSelect"
              value={selectedHotelId}
              onChange={(e) => setSelectedHotelId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">-- Select a hotel --</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {!selectedHotel ? (
            <p className="text-sm text-gray-500">
              Select a hotel to delete.
            </p>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm text-red-800">
                This will permanently delete{" "}
                <span className="font-semibold">{selectedHotel.name}</span>.
              </p>
              <p className="text-xs text-red-700 mt-2">
                Type the hotel name to confirm:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={selectedHotel.name}
                className="mt-2 w-full px-3 py-2 border border-red-300 rounded"
              />
            </div>
          )}

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
              disabled={fetching || !selectedHotelId}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition disabled:opacity-50"
            >
              {fetching ? "Deleting…" : "Delete Hotel"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DeleteHotelModal;
