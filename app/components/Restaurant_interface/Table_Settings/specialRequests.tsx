"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "@urql/next";
import toast from "react-hot-toast";

import {
  EditTableDocument,
  EditTableMutation,
  EditTableMutationVariables,
  GetTablesDocument,
} from "@/graphql/generated";
import { Table } from "@prisma/client";

/**
 * SpecialRequestsProps:
 *  - table: The Table object that has:
 *      - .id (string)
 *      - .specialRequests (string[])
 */
interface SpecialRequestsProps {
  table: Table;
}

/**
 * SpecialRequests
 * - Manages ONLY the `specialRequests` field for a specific table.
 * - Provides UI to add/remove requests, then save them to the DB.
 */
const SpecialRequests: React.FC<SpecialRequestsProps> = ({ table }) => {
  // 1) Local array of requests, initially from table.specialRequests
  const [localRequests, setLocalRequests] = useState<string[]>(
    table.specialRequests || []
  );
  // 2) Local input state for the new request
  const [newRequest, setNewRequest] = useState("");

  // GraphQL partial update: reusing `editTable` for specialRequests
  const [{ fetching: isUpdating }, editTable] = useMutation<
    EditTableMutation,
    EditTableMutationVariables
  >(EditTableDocument);

  // Optionally re-fetch the main table list so everything is in sync
  const [{}, reexecuteTables] = useQuery({
    query: GetTablesDocument,
    pause: true,
  });

  /**
   * Handle adding a new request to the local list
   */
  const handleAddRequest = () => {
    const trimmed = newRequest.trim();
    if (!trimmed) return; // ignore empty
    setLocalRequests((prev) => [...prev, trimmed]);
    setNewRequest(""); // clear the input
  };

  /**
   * Remove a request by index
   */
  const handleRemoveRequest = (index: number) => {
    setLocalRequests((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Save the updated requests to DB (partial update of `editTable`)
   */
  const handleSaveRequests = async () => {
    try {
      const result = await editTable({
        editTableId: table.id, // table's ID is required
        specialRequests: localRequests,
      });

      if (result.data?.editTable) {
        toast.success("Special requests updated!", { duration: 1200 });
        // Re-fetch or skip if not needed
        reexecuteTables({ requestPolicy: "network-only" });
      } else if (result.error) {
        toast.error(
          "Failed to update requests: " + result.error.message,
          { duration: 3000 }
        );
      }
    } catch (err) {
      console.error("Error updating special requests:", err);
      toast.error("Unexpected error updating special requests.");
    }
  };

  return (
    <div className="mt-2 max-w-xs">
      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-700 mb-1">
        Special Requests
      </h3>

      {/* Current requests list (scrollable if large) */}
      <ul className="mb-2 space-y-1 text-xs sm:text-sm max-h-36 overflow-y-auto">
        {localRequests.map((req, index) => (
          <li
            key={index}
            className="flex items-center justify-between bg-gray-100 px-2 py-1 rounded"
          >
            <span className="flex-1 break-words pr-2">{req}</span>
            <button
              onClick={() => handleRemoveRequest(index)}
              className="text-red-500 hover:text-red-700 text-sm"
              aria-label="Remove request"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {/* Input + "Add" button */}
      <div className="flex items-center gap-1 ">
        <input
          type="text"
          value={newRequest}
          onChange={(e) => setNewRequest(e.target.value)}
          placeholder="Add a new request..."
          className=" w-11/12 px-1 py-1 sm:py-2 text-xs sm:text-sm rounded border  "
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddRequest();
            }
          }}
          aria-label="New special request"
        />
        <button
          onClick={handleAddRequest}
          className="text-sm bg-blue-500 text-white px-1 py-1  rounded hover:bg-blue-600 transition min-w-max "
          aria-label="Add request"
        >
         Add
        </button>
      </div>

      {/* Save Requests button */}
      
      <button
        onClick={handleSaveRequests}
        disabled={isUpdating}
        className={` mt-2 w-full py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded 
          ${
            isUpdating
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }
        `}
        aria-label="Save special requests"
      >
        {isUpdating ? "Updating..." : "Save Requests"}
      </button>
  
    </div>
  );
};

export default SpecialRequests;
