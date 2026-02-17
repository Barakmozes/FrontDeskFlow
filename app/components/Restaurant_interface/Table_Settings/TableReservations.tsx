"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@urql/next";

import Modal from "../../Common/Modal";

import {
  GetTableReservationsDocument,
  GetTableReservationsQuery,
  GetTableReservationsQueryVariables,
} from "@/graphql/generated";

import type { RoomInStore } from "@/lib/AreaStore";

interface RoomBookingsProps {
  room: RoomInStore;
}

/**
 * RoomBookings
 * NOTE: This is still backed by the existing restaurant reservation model.
 * Client-side mapping only:
 *  - TableReservation -> RoomBooking (for now)
 */
const RoomBookings: React.FC<RoomBookingsProps> = ({ room }) => {
  const [isOpen, setIsOpen] = useState(false);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [date, setDate] = useState<string>(today);

  const [{ data, fetching, error }, reexecuteQuery] = useQuery<
    GetTableReservationsQuery,
    GetTableReservationsQueryVariables
  >({
    query: GetTableReservationsDocument,
    variables: { date, tableId: room.id },
    pause: !isOpen,
  });

  // Re-fetch whenever modal opens or date changes.
  useEffect(() => {
    if (!isOpen) return;
    reexecuteQuery({ requestPolicy: "network-only" });
  }, [isOpen, date, reexecuteQuery]);

  const bookings = data?.getTableReservations ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-sm bg-gray-200 text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-300 transition"
        aria-label="View bookings"
      >
        View Bookings
      </button>

      <Modal
        isOpen={isOpen}
        closeModal={() => setIsOpen(false)}
        title={`Room ${room.roomNumber} — Bookings`}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="booking-date">
              Date
            </label>
            <input
              id="booking-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>

          {fetching ? (
            <p className="text-sm text-gray-500">Loading bookings…</p>
          ) : error ? (
            <p className="text-sm text-red-600">Error: {error.message}</p>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-gray-500">No bookings found for this date.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 border text-left">Time</th>
                    <th className="px-2 py-1 border text-left">Guests</th>
                    <th className="px-2 py-1 border text-left">Status</th>
                    <th className="px-2 py-1 border text-left">Guest</th>
                    <th className="px-2 py-1 border text-left">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="px-2 py-1 border">{b.reservationTime}</td>
                      <td className="px-2 py-1 border">{b.numOfDiners}</td>
                      <td className="px-2 py-1 border">{b.status}</td>
                      <td className="px-2 py-1 border">
                        {b.user?.profile?.name ?? b.userEmail ?? "—"}
                      </td>
                      <td className="px-2 py-1 border">
                        {b.user?.profile?.phone ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default RoomBookings;
