"use client";

import React, { useState } from "react";
import { HiOutlineTrash } from "react-icons/hi2";
import Modal from "../../Common/Modal";
import { useMutation, useQuery } from "@urql/next";

import {
  BasicArea,
  DeleteAreaDocument,
  DeleteAreaMutation,
  DeleteAreaMutationVariables,
  GetAreasNameDescriptionDocument
} from "@/graphql/generated";
import toast from "react-hot-toast";

type Props = {
  areas: BasicArea[];
  areaSelectToDelete: BasicArea;
};

/**
 * DeleteZoneModal
 * - Displays a dropdown of all areas.
 * - Sends a GraphQL mutation to remove the selected area.
 * - Re-fetches the areas so the UI updates immediately.
 */
const DeleteZoneModal = ({ areas,areaSelectToDelete }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");

  // GraphQL: re-fetch areas so updated info appears immediately
  const [{}, reexecuteQuery] = useQuery({
    query: GetAreasNameDescriptionDocument,
    pause: true,
    variables: {
        orderBy: { createdAt: "asc" },
      }, // We'll call reexecuteQuery manually on success
  });

  // GraphQL: Mutation to delete an area
  const [{ fetching: deleting }, deleteArea] = useMutation<
    DeleteAreaMutation,
    DeleteAreaMutationVariables
  >(DeleteAreaDocument);

  const openModal = () =>
    {
      setSelectedAreaId(areaSelectToDelete?.id||""); // Set the initial area id to the first one in the list
      setIsOpen(true)
    } ;

  const closeModal = () => {
    setIsOpen(false);
    setSelectedAreaId("");
  };
 
  // Handle the actual deletion
  const handleDelete = async () => {
    if (!selectedAreaId) return;
    try {
      const result = await deleteArea({ deleteAreaId: selectedAreaId });
      if (result.data?.deleteArea?.id) {
        toast.success("area  successfully Delete and updated!", { duration: 800 }); 
        reexecuteQuery({ requestPolicy: "network-only" });
      }
    } catch (error) {
      console.error("Error deleting area:", error);
      console.log(error);
    } finally {
      closeModal();
    }
  };

  return (
    <>
      {/* Trash icon to open the modal */}
      <HiOutlineTrash
        onClick={openModal}
        className="cursor-pointer h-6 w-6 text-red-500"
        aria-label="Delete zone"
        aria-hidden="true"
        title="Delete zone"
      />

      {/* The Delete Confirmation Modal */}
      <Modal isOpen={isOpen} closeModal={closeModal}>
        <div className="relative p-4 w-full max-w-md h-full md:h-auto">
          <div className="relative p-4 text-center bg-white rounded-lg shadow">
            <HiOutlineTrash
              className="text-gray-400 w-11 h-11 mb-3.5 mx-auto"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Delete a Zone
            </h2>

            {/* Dropdown to select which area to delete */}
            <div className="mb-4">
              <label
                htmlFor="areaSelect"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Select Zone to Delete
              </label>
              <select
                id="areaSelect"
                
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring focus:ring-red-200"
              >
                <option value="">-- Choose an area --</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>

            <p className="mb-4 text-sm text-gray-500">
              Are you sure you want to permanently delete this zone?
            </p>

            {/* Action Buttons */}
            <div className="flex justify-center items-center space-x-4">
              <button
                onClick={closeModal}
                type="button"
                className="py-2 px-3 text-sm font-medium text-gray-500 bg-white 
                  rounded-lg border border-gray-200 hover:bg-gray-100 focus:outline-none 
                  hover:text-gray-900 transition"
              >
                No, cancel
              </button>
              <button
                onClick={handleDelete}
                type="submit"
                disabled={!selectedAreaId || deleting}
                className="py-2 px-3 text-sm font-medium text-white bg-red-600 
                  rounded-lg hover:bg-red-700 transition disabled:bg-gray-400"
              >
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DeleteZoneModal;
