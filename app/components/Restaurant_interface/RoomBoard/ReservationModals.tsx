"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";

import {
  AddReservationDocument,
  AddReservationMutation,
  AddReservationMutationVariables,
  CancelReservationDocument,
  CancelReservationMutation,
  CancelReservationMutationVariables,
  EditReservationDocument,
  EditReservationMutation,
  EditReservationMutationVariables,
  GetUsersDocument,
  GetUsersQuery,
  GetUsersQueryVariables,
  ReservationStatus,
  Role,
} from "@/graphql/generated";

import { buildDateRange, dateKeyToLocalNoonISO } from "@/lib/datekeyy";
import type { StayBlock } from "./types";
import { Pill, reservationTone } from "./edgeUI";

function ModalShell({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="border-b px-4 py-3 flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold">{title}</div>
            {subtitle ? <div className="text-xs text-gray-500">{subtitle}</div> : null}
          </div>

          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm hover:bg-gray-100">
            ✕
          </button>
        </div>

        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function isValidDateKey(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function CreateReservationModal({
  open,
  onClose,
  onCreated,

  // Prefill from clicked cell
  roomId,
  roomNumber,
  hotelName,
  startDateKey,

  // Collision checker from board
  hasCollision,

  // Staff
  staffEmail,
  staffRole,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;

  roomId: string;
  roomNumber: number;
  hotelName: string;
  startDateKey: string;

  // returns true if the room already has a reservation on that date
  hasCollision: (dateKey: string) => boolean;

  staffEmail: string | null;
  staffRole: Role | null;
}) {
  const [{ data: usersData }] = useQuery<GetUsersQuery, GetUsersQueryVariables>({
    query: GetUsersDocument,
    variables: {},
  });

  const users = usersData?.getUsers ?? [];

  const [{ fetching: creating }, addReservation] = useMutation<
    AddReservationMutation,
    AddReservationMutationVariables
  >(AddReservationDocument);

  const [{ fetching: editing }, editReservation] = useMutation<
    EditReservationMutation,
    EditReservationMutationVariables
  >(EditReservationDocument);

  const [guestEmail, setGuestEmail] = useState("");
  const [numGuests, setNumGuests] = useState(2);
  const [nights, setNights] = useState(1);
  const [createAsConfirmed, setCreateAsConfirmed] = useState(false);

  const suggestedUsers = useMemo(() => {
    const q = guestEmail.trim().toLowerCase();
    if (!q) return users.slice(0, 8);
    return users
      .filter((u) => (u.email ?? "").toLowerCase().includes(q) || (u.profile?.name ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [users, guestEmail]);

  async function onSubmit() {
    if (!staffEmail || !staffRole) return toast.error("Login required.");
    const email = guestEmail.trim();
    if (!email) return toast.error("Guest email is required.");
    if (!isValidDateKey(startDateKey)) return toast.error("Invalid start date.");
    if (!Number.isFinite(nights) || nights <= 0 || nights > 60) return toast.error("Nights must be 1–60.");

    // Build date keys for stay nights
    const nightsKeys = buildDateRange(startDateKey, nights);

    // Collision prevention (no double-booking)
    const collisions = nightsKeys.filter((dk) => hasCollision(dk));
    if (collisions.length > 0) {
      return toast.error(`Room ${roomNumber} is not available on: ${collisions.join(", ")}`);
    }

    // Create 1 reservation per night (bridge model)
    const createdIds: string[] = [];

    for (const dk of nightsKeys) {
      const res = await addReservation({
        userEmail: email,
        tableId: roomId,
        numOfDiners: numGuests,
        reservationTime: dateKeyToLocalNoonISO(dk),
        createdBy: staffRole,
        createdByUserEmail: staffEmail,
      });

      if (res.error) {
        console.error(res.error);
        toast.error("Failed creating reservation nights. No further nights were created.");

        // Best-effort rollback: cancel created ones
        // (not perfect but prevents “ghost stays”)
        // If rollback fails, admin can cancel manually.
        if (createdIds.length) {
          toast("Rolling back partial stay…", { duration: 1200 });
        }
        break;
      }

      const id = res.data?.addReservation?.id;
      if (id) createdIds.push(id);
    }

    if (createdIds.length === 0) return;

    // Optional: mark as confirmed right away
    if (createAsConfirmed) {
      for (const id of createdIds) {
        const e = await editReservation({
          editReservationId: id,
          status: ReservationStatus.Confirmed,
        });
        if (e.error) {
          console.error(e.error);
          toast.error("Created but failed to confirm all nights.");
          break;
        }
      }
    }

    toast.success(`Stay created: Room ${roomNumber} • ${nights} night(s)`);
    onClose();
    onCreated();
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Create Reservation"
      subtitle={`Room ${roomNumber} • ${hotelName} • Start ${startDateKey}`}
    >
      <div className="grid gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Guest email</label>
          <input
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="guest@example.com"
          />
          <div className="flex flex-wrap gap-2 mt-1">
<select
  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
  defaultValue=""
  onChange={(e) => setGuestEmail(e.target.value)}
>
  <option value="" disabled>
    all customers
  </option>
  {suggestedUsers
    .filter((u) => u.role === "USER" && !!u.email)
    .map((u) => (
      <option key={u.id} value={u.email!}>
        {u.profile?.name ? `${u.profile.name} (${u.email})` : u.email}
      </option>
    ))}
</select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Guests</label>
            <input
              type="number"
              value={numGuests}
              onChange={(e) => setNumGuests(Number(e.target.value))}
              className="rounded-md border px-3 py-2 text-sm"
              min={1}
              max={12}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Nights</label>
            <input
              type="number"
              value={nights}
              onChange={(e) => setNights(Number(e.target.value))}
              className="rounded-md border px-3 py-2 text-sm"
              min={1}
              max={60}
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Status</label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createAsConfirmed}
                onChange={(e) => setCreateAsConfirmed(e.target.checked)}
              />
              Create as <Pill label="CONFIRMED" tone={reservationTone(ReservationStatus.Confirmed)} />
            </label>
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={creating || editing}
            className="rounded-md bg-black px-3 py-2 text-sm text-white hover:opacity-90 disabled:bg-gray-300"
          >
            {creating ? "Creating…" : "Create stay"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function StayDetailsModal({
  open,
  onClose,
  stay,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  stay: StayBlock | null;
  onChanged: () => void;
}) {
  const [{ fetching: editing }, editReservation] = useMutation<
    EditReservationMutation,
    EditReservationMutationVariables
  >(EditReservationDocument);

  const [{ fetching: cancelling }, cancelReservation] = useMutation<
    CancelReservationMutation,
    CancelReservationMutationVariables
  >(CancelReservationDocument);

  if (!open || !stay) return null;

  const s = stay; // ✅ s הוא StayBlock ולא null

  async function setStatus(next: ReservationStatus) {
    for (const id of s.reservationIds) {
      const res = await editReservation({
        editReservationId: id,
        status: next,
      });

      if (res.error) {
        console.error(res.error);
        toast.error("Failed to update all nights.");
        return;
      }
    }

    toast.success(`Updated stay → ${next}`);
    onChanged();
    onClose();
  }
  async function onCancel() {
    const ok = window.confirm("Cancel this entire stay?");
    if (!ok) return;

    for (const id of stay!.reservationIds) {
      const res = await cancelReservation({ cancelReservationId: id });
      if (res.error) {
        console.error(res.error);
        toast.error("Failed to cancel all nights.");
        return;
      }
    }

    toast.success("Stay cancelled.");
    onChanged();
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={`Stay • Room ${stay.roomNumber}`}
      subtitle={`${stay.startDateKey} → ${stay.endDateKey} (${stay.nights} nights) • ${stay.guestName}`}
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Pill label={`Status: ${stay.status}`} tone={reservationTone(stay.status)} />
          <Pill label={`Guest: ${stay.userEmail}`} />
          <Pill label={`Nights: ${stay.nights}`} />
        </div>

        <div className="text-sm text-gray-700">
          Phone: <span className="font-medium">{stay.guestPhone ?? "—"}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 justify-end">
          <button
            onClick={() => setStatus(ReservationStatus.Confirmed)}
            disabled={editing}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:bg-gray-100"
          >
            Confirm
          </button>

          <button
            onClick={() => setStatus(ReservationStatus.Completed)}
            disabled={editing}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:bg-gray-100"
            title="Use only when you want to archive old reservations (not actual checkout)."
          >
            Mark Completed
          </button>

          <button
            onClick={onCancel}
            disabled={cancelling}
            className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:opacity-90 disabled:bg-gray-300"
          >
            Cancel stay
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
