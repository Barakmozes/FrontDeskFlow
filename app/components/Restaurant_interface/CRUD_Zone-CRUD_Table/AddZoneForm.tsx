"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "@urql/next";
import Modal from "../../Common/Modal";
import AddZoneModal from "./AddZoneModal";
import {
  AddAreaDocument,
  AddAreaMutation,
  AddAreaMutationVariables,
  GetAreasNameDescriptionDocument,
} from "@/graphql/generated";
import toast from "react-hot-toast";

const AddZoneForm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [zoneDescription, setZoneDescription] = useState("");

  const closeModal = () => setIsOpen(false);
  const openModal = () => setIsOpen(true);

  // 1) Pause the query so it won't run on mount. We only reexecute after mutation success.
  const [{}, reexecuteQuery] = useQuery({
    query: GetAreasNameDescriptionDocument,
    pause: true,
    variables: {
      // Same example from DeleteZoneModal
      orderBy: { createdAt: "asc" },
    },
  });

  // 2) GraphQL Mutation: addArea
  const [{ fetching, error }, addArea] = useMutation<
    AddAreaMutation,
    AddAreaMutationVariables
  >(AddAreaDocument);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) return;

    try {
      const result = await addArea({
        name: zoneName,
        description: zoneDescription,
      });

      if (result.data?.addArea?.id) {
        // Success: re-fetch the areas, reset form, show toast
        await reexecuteQuery({ requestPolicy: "network-only" });
        setZoneName("");
        setZoneDescription("");
        closeModal();
        toast.success("Area successfully added and updated!", { duration: 800 });
      }
    } catch (err) {
      console.error("Failed to add area:", err);
    }
  };

  return (
    <>
      {/* 1) Button or UI to open the modal */}
      <AddZoneModal openModal={openModal} />

      {/* 2) Modal with the creation form */}
      <Modal isOpen={isOpen} closeModal={closeModal}>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 max-w-md mx-auto p-4 bg-white rounded-lg shadow-md"
        >
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Create a New Zone
          </h2>

          {/* Zone Name */}
          <div>
            <label htmlFor="zoneName" className="block text-sm font-medium mb-1">
              Zone Name <span className="text-red-500">*</span>
            </label>
            <input
              id="zoneName"
              type="text"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="Enter zone name"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring focus:ring-blue-200"
              required
            />
          </div>

          {/* Zone Description (optional) */}
          <div>
            <label
              htmlFor="zoneDescription"
              className="block text-sm font-medium mb-1"
            >
              Description (optional)
            </label>
            <textarea
              id="zoneDescription"
              value={zoneDescription}
              onChange={(e) => setZoneDescription(e.target.value)}
              placeholder="Describe this zone"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring focus:ring-blue-200"
              rows={3}
            />
          </div>

          {/* Error Handling */}
          {error && (
            <p className="text-red-600 text-sm">
              Something went wrong: {error.message}
            </p>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-2 mt-4">
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
              {fetching ? "Adding..." : "Add Zone"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default AddZoneForm;
