"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";
import { useClient } from "urql";

import Modal from "@/app/components/Common/Modal";

import {
  GetUsersDocument,
  type GetUsersQuery,
  type GetUsersQueryVariables,

  GetTablesDocument,
  type GetTablesQuery,
  type GetTablesQueryVariables,

  GetAreasDocument,
  type GetAreasQuery,
  type GetAreasQueryVariables,

  GetReservationsDocument,
  type GetReservationsQuery,
  type GetReservationsQueryVariables,

  AddReservationDocument,
  type AddReservationMutation,
  type AddReservationMutationVariables,

  EditReservationDocument,
  type EditReservationMutation,
  type EditReservationMutationVariables,

  ToggleTableReservationDocument,
  type ToggleTableReservationMutation,
  type ToggleTableReservationMutationVariables,

  ReservationStatus,
  Role,
} from "@/graphql/generated";

import { todayLocalDateKey } from "@/lib/stayGrouping";
import { parseHousekeepingTags, deriveRoomStatus } from "@/lib/housekeepingTags";

import { ensureNightlyRoomCharges } from "@/lib/folioRoomCharges";
import { parseHotelSettings } from "@/lib/hotelSettingsTags";
import { parseRoomRateTags, getEffectiveNightlyRate } from "@/lib/roomRateTags";

type Step = "GUEST" | "STAY" | "CONFIRM";

/* ------------------------------ Date helpers ------------------------------ */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function buildDateRange(startDateKey: string, nights: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < Math.max(1, nights); i++) out.push(addDaysToDateKey(startDateKey, i));
  return out;
}

function dateKeyToLocalNoonISO(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  return dt.toISOString();
}

function toLocalDateKey(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/* ------------------------------------------------------------------------- */

export default function WalkInWizardModal({
  open,
  onClose,
  staffEmail,
  staffRole,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  staffEmail: string | null;
  staffRole: Role | null;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const client = useClient();

  const todayKey = useMemo(() => todayLocalDateKey(), []);

  // ---------- Step state ----------
  const [step, setStep] = useState<Step>("GUEST");

  // ---------- Inputs ----------
  const [guestQuery, setGuestQuery] = useState("");
  const [selectedGuestEmail, setSelectedGuestEmail] = useState<string>("");

  const [startDateKey, setStartDateKey] = useState<string>(todayKey);
  const [nights, setNights] = useState<number>(1);
  const [guests, setGuests] = useState<number>(2);

  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [checkInNow, setCheckInNow] = useState<boolean>(true);

  // If start date isn't today, disallow immediate check-in (keeps rules consistent)
  useEffect(() => {
    if (startDateKey !== todayKey && checkInNow) setCheckInNow(false);
  }, [startDateKey, todayKey, checkInNow]);

  // ---------- Data ----------
  const [{ data: usersData }] = useQuery<GetUsersQuery, GetUsersQueryVariables>({
    query: GetUsersDocument,
    variables: {},
    pause: !open,
  });

  const [{ data: hotelsData }] = useQuery<GetAreasQuery, GetAreasQueryVariables>({
    query: GetAreasDocument,
    variables: {},
    pause: !open,
  });

  const [{ data: roomsData }] = useQuery<GetTablesQuery, GetTablesQueryVariables>({
    query: GetTablesDocument,
    variables: {},
    pause: !open,
  });

  const [{ data: resData }, refetchReservations] = useQuery<
    GetReservationsQuery,
    GetReservationsQueryVariables
  >({
    query: GetReservationsDocument,
    variables: {},
    pause: !open,
  });

  const users = usersData?.getUsers ?? [];
  const hotels = hotelsData?.getAreas ?? [];
  const rooms = roomsData?.getTables ?? [];
  const reservations = resData?.getReservations ?? [];

  // ---------- Mutations ----------
  const [{ fetching: creating }, addReservation] = useMutation<
    AddReservationMutation,
    AddReservationMutationVariables
  >(AddReservationDocument);

  const [{ fetching: editing }, editReservation] = useMutation<
    EditReservationMutation,
    EditReservationMutationVariables
  >(EditReservationDocument);

  const [{ fetching: toggling }, toggleRoom] = useMutation<
    ToggleTableReservationMutation,
    ToggleTableReservationMutationVariables
  >(ToggleTableReservationDocument);

  // ---------- Guest search ----------
  const suggestedGuests = useMemo(() => {
    const q = guestQuery.trim().toLowerCase();
    if (!q) return users.slice(0, 8);

    return users
      .filter((u) => {
        const email = (u.email ?? "").toLowerCase();
        const name = (u.profile?.name ?? "").toLowerCase();
        const phone = (u.profile?.phone ?? "").toLowerCase();
        return email.includes(q) || name.includes(q) || phone.includes(q);
      })
      .slice(0, 10);
  }, [users, guestQuery]);

  // ---------- Availability ----------
  const requestedDateKeys = useMemo(() => buildDateRange(startDateKey, nights), [startDateKey, nights]);

  const roomHasCollision = (roomId: string) => {
    return reservations.some((r) => {
      if (r.tableId !== roomId) return false;
      if (r.status === ReservationStatus.Cancelled) return false;

      const dk = toLocalDateKey(r.reservationTime);
      return dk && requestedDateKeys.includes(dk);
    });
  };

  const availableRooms = useMemo(() => {
    return rooms
      .filter((room) => !roomHasCollision(room.id))
      .filter((room) => (checkInNow ? room.reserved === false : true));
  }, [rooms, reservations, requestedDateKeys.join("|"), checkInNow]);

  // ---------- Actions ----------
  async function createStay() {
    if (!staffEmail || !staffRole) return toast.error("Login required.");
    if (!selectedGuestEmail) return toast.error("Select a guest first.");
    if (!selectedRoomId) return toast.error("Select a room.");
    if (nights < 1) return toast.error("Nights must be at least 1.");

    if (roomHasCollision(selectedRoomId)) {
      return toast.error("Selected room is not available for that date range.");
    }

    const room = rooms.find((r) => r.id === selectedRoomId) ?? null;
    if (!room) return toast.error("Room not found.");

    if (checkInNow) {
      if (startDateKey !== todayKey) return toast.error("Check-in now is only allowed for today.");
      if (room.reserved) return toast.error("Room is already occupied.");

      const { hk } = parseHousekeepingTags(room.specialRequests);
      const derived = deriveRoomStatus(room.reserved, hk);
      const canOverride = staffRole === Role.Admin || staffRole === Role.Manager;

      if (derived !== "VACANT_CLEAN" && !canOverride) {
        return toast.error("Room is not READY (vacant clean). Manager/Admin override required.");
      }
    }

    const createdNights: Array<{ reservationId: string; dateKey: string }> = [];

    // Create one reservation per night
    for (const dk of requestedDateKeys) {
      const res = await addReservation({
        userEmail: selectedGuestEmail,
        tableId: selectedRoomId,
        numOfDiners: guests,
        reservationTime: dateKeyToLocalNoonISO(dk),
        createdBy: staffRole,
        createdByUserEmail: staffEmail,
      });

      if (res.error) {
        console.error(res.error);
        toast.error("Failed creating the stay (partial nights may exist).");
        break;
      }

      const id = res.data?.addReservation?.id;
      if (id) createdNights.push({ reservationId: id, dateKey: dk });
    }

    if (!createdNights.length) return;

    // Optional immediate check-in
    if (checkInNow) {
      // occupy room
      const t = await toggleRoom({ toggleTableReservationId: selectedRoomId, reserved: true });
      if (t.error) {
        console.error(t.error);
        toast.error("Stay created, but failed to mark room occupied.");
      }

      // confirm all nights
      for (const night of createdNights) {
        const e = await editReservation({
          editReservationId: night.reservationId,
          status: ReservationStatus.Confirmed,
        });
        if (e.error) {
          console.error(e.error);
          toast.error("Stay created, but failed to confirm all nights.");
          break;
        }
      }

      // auto-post charges if enabled
      const hotel = hotels.find((h) => h.id === room.areaId) ?? null;
      if (hotel) {
        const hotelSettings = parseHotelSettings(hotel.description ?? "").settings;
        const roomRate = parseRoomRateTags(room.specialRequests).rate;
        const nightlyRate = getEffectiveNightlyRate(
          hotelSettings.baseNightlyRate,
          roomRate.overrideNightlyRate
        );

        if (hotelSettings.autoPostRoomCharges) {
          if (!nightlyRate || nightlyRate <= 0) {
            toast.error("Stay created, but nightly rate is not set. Set it in Settings.");
          } else {
            try {
              await ensureNightlyRoomCharges({
                client,
                tableId: selectedRoomId,
                hotelId: room.areaId,
                roomNumber: room.tableNumber,
                guestEmail: selectedGuestEmail,
                guestName: users.find((u) => u.email === selectedGuestEmail)?.profile?.name ?? selectedGuestEmail,
                nightlyRate,
                currency: hotelSettings.currency,
                nights: createdNights,
              });
            } catch (err) {
              console.error(err);
              toast.error("Stay created, but room charges failed to post. Open folio and try again.");
            }
          }
        }
      }
    }

    toast.success(`Walk-in stay created (${createdNights.length} night(s))`);
    refetchReservations({ requestPolicy: "network-only" });
    onCreated?.();

    // Deep link to Room Board
    router.push(`/dashboard/room-board?roomId=${selectedRoomId}&dateKey=${startDateKey}`);

    // Reset wizard state (optional but clean)
    setStep("GUEST");
    setGuestQuery("");
    setSelectedGuestEmail("");
    setSelectedRoomId("");

    onClose();
  }

  return (
    <Modal isOpen={open} title="Walk‑in Wizard" closeModal={onClose}>
      {/* Stepper */}
      <div className="flex gap-2 text-xs mb-4">
        {(["GUEST", "STAY", "CONFIRM"] as Step[]).map((s) => (
          <span
            key={s}
            className={`px-2 py-1 rounded-full border ${step === s ? "bg-black text-white" : "bg-white"}`}
          >
            {s}
          </span>
        ))}
      </div>

      {step === "GUEST" ? (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Search guest</label>
            <input
              value={guestQuery}
              onChange={(e) => setGuestQuery(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Email / name / phone"
            />
          </div>

          <div className="grid gap-2">
            {suggestedGuests.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setSelectedGuestEmail(u.email ?? "");
                  setStep("STAY");
                }}
                className="rounded-md border px-3 py-2 text-left hover:bg-gray-50"
              >
                <div className="text-sm font-medium">{u.profile?.name ?? u.email}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
              </button>
            ))}
          </div>

          <div className="text-xs text-gray-500">
            Not found? Use <span className="font-semibold">Register Customer</span> then search again.
          </div>
        </div>
      ) : null}

      {step === "STAY" ? (
        <div className="grid gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Start date</label>
              <input
                type="date"
                value={startDateKey}
                onChange={(e) => setStartDateKey(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Nights</label>
              <input
                type="number"
                min={1}
                max={60}
                value={nights}
                onChange={(e) => setNights(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Guests</label>
              <input
                type="number"
                min={1}
                max={12}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Room (available only)</label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white"
            >
              <option value="">Select room…</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.tableNumber}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500 mt-1">
              Availability is checked by collisions against nightly reservations (same conventions as Room Board).
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checkInNow}
              onChange={(e) => setCheckInNow(e.target.checked)}
              disabled={startDateKey !== todayKey}
            />
            Check‑in immediately (occupy room + confirm all nights)
          </label>

          {startDateKey !== todayKey ? (
            <div className="text-xs text-amber-700">
              Check‑in now is disabled because the stay does not start today.
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setStep("GUEST")}>
              Back
            </button>
            <button
              className="rounded-md bg-black text-white px-3 py-2 text-sm hover:opacity-90 disabled:bg-gray-300"
              onClick={() => setStep("CONFIRM")}
              disabled={!selectedRoomId}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {step === "CONFIRM" ? (
        <div className="space-y-3">
          <div className="rounded-lg border bg-slate-50 p-3 text-sm">
            <div><span className="font-semibold">Guest:</span> {selectedGuestEmail || "—"}</div>
            <div><span className="font-semibold">Start:</span> {startDateKey}</div>
            <div><span className="font-semibold">Nights:</span> {nights}</div>
            <div><span className="font-semibold">Guests:</span> {guests}</div>
            <div><span className="font-semibold">Check‑in now:</span> {checkInNow ? "Yes" : "No"}</div>
          </div>

          <div className="flex justify-end gap-2">
            <button className="rounded-md border px-3 py-2 text-sm" onClick={() => setStep("STAY")}>
              Back
            </button>
            <button
              className="rounded-md bg-emerald-600 text-white px-3 py-2 text-sm hover:bg-emerald-700 disabled:bg-gray-300"
              onClick={createStay}
              disabled={creating || editing || toggling}
            >
              {creating ? "Creating…" : "Create Walk‑in Stay"}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
