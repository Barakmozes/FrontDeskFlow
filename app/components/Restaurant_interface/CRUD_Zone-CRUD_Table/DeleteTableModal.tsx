"use client";

import React, { useState } from "react";
import { HiOutlineTrash } from "react-icons/hi2";
import Modal from "../../Common/Modal";
import { useMutation, useQuery } from "@urql/next";
import { Table } from "@prisma/client";
import {
  DeleteTableDocument,
  DeleteTableMutation,
  DeleteTableMutationVariables,
  GetTablesDocument,
} from "@/graphql/generated";
import toast from "react-hot-toast";

interface DeleteTableModalProps {
  /** The table object to be deleted */
  table: Table;
}

const DeleteTableModal: React.FC<DeleteTableModalProps> = ({ table }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Prepare re-fetch of all tables (so we see immediate update after deletion)
  const [{}, reexecuteTables] = useQuery({
    query: GetTablesDocument,
    pause: true,
  });

  // Mutation to delete a table
  const [{ fetching: deleting }, deleteTable] = useMutation<
    DeleteTableMutation,
    DeleteTableMutationVariables
  >(DeleteTableDocument);

  // Open/close the modal
  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  // Handle the actual deletion
  const handleDelete = async () => {
    try {
      const result = await deleteTable({ deleteTableId: table.id });

      if (result.data?.deleteTable?.tableNumber !== undefined) {
        // Show success toast
        toast.success(
          `Table #${result.data.deleteTable.tableNumber} deleted successfully!`,
          { duration: 1200 }
        );
        // Re-fetch all tables
        reexecuteTables({ requestPolicy: "network-only" });
      }
    } catch (error) {
      console.error("Error deleting table:", error);
      toast.error("Failed to delete table.");
    } finally {
      closeModal();
    }
  };

  return (
    <>
      {/* Trash icon to open the modal */}
      <HiOutlineTrash
        onClick={openModal}
        className="cursor-pointer h-5 w-5 text-red-500 hover:text-red-600 transition"
        aria-label={`Delete table #${table.tableNumber}`}
        title={`Delete table #${table.tableNumber}`}
      />

      {/* The Delete Confirmation Modal */}
      <Modal isOpen={isOpen} closeModal={closeModal}>
        <div className="relative p-4 w-full max-w-md md:h-auto mx-auto bg-white rounded-lg shadow">
          <div className="text-center">
            <HiOutlineTrash
              className="text-gray-400 w-12 h-12 mb-3.5 mx-auto"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Delete Table #{table.tableNumber}
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Are you sure you want to permanently delete this table?
            </p>

            {/* Action Buttons */}
            <div className="flex justify-center items-center space-x-4">
              <button
                onClick={closeModal}
                type="button"
                className="py-2 px-3 text-sm font-medium text-gray-700 bg-gray-200 
                  rounded-lg hover:bg-gray-300 focus:outline-none transition"
              >
                No, cancel
              </button>
              <button
                onClick={handleDelete}
                type="button"
                disabled={deleting}
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

export default DeleteTableModal;
