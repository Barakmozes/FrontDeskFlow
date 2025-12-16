"use client";

import React, { useState } from "react";
import { FaEdit } from "react-icons/fa";
import Modal from "../../Common/Modal";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";
import {
  EditTableDocument,
  EditTableMutation,
  EditTableMutationVariables,
  GetTablesDocument,
} from "@/graphql/generated";
import { Table } from "@prisma/client";
import { useRestaurantStore } from "@/lib/AreaStore";
/**
 * Props:
 * - table: the table to edit
 * - allAreas: array of areas so the user can choose a different one (move the table)
 */
interface EditTableModalProps {
  table: Table;
}

const EditTableModal: React.FC<EditTableModalProps> = ({ table }) => {
  const [isOpen, setIsOpen] = useState(false);

  // 1) Local state: we store the table’s areaId, tableNumber, etc.
  const [areaId, setAreaId] = useState(table.areaId);
  const [tableNumber, setTableNumber] = useState<number>(table.tableNumber);
  const [diners, setDiners] = useState<number>(table.diners);
  const [reserved, setReserved] = useState<boolean>(table.reserved);
  const [position, setPosition] = useState<{ x: number; y: number }>(
    (table.position as any) || { x: 0, y: 0 }
  );
  // 2) Zustand store references
  const {
    areas,
  } = useRestaurantStore();
  // GraphQL for editing a table
  const [{ fetching: updating }, editTable] = useMutation<
    EditTableMutation,
    EditTableMutationVariables
  >(EditTableDocument);

  // So we can refetch
  const [{}, reexecuteTables] = useQuery({
    query: GetTablesDocument,
    pause: true,
  });

  // 2) Modal open/close
  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  // 3) Submit changes (including new areaId)
  const handleEditTable = async () => {
    try {
      const result = await editTable({
        editTableId: table.id,
        areaId,  // crucial: pass the new area
        tableNumber,
        diners,
        reserved,
        position,
      });

      if (result.data?.editTable?.id) {
        toast.success("Table updated successfully!");
        reexecuteTables({ requestPolicy: "network-only" });
        closeModal();
      }
    } catch (error) {
      toast.error("Failed to update table.");
      console.error(error);
    }
  };

  return (
    <>
      {/* Trigger to open modal */}
      <button
        onClick={openModal}
        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition"
        aria-label="Edit Table"
      >
        <FaEdit className="h-3 w-3" />
        <span className="text-xs font-medium">Edit</span>
      </button>

      <Modal isOpen={isOpen} closeModal={closeModal}>
        <div className="p-4 bg-white rounded-lg shadow max-w-md mx-auto">
          <div className="text-center">
            <FaEdit className="text-gray-500 w-10 h-10 mb-2 mx-auto" />
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              Edit Table
            </h2>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEditTable();
            }}
            className="flex flex-col gap-4"
          >
            {/* (A) Select which area the table belongs to */}
            <div>
              <label
                htmlFor="areaDropdown"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Area
              </label>
              <select
                id="areaDropdown"
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring focus:ring-blue-200"
              >
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>

            {/* (B) Table Number */}
            <div>
              <label
                htmlFor="tableNumber"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Table Number
              </label>
              <input
                id="tableNumber"
                type="number"
                min={1}
                value={tableNumber}
                onChange={(e) => setTableNumber(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring focus:ring-blue-200"
              />
            </div>

            {/* (C) Diners */}
            <div>
              <label
                htmlFor="diners"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Diners
              </label>
              <input
                id="diners"
                type="number"
                min={1}
                value={diners}
                onChange={(e) => setDiners(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring focus:ring-blue-200"
              />
            </div>

            {/* (D) Reserved checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reserved"
                checked={reserved}
                onChange={(e) => setReserved(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-200"
              />
              <label htmlFor="reserved" className="text-sm font-medium text-gray-700">
                Reserved
              </label>
            </div>

            {/* (E) Position if needed */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position (X, Y)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="X"
                  value={position.x}
                  onChange={(e) =>
                    setPosition({ ...position, x: Number(e.target.value) })
                  }
                  className="w-1/2 px-2 py-1 border border-gray-300 rounded"
                />
                <input
                  type="number"
                  placeholder="Y"
                  value={position.y}
                  onChange={(e) =>
                    setPosition({ ...position, y: Number(e.target.value) })
                  }
                  className="w-1/2 px-2 py-1 border border-gray-300 rounded"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="py-2 px-4 text-sm font-medium text-gray-500 bg-gray-200 
                  rounded hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updating}
                className="py-2 px-4 text-sm font-medium text-white bg-blue-600 
                  rounded hover:bg-blue-700 transition disabled:bg-gray-400"
              >
                {updating ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
};

export default EditTableModal;
