"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";

import {
  ReservationStatus,
  useCancelReservationMutation,
  useCompleteReservationMutation,
  useEditReservationMutation,
  useToggleTableReservationMutation,
} from "@/graphql/generated";

import { useHotelStore, type RoomInStore } from "@/lib/AreaStore";
import { dateKeyToLocalMidday, toLocalDateKey } from "./dateUtils";

import { applyHousekeepingPatch } from "@/lib/housekeepingTags";
import { useUpdateManyTablesMutation } from "@/graphql/generated";
/**
 * In this phase, we “dress” restaurant reservations with hotel language:
 * - Confirmed + Room reserved=true => “Checked-in”
 * - Completed + Room reserved=false => “Checked-out”
 *
 * Later you’ll add true hotel statuses in Prisma.
 */
export type BoardReservation = {
  id: string;
  status: ReservationStatus;
  reservationTime: string;
  numOfDiners: number;
  userEmail: string;
  user?: { profile?: { name?: string | null; phone?: string | null } | null } | null;
  tableId: string;
};

const statusBadge = (s: ReservationStatus) => {
  switch (s) {
    case ReservationStatus.Pending:
      return "bg-amber-100 text-amber-800";
    case ReservationStatus.Confirmed:
      return "bg-emerald-100 text-emerald-800";
    case ReservationStatus.Completed:
      return "bg-blue-100 text-blue-800";
    case ReservationStatus.Cancelled:
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

export default function ReservationDrawer({
  open,
  onClose,
  reservation,
  room,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  reservation: BoardReservation | null;
  room: RoomInStore | null;
  onChanged: () => void; // refetch board reservations
}) {
  const updateRoom = useHotelStore((s) => s.updateRoom);

  const [{ fetching: savingEdit }, editReservation] = useEditReservationMutation();
  const [{ fetching: canceling }, cancelReservation] = useCancelReservationMutation();
  const [{ fetching: completing }, completeReservation] = useCompleteReservationMutation();
  const [{ fetching: toggling }, toggleRoomReserved] = useToggleTableReservationMutation();

  const [editOpen, setEditOpen] = useState(false);
  const [editDateKey, setEditDateKey] = useState<string>("");
  const [editGuests, setEditGuests] = useState<number>(1);

 const [{ fetching: hkUpdating }, updateManyTables] = useUpdateManyTablesMutation();

const markRoomDirtyAfterCheckout = async () => {
  if (!room) return;

  const nextSpecialRequests = applyHousekeepingPatch(room.notes, {
    status: "DIRTY",
    inCleaningList: true,
    // lastCleanedAt stays unchanged
  });

  const r = await updateManyTables({
    updates: [{ id: room.id, specialRequests: nextSpecialRequests }],
  });

  if (r.error) {
    toast.error("Checkout completed but failed to mark room dirty.");
    return;
  }

  const updated = r.data?.updateManyTables?.[0];
  if (updated) {
    updateRoom(room.id, {
      notes: updated.specialRequests,
      isOccupied: updated.reserved,
      updatedAt: new Date().toISOString(),
    });
  }
};


  const guestName = reservation?.user?.profile?.name || reservation?.userEmail || "-";
  const guestPhone = reservation?.user?.profile?.phone || "";

  const localDateKey = useMemo(() => {
    if (!reservation) return "";
    return toLocalDateKey(reservation.reservationTime);
  }, [reservation]);

  if (!open) return null;

  const canMutate = !!reservation;

  const safeClose = () => {
    setEditOpen(false);
    onClose();
  };

  const doConfirm = async () => {
    if (!reservation) return;

    const res = await editReservation({
      editReservationId: reservation.id,
      status: ReservationStatus.Confirmed,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to confirm booking.");
      return;
    }
    toast.success("Booking confirmed.");
    onChanged();
  };

  const doCancel = async () => {
    if (!reservation) return;

    const res = await cancelReservation({ cancelReservationId: reservation.id });
    if (res.error) {
      console.error(res.error);
      toast.error("Failed to cancel booking.");
      return;
    }
    toast.success("Booking cancelled.");
    onChanged();
  };

  const doComplete = async () => {
    if (!reservation) return;

    const res = await completeReservation({ completeReservationId: reservation.id });
    if (res.error) {
      console.error(res.error);
      toast.error("Failed to complete booking.");
      return;
    }
    toast.success("Booking completed.");
    onChanged();
  };

  /**
   * “Check-in” in this phase:
   * - set room reserved=true
   * - set reservation status=CONFIRMED
   */
  const doCheckIn = async () => {
    if (!reservation || !room) return;

    const r1 = await toggleRoomReserved({
      toggleTableReservationId: room.id,
      reserved: true,
    });
    if (r1.error) {
      console.error(r1.error);
      toast.error("Failed to mark room occupied.");
      return;
    }

    updateRoom(room.id, { isOccupied: true, updatedAt: new Date().toISOString() });

    const r2 = await editReservation({
      editReservationId: reservation.id,
      status: ReservationStatus.Confirmed,
    });
    if (r2.error) {
      console.error(r2.error);
      toast.error("Room marked occupied, but failed to confirm booking.");
      return;
    }

    toast.success("Checked-in (mapped to Confirmed + Occupied).");
    onChanged();
  };

  /**
   * “Check-out” in this phase:
   * - set reservation status=COMPLETED
   * - set room reserved=false
   *
   * Later (real hotel): check-out should also create cleaning task, etc.
   */
  const doCheckOut = async () => {
    if (!reservation || !room) return;

    const r1 = await completeReservation({ completeReservationId: reservation.id });
    if (r1.error) {
      console.error(r1.error);
      toast.error("Failed to complete booking.");
      return;
    }

    const r2 = await toggleRoomReserved({
      toggleTableReservationId: room.id,
      reserved: false,
    });
    if (r2.error) {
      console.error(r2.error);
      toast.error("Booking completed, but failed to mark room vacant.");
      return;
    }

    updateRoom(room.id, { isOccupied: false, updatedAt: new Date().toISOString() });

      // housekeeping tagging (DIRTY)
  await markRoomDirtyAfterCheckout();

    toast.success("Checked-out (mapped to Completed + Vacant).");
    onChanged();
  };

  const openEdit = () => {
    if (!reservation) return;
    setEditDateKey(toLocalDateKey(reservation.reservationTime));
    setEditGuests(reservation.numOfDiners);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!reservation) return;
    if (!editDateKey) {
      toast.error("Date is required.");
      return;
    }
    if (editGuests < 1) {
      toast.error("Guests must be at least 1.");
      return;
    }

    const res = await editReservation({
      editReservationId: reservation.id,
      reservationTime: dateKeyToLocalMidday(editDateKey),
      numOfDiners: editGuests,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to update booking.");
      return;
    }

    toast.success("Booking updated.");
    setEditOpen(false);
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={safeClose} />

      {/* drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl p-4 overflow-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Booking / Guest</p>
            <p className="text-xs text-gray-500">
              Room {room?.roomNumber ?? "-"} • {localDateKey || "-"}
            </p>
          </div>

          <button onClick={safeClose} className="text-sm text-gray-600 hover:text-gray-900">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Status</span>
            <span className={`text-[11px] px-2 py-1 rounded-full ${statusBadge(reservation?.status ?? ReservationStatus.Pending)}`}>
              {reservation?.status ?? "-"}
            </span>
          </div>

          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Guest</p>
            <p className="text-sm font-medium text-gray-900">{guestName}</p>
            {guestPhone ? <p className="text-xs text-gray-600">{guestPhone}</p> : null}
            <p className="text-xs text-gray-600 mt-1">{reservation?.userEmail ?? ""}</p>
          </div>

          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Booking</p>
            <p className="text-sm text-gray-900">
              Guests: <span className="font-medium">{reservation?.numOfDiners ?? "-"}</span>
            </p>
            <p className="text-xs text-gray-600">
              Date: <span className="font-medium">{localDateKey || "-"}</span>
            </p>
          </div>

          {/* actions */}
            {reservation ? (
    <Link
      href={`/dashboard/folio/${reservation.id}`}
      className="text-xs px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-center"
    >
      Folio
    </Link>
  ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={doConfirm}
              disabled={!canMutate || savingEdit}
              className="text-xs px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300"
            >
              Confirm
            </button>

            <button
              onClick={openEdit}
              disabled={!canMutate}
              className="text-xs px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-950 disabled:bg-gray-300"
            >
              Edit
            </button>

            <button
              onClick={doCheckIn}
              disabled={!canMutate || !room || toggling || savingEdit}
              className="text-xs px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
              title="Maps to room occupied + reservation confirmed"
            >
              Check-in
            </button>

            <button
              onClick={doCheckOut}
              disabled={!canMutate || !room || toggling || completing}
              className="text-xs px-3 py-2 rounded-lg bg-blue-800 text-white hover:bg-blue-900 disabled:bg-gray-300"
              title="Maps to reservation completed + room vacant"
            >
              Check-out
            </button>

            <button
              onClick={doCancel}
              disabled={!canMutate || canceling}
              className="text-xs px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:bg-gray-300"
            >
              Cancel
            </button>

            <button
              onClick={doComplete}
              disabled={!canMutate || completing}
              className="text-xs px-3 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-800 disabled:bg-gray-300"
            >
              Complete
            </button>
          </div>

          {/* inline edit section */}
          {editOpen ? (
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-800">Edit booking</p>

              <div>
                <label className="block text-xs text-gray-600">Date</label>
                <input
                  type="date"
                  value={editDateKey}
                  onChange={(e) => setEditDateKey(e.target.value)}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600">Guests</label>
                <input
                  type="number"
                  min={1}
                  value={editGuests}
                  onChange={(e) => setEditGuests(Number(e.target.value))}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditOpen(false)}
                  className="text-xs px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="text-xs px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300"
                >
                  {savingEdit ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
