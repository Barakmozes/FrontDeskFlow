"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@urql/next";
import toast from "react-hot-toast";

import Modal from "../../Common/Modal";

import {
  BasicArea,
  EditAreaDocument,
  EditAreaMutation,
  EditAreaMutationVariables,
  GetAreasNameDescriptionDocument,
} from "@/graphql/generated";

interface EditHotelModalProps {
  areas: BasicArea[];
  /** Optional pre-selected hotel */
  areaSelectToEdit?: BasicArea | null;
}

/**
 * EditHotelModal
 * Backend mapping: Area -> Hotel
 *
 * NOTE: We intentionally keep this modal aligned with BasicArea fields
 * (id, name, floorPlanImage). Description can be added later with a fuller query.
 */
const EditHotelModal: React.FC<EditHotelModalProps> = ({
  areas,
  areaSelectToEdit,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const [selectedHotelId, setSelectedHotelId] = useState<string>("");
  const [hotelName, setHotelName] = useState<string>("");
  const [floorPlanImage, setFloorPlanImage] = useState<string>(""); // URL

  useEffect(() => {
    if (!areaSelectToEdit?.id) return;
    setSelectedHotelId(areaSelectToEdit.id);
    setHotelName(areaSelectToEdit.name ?? "");
    setFloorPlanImage(areaSelectToEdit.floorPlanImage ?? "");
  }, [areaSelectToEdit]);

  const selectedHotel = useMemo(
    () => areas.find((a) => a.id === selectedHotelId),
    [areas, selectedHotelId]
  );

  const openModal = () => {
    if (areaSelectToEdit?.id) {
      setSelectedHotelId(areaSelectToEdit.id);
      setHotelName(areaSelectToEdit.name ?? "");
      setFloorPlanImage(areaSelectToEdit.floorPlanImage ?? "");
    } else if (areas.length > 0 && !selectedHotelId) {
      // default to first hotel
      setSelectedHotelId(areas[0].id);
      setHotelName(areas[0].name ?? "");
      setFloorPlanImage(areas[0].floorPlanImage ?? "");
    }
    setIsOpen(true);
  };

  const closeModal = () => setIsOpen(false);

  const [, reexecuteHotelsQuery] = useQuery({
    query: GetAreasNameDescriptionDocument,
    pause: true,
    variables: { orderBy: { createdAt: "asc" as any } },
  });

  const [{ fetching, error }, editArea] = useMutation<
    EditAreaMutation,
    EditAreaMutationVariables
  >(EditAreaDocument);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHotelId) return;

    const result = await editArea({
      editAreaId: selectedHotelId,
      name: hotelName.trim(),
      floorPlanImage: floorPlanImage.trim() || null,
    });

    if (result.error) {
      console.error("editArea error:", result.error);
      toast.error("Failed to update hotel.");
      return;
    }

    await reexecuteHotelsQuery({ requestPolicy: "network-only" });
    toast.success("Hotel updated.", { duration: 900 });
    closeModal();
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-sm bg-yellow-600 text-white px-3 py-2 rounded-lg shadow hover:bg-yellow-700 transition"
        aria-label="Edit hotel"
      >
        Edit Hotel
      </button>

      <Modal isOpen={isOpen} closeModal={closeModal} title="Edit Hotel">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label
              htmlFor="hotelSelectEdit"
              className="block text-sm font-medium mb-1"
            >
              Select Hotel
            </label>
            <select
              id="hotelSelectEdit"
              value={selectedHotelId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedHotelId(id);

                const found = areas.find((a) => a.id === id);
                setHotelName(found?.name ?? "");
                setFloorPlanImage(found?.floorPlanImage ?? "");
              }}
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

          <div>
            <label htmlFor="hotelNameEdit" className="block text-sm font-medium mb-1">
              Hotel Name
            </label>
            <input
              id="hotelNameEdit"
              type="text"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
            />
          </div>

          <div>
            <label htmlFor="floorPlanImage" className="block text-sm font-medium mb-1">
              Floor Plan Image URL (optional)
            </label>
            <input
              id="floorPlanImage"
              type="url"
              value={floorPlanImage}
              onChange={(e) => setFloorPlanImage(e.target.value)}
              placeholder="https://…"
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
            {floorPlanImage ? (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">Preview</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={floorPlanImage}
                  alt={selectedHotel?.name ?? "Floor plan"}
                  className="w-full max-h-40 object-cover rounded border"
                />
              </div>
            ) : null}
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
              disabled={fetching || !selectedHotelId}
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

export default EditHotelModal;
