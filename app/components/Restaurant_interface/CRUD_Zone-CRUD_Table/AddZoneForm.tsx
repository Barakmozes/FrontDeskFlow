"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "@urql/next";
import toast from "react-hot-toast";

import Modal from "../../Common/Modal";
import AddHotelButton from "./AddZoneModal";

import {
  AddAreaDocument,
  AddAreaMutation,
  AddAreaMutationVariables,
  GetAreasNameDescriptionDocument,
} from "@/graphql/generated";

/**
 * AddHotelForm
 * Backend mapping: Area -> Hotel
 */
const AddHotelForm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hotelName, setHotelName] = useState("");
  const [hotelDescription, setHotelDescription] = useState("");

  const closeModal = () => setIsOpen(false);
  const openModal = () => setIsOpen(true);

  // Re-execute hotel list query after mutation success
  const [, reexecuteHotelsQuery] = useQuery({
    query: GetAreasNameDescriptionDocument,
    pause: true,
    variables: {
      orderBy: { createdAt: "asc" as any },
    },
  });

  const [{ fetching, error }, addArea] = useMutation<
    AddAreaMutation,
    AddAreaMutationVariables
  >(AddAreaDocument);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelName.trim()) return;

    const result = await addArea({
      name: hotelName.trim(),
      description: hotelDescription.trim(),
    });

    if (result.error) {
      console.error("Failed to add hotel:", result.error);
      toast.error("Failed to add hotel.");
      return;
    }

    if (result.data?.addArea?.id) {
      await reexecuteHotelsQuery({ requestPolicy: "network-only" });
      setHotelName("");
      setHotelDescription("");
      closeModal();
      toast.success("Hotel created!", { duration: 900 });
    }
  };

  return (
    <>
      <AddHotelButton openModal={openModal} />

      <Modal isOpen={isOpen} closeModal={closeModal} title="Create a New Hotel">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="hotelName" className="block text-sm font-medium mb-1">
              Hotel Name <span className="text-red-500">*</span>
            </label>
            <input
              id="hotelName"
              type="text"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              placeholder="Enter hotel name"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring focus:ring-blue-200"
              required
            />
          </div>

          <div>
            <label
              htmlFor="hotelDescription"
              className="block text-sm font-medium mb-1"
            >
              Description (optional)
            </label>
            <textarea
              id="hotelDescription"
              value={hotelDescription}
              onChange={(e) => setHotelDescription(e.target.value)}
              placeholder="Describe this hotel / property"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring focus:ring-blue-200"
              rows={3}
            />
          </div>

          {error ? (
            <p className="text-red-600 text-sm">{error.message}</p>
          ) : null}

          <div className="flex justify-end gap-2 mt-2">
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
              {fetching ? "Creating…" : "Create Hotel"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default AddHotelForm;
