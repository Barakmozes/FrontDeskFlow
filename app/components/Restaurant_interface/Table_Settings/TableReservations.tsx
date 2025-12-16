"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useQuery } from "@urql/next";
import { Table } from "@prisma/client";
import toast from "react-hot-toast";
import { FaCalendarCheck } from "react-icons/fa";
import Modal from "../../Common/Modal";

import {
  GetTableReservationsDocument,
  GetTableReservationsQuery,
  GetTableReservationsQueryVariables,
} from "@/graphql/generated";

/**
 * Props:
 *  - table: The table object, including table.id and table.tableNumber
 */
interface TableReservationsProps {
  table: Table;
}

/**
 * TableReservations
 * 
 * Shows a button to open a modal. When opened *the first time*,
 * it fetches reservations for "today" (by default) and displays them
 * if found. The user can also pick another date to fetch more data.
 */
const TableReservations: React.FC<TableReservationsProps> = ({ table }) => {
  // -- Local states --
  const todayString = new Date().toISOString().split("T")[0]; // e.g. "2025-01-10"
  const [selectedDate, setSelectedDate] = useState<string>(todayString);
  const [isOpen, setIsOpen] = useState(false);

  /**
   * We only want to fetch automatically on the *first open* of the modal.
   * Use a flag to ensure we don't re-run this logic on subsequent opens.
   */
  const [didFirstOpen, setDidFirstOpen] = useState(false);

  // GraphQL: We start paused = true (so it won't fetch on mount).
  const [resResult, reexecuteQuery] = useQuery<
    GetTableReservationsQuery,
    GetTableReservationsQueryVariables
  >({
    query: GetTableReservationsDocument,
    variables: { date: selectedDate, tableId: table.id },
    pause: true,
  });

  const { data, fetching, error } = resResult;

  /**
   * On first open, run the query once.
   * If user re-opens the modal after closing, no auto-fetch.
   */
  const openModal = useCallback(() => {
    setIsOpen(true);
    if (!didFirstOpen) {
      // On first open, load the reservations for today's date
      reexecuteQuery({ requestPolicy: "network-only" });
      setDidFirstOpen(true);
    }
  }, [didFirstOpen, reexecuteQuery]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * If user changes date inside the modal, they can re-fetch manually if desired.
   * (Below, we add a "Search" button to do that.)
   */
  const handleFetchReservations = useCallback(() => {
    reexecuteQuery({ requestPolicy: "network-only" });
  }, [reexecuteQuery]);

  // Show error if any
  useEffect(() => {
    if (error) {
      toast.error("Failed to load reservations: " + error.message);
    }
  }, [error]);

  /**
   * Format date/time in a user-friendly manner
   */
  const formatDateTime = (isoString: string) => {
    try {
      const dateObj = new Date(isoString);
      // Example: "Jan 10, 2025, 4:35 PM"
      return dateObj.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return isoString; // fallback if parsing fails
    }
  };

  /**
   * Renders the reservations in a table or an empty state message
   */
  const renderReservations = () => {
    if (fetching) {
      return (
        <p className="text-sm text-blue-500 mt-2">Loading reservations...</p>
      );
    }
    if (!data?.getTableReservations || data.getTableReservations.length === 0) {
      return (
        <p className="text-sm text-gray-500 mt-3">
          No reservations found for {selectedDate}.
        </p>
      );
    }

    return (
      <div className="overflow-x-auto mt-3">
        <table className="min-w-full text-xs sm:text-sm border border-gray-300">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-2 border border-gray-300">Reservation Time</th>
              <th className="p-2 border border-gray-300">Diners</th>
              <th className="p-2 border border-gray-300">Status</th>
              <th className="p-2 border border-gray-300">Created By</th>
              <th className="p-2 border border-gray-300">User Email</th>
              <th className="p-2 border border-gray-300">Name</th>
              <th className="p-2 border border-gray-300">Phone</th>
              <th className="p-2 border border-gray-300">Reservation ID</th>
            </tr>
          </thead>
          <tbody>
            {data.getTableReservations.map((res) => {
              const dateDisplay = formatDateTime(res.reservationTime);
              return (
                <tr key={res.id} className="hover:bg-gray-50">
                  <td className="p-2 border border-gray-300">{dateDisplay}</td>
                  <td className="p-2 border border-gray-300">
                    {res.numOfDiners}
                  </td>
                  <td className="p-2 border border-gray-300">{res.status}</td>
                  <td className="p-2 border border-gray-300">{res.createdBy}</td>
                  <td className="p-2 border border-gray-300">{res.userEmail}</td>
                  <td className="p-2 border border-gray-300">
                    {res.user?.profile?.name ?? "-"}
                  </td>
                  <td className="p-2 border border-gray-300">
                    {res.user?.profile?.phone ?? "-"}
                  </td>
                  <td className="p-2 border border-gray-300">{res.id}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      {/* The trigger button */}
      <button
        onClick={openModal}
        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition"
        aria-label="View Reservations"
      >
        <FaCalendarCheck className="h-3 w-3 ml-1 " />
        <span className="text-xs font-medium">Reservations</span>
      </button>

      {/* The modal */}
      <Modal isOpen={isOpen} closeModal={closeModal}>
        <div className="p-4 bg-white rounded-lg shadow max-w-md mx-auto">
          {/* Title */}
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
            Table #{table.tableNumber} Reservations
          </h2>

          {/* Date + Search row */}
          <div className="mt-3 flex items-center gap-2">
            <input
              type="date"
              className="px-2 py-1 border rounded text-sm"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Select date"
            />
            <button
              onClick={handleFetchReservations}
              className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition"
            >
              Search
            </button>
          </div>

          {/* Table or empty/loading state */}
          {renderReservations()}
        </div>
      </Modal>
    </>
  );
};

export default TableReservations;
