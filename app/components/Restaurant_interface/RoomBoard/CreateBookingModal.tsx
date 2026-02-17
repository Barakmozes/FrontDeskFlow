"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";

import { Role, useAddReservationMutation } from "@/graphql/generated";
import type { RoomInStore } from "@/lib/AreaStore";
import { dateKeyToLocalMidday } from "./dateUtils";

/**
 * Hotel “Create booking” = backend addReservation.
 * For now it is a ONE-DAY booking (reservationTime).
 * Multi-night stays come later when backend adds check-in/out range.
 */
export default function CreateBookingModal({
  open,
  onClose,
  room,
  dateKey,
  existingForCell,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  room: RoomInStore | null;
  dateKey: string | null;
  existingForCell: { id: string }[]; // used to prevent double-book
  onCreated: () => void;
}) {
  const [{ fetching }, addReservation] = useAddReservationMutation();

  const [guestEmail, setGuestEmail] = useState("");
  const [guests, setGuests] = useState(1);

  const isBlocked = useMemo(() => {
    // Strict no double-booking per room/day in this phase.
    return existingForCell.length > 0;
  }, [existingForCell.length]);

  if (!open) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!room || !dateKey) {
      toast.error("Missing room/date.");
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
    if (isBlocked) {
      toast.error("This room already has a booking on this date.");
      return;
    }

    const reservationTime = dateKeyToLocalMidday(dateKey);

    const res = await addReservation({
      userEmail: guestEmail.trim(),
      tableId: room.id,
      reservationTime,
      numOfDiners: guests,

      // Backend requires createdBy (Role enum from Prisma).
      // Until hotel roles exist, map reception/FD to MANAGER.
      createdBy: Role.Manager,
      createdByUserEmail: null,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to create booking.");
      return;
    }

    toast.success(`Booking created for Room ${room.roomNumber} on ${dateKey}`);
    setGuestEmail("");
    setGuests(1);
    onClose();
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">New Booking</p>
            <p className="text-xs text-gray-500">
              Room {room?.roomNumber ?? "-"} • {dateKey ?? "-"}
            </p>
          </div>

          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900">
            ✕
          </button>
        </div>

        <form onSubmit={handleCreate} className="px-4 py-4 space-y-3">
          {isBlocked ? (
            <div className="rounded-md bg-amber-50 text-amber-800 text-xs p-2">
              This cell is already booked. Pick another room/date.
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-medium text-gray-700">Guest Email</label>
            <input
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              placeholder="guest@example.com"
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
              disabled={fetching || !room || !dateKey || isBlocked}
              className={[
                "text-sm px-3 py-2 rounded-md text-white",
                fetching || !room || !dateKey || isBlocked
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
