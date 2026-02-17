"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation } from "@urql/next";
import gql from "graphql-tag";

import { Role, ReservationStatus } from "@/graphql/generated";
import type { RoomInStore } from "@/lib/AreaStore";

/**
 * IMPORTANT:
 * Backend model is Reservation(reservationTime, numOfDiners, userEmail, tableId).
 * For hotel logic in Step-1 we treat:
 * - reservationTime => "check-in date" (day-level board)
 * - numOfDiners => "number of guests"
 *
 * Multi-night stays (check-in / check-out) come later when we evolve Prisma schema.
 */

const AddReservationDocument = gql`
  mutation AddReservation(
    $userEmail: String!
    $tableId: String!
    $reservationTime: DateTime!
    $numOfDiners: Int!
    $createdBy: Role!
    $createdByUserEmail: String
  ) {
    addReservation(
      userEmail: $userEmail
      tableId: $tableId
      reservationTime: $reservationTime
      numOfDiners: $numOfDiners
      createdBy: $createdBy
      createdByUserEmail: $createdByUserEmail
    ) {
      id
      status
      reservationTime
      tableId
      userEmail
    }
  }
`;

type AddReservationMutation = {
  addReservation: {
    id: string;
    status: ReservationStatus;
    reservationTime: string;
    tableId: string;
    userEmail: string;
  };
};

type AddReservationVariables = {
  userEmail: string;
  tableId: string;
  reservationTime: Date; // DateTime scalar accepts ISO string; Date is serialized to ISO by JSON.stringify
  numOfDiners: number;
  createdBy: Role;
  createdByUserEmail?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;

  room: RoomInStore | null;
  dateKey: string; // YYYY-MM-DD

  // Used to prevent obvious client-side double-booking.
  existingReservationsForDate: { id: string }[];

  onCreated?: () => void; // call to refetch board reservations
};

const dateKeyToSafeMiddayUtc = (dateKey: string) => {
  // Midday UTC avoids timezone shifting the day around midnight
  // when staff are in a non-UTC timezone.
  return new Date(`${dateKey}T12:00:00.000Z`);
};

export default function AddReservationModal({
  open,
  onClose,
  room,
  dateKey,
  existingReservationsForDate,
  onCreated,
}: Props) {
  const [{ fetching }, addReservation] = useMutation<AddReservationMutation, AddReservationVariables>(
    AddReservationDocument
  );

  const [guestEmail, setGuestEmail] = useState("");
  const [guests, setGuests] = useState<number>(1);

  const isDoubleBooked = useMemo(() => {
    // For Step-1: if any reservation exists for same room/date, block creation.
    // Later you’ll allow multiple reservations per day only if room-type allocation rules permit.
    return existingReservationsForDate.length > 0;
  }, [existingReservationsForDate.length]);

  if (!open) return null;

  const roomLabel = room ? `Room ${room.roomNumber}` : "Room";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!room) {
      toast.error("No room selected.");
      return;
    }
    if (!guestEmail.trim()) {
      toast.error("Guest email is required.");
      return;
    }
    if (guests < 1) {
      toast.error("Guests must be at least 1.");
      return;
    }
    if (isDoubleBooked) {
      toast.error("This room already has a booking for the selected date.");
      return;
    }

    const reservationTime = dateKeyToSafeMiddayUtc(dateKey);

    const res = await addReservation({
      userEmail: guestEmail.trim(),
      tableId: room.id,
      reservationTime,
      numOfDiners: guests,
      // Until you add hotel roles, map reception to MANAGER for now
      createdBy: Role.Manager,
      createdByUserEmail: null,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to create booking.");
      return;
    }

    toast.success(`Booking created for ${roomLabel} on ${dateKey}`);
    setGuestEmail("");
    setGuests(1);
    onClose();
    onCreated?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">New Booking</p>
            <p className="text-xs text-gray-500">
              {roomLabel} • {dateKey}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-3">
          {isDoubleBooked ? (
            <div className="rounded-md bg-amber-50 text-amber-800 text-xs p-2">
              This room already has a booking on this date. Choose another room/date.
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-medium text-gray-700">Guest Email</label>
            <input
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="guest@example.com"
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">Guests</label>
            <input
              type="number"
              min={1}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={fetching || !room || isDoubleBooked}
              className={[
                "text-sm px-3 py-2 rounded-md text-white",
                fetching || !room || isDoubleBooked
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700",
              ].join(" ")}
            >
              {fetching ? "Creating…" : "Create Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
