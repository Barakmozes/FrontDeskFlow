"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";
import { useClient } from "urql";

import Modal from "@/app/components/Common/Modal";
import TasksPanel from "@/app/components/Restaurant_interface/Tasks/TasksPanel";
import WalkInWizardModal from "./WalkInWizardModal";

import {
  // Queries
  GetAreasDocument,
  type GetAreasQuery,
  type GetAreasQueryVariables,
  GetTablesDocument,
  type GetTablesQuery,
  type GetTablesQueryVariables,
  GetReservationsDocument,
  type GetReservationsQuery,
  type GetReservationsQueryVariables,
  GetUserDocument,
  type GetUserQuery,
  type GetUserQueryVariables,

  // Mutations
  ToggleTableReservationDocument,
  type ToggleTableReservationMutation,
  type ToggleTableReservationMutationVariables,
  EditReservationDocument,
  type EditReservationMutation,
  type EditReservationMutationVariables,
  CancelReservationDocument,
  type CancelReservationMutation,
  type CancelReservationMutationVariables,
  CompleteReservationDocument,
  type CompleteReservationMutation,
  type CompleteReservationMutationVariables,
  UpdateManyTablesDocument,
  type UpdateManyTablesMutation,
  type UpdateManyTablesMutationVariables,

  // Enums
  ReservationStatus,
  Role,
} from "@/graphql/generated";

import {
  coversDateKey,
  folioReservationIdForDateKey,
  groupReservationsIntoStays,
  isStayCheckedIn,
  sumStayGuests,
  todayLocalDateKey,
  type StayBlock,
} from "@/lib/stayGrouping";

import {
  applyHousekeepingPatch,
  deriveRoomStatus,
  parseHousekeepingTags,
  type HKStatus,
} from "@/lib/housekeepingTags";

import { ensureNightlyRoomCharges } from "@/lib/folioRoomCharges";
import { parseHotelSettings } from "@/lib/hotelSettingsTags";
import { parseRoomRateTags, getEffectiveNightlyRate } from "@/lib/roomRateTags";

import ToggleOccupancy from "@/app/components/Restaurant_interface/Table_Settings/ToggleReservation";
import { tableRowToRoomInStore } from "@/lib/AreaStore";

/* ----------------------- Hotel settings tags constants ---------------------- */
const TAG_BREAKFAST = "HOURS_BREAKFAST";
const TAG_RESTAURANT = "HOURS_RESTAURANT";
const TAG_ROOM_SERVICE = "HOURS_ROOM_SERVICE";

/* --------------------------------- Helpers -------------------------------- */

function fmtMoney(amount: number, currency: string) {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  const code = (currency || "USD").toUpperCase();

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${safe.toFixed(2)} ${code}`;
  }
}

function pickTag(tags: Record<string, string>, key: string): string | null {
  const v = (tags?.[key] ?? "").trim();
  return v.length ? v : null;
}

function normalizeRole(role: unknown): string {
  return String(role ?? "").trim().toUpperCase();
}

/* ------------------------------- Small UI bits ------------------------------ */

function Badge({
  label,
  tone = "gray",
}: {
  label: string;
  tone?: "gray" | "green" | "amber" | "blue" | "red";
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : tone === "blue"
      ? "bg-blue-100 text-blue-800"
      : tone === "red"
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-800";

  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] ${cls}`}>{label}</span>;
}

function HkBadge({ status }: { status: HKStatus }) {
  const tone =
    status === "CLEAN"
      ? "green"
      : status === "DIRTY"
      ? "amber"
      : status === "MAINTENANCE"
      ? "blue"
      : "red";
  return <Badge label={status} tone={tone} />;
}

function ResStatusBadge({ status }: { status: ReservationStatus }) {
  const tone =
    status === ReservationStatus.Confirmed
      ? "green"
      : status === ReservationStatus.Pending
      ? "amber"
      : status === ReservationStatus.Completed
      ? "blue"
      : "gray";

  return <Badge label={String(status)} tone={tone} />;
}

function KpiCard({
  title,
  value,
  subtitle,
  onClick,
  hint,
}: {
  title: string;
  value: string;
  subtitle?: string;
  onClick?: () => void;
  hint?: string;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={hint}
        className="rounded-xl border bg-white p-4 shadow-sm text-left hover:bg-gray-50 transition"
      >
        <div className="text-xs text-gray-500">{title}</div>
        <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
        {subtitle ? <div className="text-xs text-gray-600 mt-1">{subtitle}</div> : null}
      </button>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      {subtitle ? <div className="text-xs text-gray-600 mt-1">{subtitle}</div> : null}
    </div>
  );
}

function CardShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-gray-500">{subtitle}</div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm ${
        active ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ----------------------------- Details Modal ------------------------------- */

type HotelInfo = {
  id: string;
  name: string;

  currency: string;
  baseNightlyRate: number;
  autoPostRoomCharges: boolean;

  breakfast: string | null;
  restaurant: string | null;
  roomService: string | null;

  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
};

function StayDetailsModal({
  open,
  onClose,
  stay,
  hotelInfo,
  selectedDateKey,
  todayKey,
  canOverride,
  canQuickCheckout,
  roomReservedNow,
  roomSpecialRequests,
  onCheckIn,
  onCheckOut,
  onCancelStay,
}: {
  open: boolean;
  onClose: () => void;
  stay: StayBlock | null;
  hotelInfo: HotelInfo | null;

  selectedDateKey: string;
  todayKey: string;

  canOverride: boolean;
  canQuickCheckout: boolean;

  /** ✅ IMPORTANT: use rooms query as source of truth (not stay.tableReservedNow snapshot) */
  roomReservedNow: boolean;

  /** ✅ Use up-to-date room tags if available */
  roomSpecialRequests: string[];

  onCheckIn: (stay: StayBlock) => void;
  onCheckOut: (stay: StayBlock) => void;
  onCancelStay: (stay: StayBlock) => void;
}) {
  if (!open || !stay) return null;

  const isToday = selectedDateKey === todayKey;

  const checkedIn = isStayCheckedIn(stay);
  const isArrivingToday = stay.startDateKey === todayKey;
  const isFutureArrival = stay.startDateKey > todayKey;

  const effectiveSpecialRequests = Array.isArray(roomSpecialRequests)
    ? roomSpecialRequests
    : stay.specialRequests ?? [];

  const { hk, notes } = parseHousekeepingTags(effectiveSpecialRequests);
  const roomStatus = deriveRoomStatus(roomReservedNow, hk);

  // Folio selection
  const folioDateKey = coversDateKey(stay, selectedDateKey) ? selectedDateKey : stay.startDateKey;
  const folioId = folioReservationIdForDateKey(stay, folioDateKey);

  const currency = hotelInfo?.currency ?? "USD";
  const baseRate = hotelInfo?.baseNightlyRate ?? 0;
  const overrideRate = parseRoomRateTags(effectiveSpecialRequests).rate.overrideNightlyRate ?? null;
  const effectiveRate = getEffectiveNightlyRate(baseRate, overrideRate);

  const checkInBlockedReason = (() => {
    if (!isToday) return "Actions disabled in planning mode.";
    if (!isArrivingToday) return `Check‑in allowed only on arrival day (${stay.startDateKey}).`;
    if (checkedIn) return "Already checked in.";
    if (roomReservedNow) return "Room is currently OCCUPIED. Check‑out current guest first.";
    if (roomStatus !== "VACANT_CLEAN" && !canOverride)
      return "Room is not READY (VACANT_CLEAN). Manager/Admin override required.";
    return null;
  })();

  return (
    <Modal isOpen={open} title={`Stay • Room ${stay.roomNumber}`} closeModal={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs text-gray-600">Hotel</div>
          <div className="text-sm font-semibold text-gray-900">{hotelInfo?.name ?? "Hotel"}</div>

          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <ResStatusBadge status={stay.status} />
            <HkBadge status={hk.status} />
            <Badge
              label={roomStatus.replaceAll("_", " ")}
              tone={roomStatus === "OCCUPIED" ? "red" : "gray"}
            />
            {checkedIn ? (
              <Badge label="CHECKED‑IN" tone="green" />
            ) : (
              <Badge label="NOT CHECKED‑IN" tone="amber" />
            )}
            <Badge label={`${stay.startDateKey} → ${stay.endDateKey}`} />
            <Badge label={`${stay.nights} night${stay.nights === 1 ? "" : "s"}`} />
            <Badge label={`${stay.guests} guest${stay.guests === 1 ? "" : "s"}`} />
            {isFutureArrival ? <Badge label="FUTURE ARRIVAL" tone="blue" /> : null}
          </div>

          {notes.length ? (
            <div className="mt-2 text-xs text-gray-600">
              Notes:{" "}
              <span className="text-gray-800">{notes.slice(0, 2).join(" • ")}</span>
              {notes.length > 2 ? (
                <span className="text-gray-500"> • +{notes.length - 2} more</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {hotelInfo ? (
          <div className="rounded-lg border p-3">
            <div className="text-xs text-gray-600">Hotel settings (from Settings)</div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="text-sm">
                <div className="text-[11px] text-gray-500">Base nightly rate</div>
                <div className="font-semibold text-gray-900">
                  {hotelInfo.baseNightlyRate > 0
                    ? fmtMoney(hotelInfo.baseNightlyRate, currency)
                    : "Not set"}
                </div>
              </div>

              <div className="text-sm">
                <div className="text-[11px] text-gray-500">Effective room rate</div>
                <div className="font-semibold text-gray-900">
                  {effectiveRate > 0 ? fmtMoney(effectiveRate, currency) : "Not set"}
                  {overrideRate != null ? (
                    <span className="text-xs text-gray-500"> (override)</span>
                  ) : null}
                </div>
              </div>

              <div className="text-sm">
                <div className="text-[11px] text-gray-500">Auto-post room charges</div>
                <div className="font-semibold text-gray-900">
                  {hotelInfo.autoPostRoomCharges ? "ON" : "OFF"}
                </div>
              </div>

              <div className="text-sm">
                <div className="text-[11px] text-gray-500">Rooms today</div>
                <div className="font-semibold text-gray-900">
                  {hotelInfo.occupiedRooms} occupied • {hotelInfo.availableRooms} available (total{" "}
                  {hotelInfo.totalRooms})
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
              <div className="rounded-md border bg-white p-2">
                <div className="text-[11px] text-gray-500">Breakfast</div>
                <div className="font-medium text-gray-900">{hotelInfo.breakfast ?? "—"}</div>
              </div>
              <div className="rounded-md border bg-white p-2">
                <div className="text-[11px] text-gray-500">Restaurant</div>
                <div className="font-medium text-gray-900">{hotelInfo.restaurant ?? "—"}</div>
              </div>
              <div className="rounded-md border bg-white p-2">
                <div className="text-[11px] text-gray-500">Room service</div>
                <div className="font-medium text-gray-900">{hotelInfo.roomService ?? "—"}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border p-3">
          <div className="text-xs text-gray-600">Guest</div>
          <div className="text-sm font-semibold text-gray-900">{stay.guestName}</div>
          <div className="text-xs text-gray-700 mt-1">
            Email:{" "}
            <a className="text-blue-700 hover:underline" href={`mailto:${stay.userEmail}`}>
              {stay.userEmail}
            </a>
          </div>
          {stay.guestPhone ? (
            <div className="text-xs text-gray-700">
              Phone:{" "}
              <a className="text-blue-700 hover:underline" href={`tel:${stay.guestPhone}`}>
                {stay.guestPhone}
              </a>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={`/dashboard/folio/${folioId}`}
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Open folio
          </Link>

          {!isToday ? (
            <div className="text-xs text-amber-700 px-2 py-2">
              Actions disabled (planning mode). Switch date to today to operate.
            </div>
          ) : null}

          {isToday && !checkedIn ? (
            <>
              {checkInBlockedReason ? (
                <div className="text-xs text-amber-700 px-2 py-2">{checkInBlockedReason}</div>
              ) : null}

              <button
                onClick={() => onCheckIn(stay)}
                disabled={!!checkInBlockedReason}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:bg-gray-300"
                title={checkInBlockedReason ?? "Confirm stay + occupy room"}
              >
                Check‑in
              </button>
            </>
          ) : null}

          {isToday && checkedIn && roomReservedNow ? (
            canQuickCheckout ? (
              <button
                onClick={() => onCheckOut(stay)}
                className="rounded-md bg-blue-800 px-4 py-2 text-sm text-white hover:bg-blue-900"
                title="Quick check-out (will mark room DIRTY + add to cleaning list)"
              >
                Quick check‑out
              </button>
            ) : (
              <Link
                href={`/dashboard/folio/${folioId}`}
                className="rounded-md bg-blue-800 px-4 py-2 text-sm text-white hover:bg-blue-900"
                title="Checkout via folio"
              >
                Checkout via folio
              </Link>
            )
          ) : null}

          <button
            onClick={() => onCancelStay(stay)}
            className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            title="Cancels all nights in this stay"
          >
            Cancel stay
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------- Main page -------------------------------- */

type Tab = "ARRIVALS" | "IN_HOUSE" | "DEPARTURES" | "FUTURE" | "SEARCH_ALL";

const isActiveStay = (s: StayBlock) =>
  s.status === ReservationStatus.Pending || s.status === ReservationStatus.Confirmed;

export default function ReceptionClient({ staffEmail }: { staffEmail: string | null }) {
  const client = useClient();

  // ✅ keep “today” fresh (prevents stale view if user leaves page open)
  const [todayKey, setTodayKey] = useState(() => todayLocalDateKey());
  useEffect(() => {
    const t = setInterval(() => setTodayKey(todayLocalDateKey()), 60_000);
    return () => clearInterval(t);
  }, []);

  const [dateKey, setDateKey] = useState<string>(todayKey);
  const [hotelFilterId, setHotelFilterId] = useState<string>("ALL");
  const [tab, setTab] = useState<Tab>("ARRIVALS");
  const [search, setSearch] = useState("");

  const [openStay, setOpenStay] = useState<StayBlock | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  // Prevent “flash” in Unlinked Occupied while we are checking-in a room
  const [checkingInRoomIds, setCheckingInRoomIds] = useState<Set<string>>(() => new Set());

  // Who am I?
  const [{ data: meData }] = useQuery<GetUserQuery, GetUserQueryVariables>({
    query: GetUserDocument,
    variables: staffEmail ? { email: staffEmail } : ({} as any),
    pause: !staffEmail,
    requestPolicy: "cache-and-network",
  });

  const myRole = meData?.getUser?.role ?? null;

  // ✅ Role logic (robust to enum/string)
  const myRoleKey = useMemo(() => normalizeRole(myRole), [myRole]);
  const canOverride = myRoleKey === "ADMIN" || myRoleKey === "MANAGER";
  const canQuickCheckout = canOverride;

  const canView = useMemo(() => {
    // Adjust as needed when roles migrate.
    // Using string compare avoids compile errors if enum grows.
    return (
      myRoleKey === "ADMIN" ||
      myRoleKey === "MANAGER" ||
      myRoleKey === "WAITER" ||
      myRoleKey === "RECEPTION"
    );
  }, [myRoleKey]);

  const [noPermToastShown, setNoPermToastShown] = useState(false);
  useEffect(() => {
    if (!noPermToastShown && staffEmail && myRole && !canView) {
      toast.error("You do not have permission to view reception.");
      setNoPermToastShown(true);
    }
  }, [noPermToastShown, staffEmail, myRole, canView]);

  // Hotels
  const [{ data: hotelsData, fetching: hotelsFetching, error: hotelsError }] = useQuery<
    GetAreasQuery,
    GetAreasQueryVariables
  >({
    query: GetAreasDocument,
    variables: {},
    requestPolicy: "cache-and-network",
  });

  const hotels = useMemo(() => {
    const list = hotelsData?.getAreas ?? [];
    return [...list].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }, [hotelsData?.getAreas]);

  // Rooms
  const [{ data: roomsData, fetching: roomsFetching, error: roomsError }, refetchRooms] = useQuery<
    GetTablesQuery,
    GetTablesQueryVariables
  >({
    query: GetTablesDocument,
    variables: {},
    requestPolicy: "cache-and-network",
  });

  const rooms = roomsData?.getTables ?? [];

  // Reservations
  const [{ data: resData, fetching: resFetching, error: resError }, refetchReservations] = useQuery<
    GetReservationsQuery,
    GetReservationsQueryVariables
  >({
    query: GetReservationsDocument,
    variables: {},
    requestPolicy: "cache-and-network",
  });

  const reservations = resData?.getReservations ?? [];

  // Mutations
  const [{ fetching: toggling }, toggleRoomOccupied] = useMutation<
    ToggleTableReservationMutation,
    ToggleTableReservationMutationVariables
  >(ToggleTableReservationDocument);

  const [{ fetching: editing }, editReservation] = useMutation<
    EditReservationMutation,
    EditReservationMutationVariables
  >(EditReservationDocument);

  const [{ fetching: cancelling }, cancelReservation] = useMutation<
    CancelReservationMutation,
    CancelReservationMutationVariables
  >(CancelReservationDocument);

  const [{ fetching: completing }, completeReservation] = useMutation<
    CompleteReservationMutation,
    CompleteReservationMutationVariables
  >(CompleteReservationDocument);

  const [{ fetching: updatingTables }, updateManyTables] = useMutation<
    UpdateManyTablesMutation,
    UpdateManyTablesMutationVariables
  >(UpdateManyTablesDocument);

  const isToday = dateKey === todayKey;

  const hotelNameById = useMemo(() => {
    const map = new Map<string, string>();
    hotels.forEach((h) => map.set(h.id, h.name));
    return map;
  }, [hotels]);

  const roomsById = useMemo(() => {
    const map = new Map<string, (typeof rooms)[number]>();
    rooms.forEach((r) => map.set(r.id, r));
    return map;
  }, [rooms]);

  const inHotel = useCallback(
    (hid: string) => hotelFilterId === "ALL" || hotelFilterId === hid,
    [hotelFilterId]
  );

  // ✅ Single source of truth: stay grouping
  const staysAll = useMemo(() => groupReservationsIntoStays(reservations), [reservations]);

  const staysFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return staysAll.filter((s) => {
      if (!inHotel(s.hotelId)) return false;
      if (!q) return true;

      const room = String(s.roomNumber);
      const name = (s.guestName ?? "").toLowerCase();
      const email = (s.userEmail ?? "").toLowerCase();
      const phone = (s.guestPhone ?? "").toLowerCase();

      return room.includes(q) || name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [staysAll, inHotel, search]);

  // ✅ Resolve openStay to freshest object after refresh
  const openStayResolved = useMemo(() => {
    if (!openStay) return null;
    return staysAll.find((s) => s.stayId === openStay.stayId) ?? openStay;
  }, [openStay, staysAll]);

  /**
   * ✅ ARRIVALS:
   * Show stays arriving on dateKey until they are CHECKED‑IN.
   * Do NOT hide arrivals just because the ROOM is currently occupied (reserved).
   */
  const arrivals = useMemo(() => {
    return staysFiltered
      .filter((s) => s.startDateKey === dateKey)
      .filter((s) => s.status !== ReservationStatus.Cancelled)
      .filter((s) => isActiveStay(s))
      .filter((s) => !isStayCheckedIn(s))
      .sort((a, b) => a.roomNumber - b.roomNumber);
  }, [staysFiltered, dateKey]);

  const departures = useMemo(() => {
    return staysFiltered
      .filter((s) => s.status !== ReservationStatus.Cancelled)
      .filter((s) => s.endDateKey === dateKey)
      .sort((a, b) => a.roomNumber - b.roomNumber);
  }, [staysFiltered, dateKey]);

  /**
   * ✅ IN‑HOUSE:
   * Today: show only stays that cover today AND are CHECKED‑IN.
   * Planning mode: show projected occupancy (covers dateKey).
   */
  const inHouse = useMemo(() => {
    return staysFiltered
      .filter((s) => s.status !== ReservationStatus.Cancelled)
      .filter((s) => coversDateKey(s, dateKey))
      .filter((s) => (isToday ? isStayCheckedIn(s) : true))
      .sort((a, b) => a.roomNumber - b.roomNumber);
  }, [staysFiltered, dateKey, isToday]);

  const futureStays = useMemo(() => {
    return staysFiltered
      .filter((s) => isActiveStay(s))
      .filter((s) => s.startDateKey > dateKey)
      .slice()
      .sort((a, b) => {
        if (a.startDateKey !== b.startDateKey) return a.startDateKey.localeCompare(b.startDateKey);
        if (a.hotelId !== b.hotelId) return a.hotelId.localeCompare(b.hotelId);
        return a.roomNumber - b.roomNumber;
      });
  }, [staysFiltered, dateKey]);

  const futureTotals = useMemo(() => {
    const roomNights = futureStays.reduce((acc, s) => acc + (s.nights || 0), 0);
    const guests = sumStayGuests(futureStays);
    return { roomNights, guests };
  }, [futureStays]);

  /**
   * ✅ FIXED: Unlinked occupied rooms
   *
   * We **must not** use `inHouse` as the sole reference because it can be stale
   * right after a mutation and because `inHouse` is a view, not “truth”.
   *
   * Source of truth for occupancy: `rooms` (Tables) query.
   * Source of truth for check‑in: `isStayCheckedIn(stay)` + `coversDateKey(stay, dateKey)`.
   */
  const checkedInRoomIdsForDate = useMemo(() => {
    const set = new Set<string>();

    for (const s of staysFiltered) {
      if (!isActiveStay(s)) continue;
      if (!coversDateKey(s, dateKey)) continue;
      if (!isStayCheckedIn(s)) continue;

      const room = roomsById.get(s.roomId);
      if (room?.reserved) set.add(s.roomId);
    }

    return set;
  }, [staysFiltered, dateKey, roomsById]);

  const unlinkedOccupied = useMemo(() => {
    const occupiedRooms = rooms.filter(
      (r) => r.reserved && (hotelFilterId === "ALL" || hotelFilterId === r.areaId)
    );

    return occupiedRooms
      .filter((r) => !checkingInRoomIds.has(r.id)) // prevent “flash” during check-in
      .filter((r) => !checkedInRoomIdsForDate.has(r.id))
      .sort((a, b) => a.tableNumber - b.tableNumber);
  }, [rooms, hotelFilterId, checkingInRoomIds, checkedInRoomIdsForDate]);

  const readiness = useMemo(() => {
    const relevantRooms = rooms.filter((r) => inHotel(r.areaId));
    const counts: Record<string, number> = {
      VACANT_CLEAN: 0,
      VACANT_DIRTY: 0,
      MAINTENANCE: 0,
      OUT_OF_ORDER: 0,
      OCCUPIED: 0,
    };

    const blockers: { roomNumber: number; hotelId: string; hk: HKStatus; derived: string }[] = [];

    for (const room of relevantRooms) {
      const { hk } = parseHousekeepingTags(room.specialRequests);
      const derived = deriveRoomStatus(room.reserved, hk);
      counts[derived] = (counts[derived] ?? 0) + 1;

      if (!room.reserved && derived !== "VACANT_CLEAN") {
        blockers.push({
          roomNumber: room.tableNumber,
          hotelId: room.areaId,
          hk: hk.status,
          derived,
        });
      }
    }

    blockers.sort((a, b) => a.roomNumber - b.roomNumber);
    return { counts, blockers };
  }, [rooms, inHotel]);

  const isLoading = hotelsFetching || roomsFetching || resFetching;
  const anyError = hotelsError || roomsError || resError;

  const totals = useMemo(() => {
    return {
      arrivalsGuests: sumStayGuests(arrivals),
      inHouseGuests: sumStayGuests(inHouse),
      departuresGuests: sumStayGuests(departures),
    };
  }, [arrivals, inHouse, departures]);

  const listForTab: StayBlock[] =
    tab === "ARRIVALS"
      ? arrivals
      : tab === "IN_HOUSE"
      ? inHouse
      : tab === "DEPARTURES"
      ? departures
      : tab === "FUTURE"
      ? futureStays
      : staysFiltered;

  const refreshAll = useCallback(() => {
    refetchReservations({ requestPolicy: "network-only" });
    refetchRooms({ requestPolicy: "network-only" });
  }, [refetchReservations, refetchRooms]);

  /* ---------------- Hotel settings meta (per hotel) ---------------- */

  const hotelInfoById = useMemo(() => {
    const map = new Map<string, HotelInfo>();

    for (const h of hotels) {
      const parsed = parseHotelSettings(h.description ?? "");
      const tags = parsed.tags ?? {};
      const settings = parsed.settings ?? ({} as any);

      const hotelRooms = rooms.filter((r) => r.areaId === h.id);
      const totalRooms = hotelRooms.length;
      const occupiedRooms = hotelRooms.filter((r) => r.reserved).length;
      const availableRooms = totalRooms - occupiedRooms;

      const currency = String(settings.currency ?? "USD").toUpperCase();
      const baseNightlyRate = Number(settings.baseNightlyRate ?? 0);
      const autoPostRoomCharges = Boolean(settings.autoPostRoomCharges);

      map.set(h.id, {
        id: h.id,
        name: h.name,
        currency,
        baseNightlyRate,
        autoPostRoomCharges,
        breakfast: pickTag(tags, TAG_BREAKFAST),
        restaurant: pickTag(tags, TAG_RESTAURANT),
        roomService: pickTag(tags, TAG_ROOM_SERVICE),
        totalRooms,
        occupiedRooms,
        availableRooms,
      });
    }

    return map;
  }, [hotels, rooms]);

  const hotelInfoRows = useMemo(() => {
    const all = hotels
      .map((h) => hotelInfoById.get(h.id))
      .filter(Boolean) as HotelInfo[];

    const filtered =
      hotelFilterId === "ALL" ? all : all.filter((x) => x.id === hotelFilterId);

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [hotels, hotelInfoById, hotelFilterId]);

  const openStayHotelInfo = useMemo(() => {
    if (!openStayResolved) return null;
    return hotelInfoById.get(openStayResolved.hotelId) ?? null;
  }, [openStayResolved, hotelInfoById]);

  /* ------------------------------- Actions -------------------------------- */

  const checkInStay = useCallback(
    async (stay: StayBlock) => {
      if (!staffEmail) return toast.error("Login required.");
      if (!isToday) return toast.error("Check-in is only allowed for today.");
      if (stay.startDateKey !== todayKey) return toast.error("This stay is not arriving today.");
      if (isStayCheckedIn(stay)) return toast.error("This stay is already checked in.");

      const room = roomsById.get(stay.roomId);
      if (!room) return toast.error("Room not found.");
      if (room.reserved) return toast.error("Room is already occupied.");

      const { hk } = parseHousekeepingTags(room.specialRequests);
      const derived = deriveRoomStatus(room.reserved, hk);

      if (derived !== "VACANT_CLEAN" && !canOverride) {
        toast.error("Room is not READY (vacant clean). Manager/Admin override required.");
        return;
      }

      // Prevent “unlinked occupied” flash while we operate
      setCheckingInRoomIds((prev) => {
        const next = new Set(prev);
        next.add(room.id);
        return next;
      });

      try {
        // 1) mark room occupied
        const t = await toggleRoomOccupied({
          toggleTableReservationId: room.id,
          reserved: true,
        });

        if (t.error) {
          console.error(t.error);
          toast.error("Failed to mark room occupied.");
          return;
        }

        // 2) confirm all nights (true “check‑in” signal)
        let confirmedOk = true;

        for (const r of stay.reservations) {
          if (
            r.status === ReservationStatus.Cancelled ||
            r.status === ReservationStatus.Completed
          )
            continue;

          if (r.status === ReservationStatus.Confirmed) continue;

          const e = await editReservation({
            editReservationId: r.id,
            status: ReservationStatus.Confirmed,
          });

          if (e.error) {
            console.error(e.error);
            confirmedOk = false;
            toast.error("Room occupied, but failed to confirm all nights.");
            break;
          }
        }

        // 3) auto-post nightly room charges (only if enabled + check-in succeeded)
        const hotelInfo = hotelInfoById.get(stay.hotelId) ?? null;

        if (confirmedOk && hotelInfo?.autoPostRoomCharges) {
          const override =
            parseRoomRateTags(room.specialRequests).rate.overrideNightlyRate ?? null;
          const nightlyRate = getEffectiveNightlyRate(hotelInfo.baseNightlyRate, override);

          if (!nightlyRate || nightlyRate <= 0) {
            toast.error("Checked-in, but nightly rate is not set. Set it in Settings.");
          } else {
            try {
              const result = await ensureNightlyRoomCharges({
                client,
                tableId: stay.roomId,
                hotelId: stay.hotelId,
                roomNumber: stay.roomNumber,
                guestEmail: stay.userEmail,
                guestName: stay.guestName,
                nightlyRate,
                currency: hotelInfo.currency,
                nights: stay.nightsList,
              });

              if (result.created > 0) {
                toast.success(
                  `Room charges posted: ${result.created} night${result.created === 1 ? "" : "s"}`
                );
              }
            } catch (err) {
              console.error(err);
              toast.error("Checked-in, but room charges failed to post. Open folio and try again.");
            }
          }
        }

        toast.success(`Checked-in: Room ${room.tableNumber}`);
        setOpenStay(null);
        refreshAll();
      } finally {
        setCheckingInRoomIds((prev) => {
          const next = new Set(prev);
          next.delete(stay.roomId);
          return next;
        });
      }
    },
    [
      staffEmail,
      isToday,
      todayKey,
      roomsById,
      canOverride,
      toggleRoomOccupied,
      editReservation,
      hotelInfoById,
      client,
      refreshAll,
    ]
  );

  const cancelStay = useCallback(
    async (stay: StayBlock) => {
      const ok = window.confirm("Cancel this entire stay (all nights)?");
      if (!ok) return;

      for (const id of stay.reservationIds) {
        const res = await cancelReservation({ cancelReservationId: id });
        if (res.error) {
          console.error(res.error);
          toast.error("Failed to cancel all nights.");
          return;
        }
      }

      toast.success("Stay cancelled.");
      setOpenStay(null);
      refreshAll();
    },
    [cancelReservation, refreshAll]
  );

  const quickCheckOutStay = useCallback(
    async (stay: StayBlock) => {
      if (!staffEmail) return toast.error("Login required.");
      if (!isToday) return toast.error("Check-out is only allowed for today.");

      if (!canQuickCheckout) {
        toast.error("Quick check-out requires Manager/Admin. Use folio checkout.");
        return;
      }

      const room = roomsById.get(stay.roomId);
      if (!room) return toast.error("Room not found.");
      if (!room.reserved) return toast.error("Room is already vacant.");

      // 1) complete reservations
      for (const r of stay.reservations) {
        if (r.status === ReservationStatus.Cancelled || r.status === ReservationStatus.Completed)
          continue;

        const c = await completeReservation({ completeReservationId: r.id });
        if (c.error) {
          console.error(c.error);
          toast.error("Failed to complete all nights.");
          return;
        }
      }

      // 2) release room
      const t = await toggleRoomOccupied({
        toggleTableReservationId: room.id,
        reserved: false,
      });

      if (t.error) {
        console.error(t.error);
        toast.error("Completed stay, but failed to release room.");
        return;
      }

      // 3) mark DIRTY + cleaning list
      const nextSpecialRequests = applyHousekeepingPatch(room.specialRequests, {
        status: "DIRTY",
        inCleaningList: true,
      });

      const u = await updateManyTables({
        updates: [{ id: room.id, specialRequests: nextSpecialRequests }],
      });

      if (u.error) {
        console.error(u.error);
        toast.error("Checked-out, but failed to mark room DIRTY.");
        return;
      }

      toast.success(`Checked-out: Room ${room.tableNumber} marked DIRTY`);
      setOpenStay(null);
      refreshAll();
    },
    [
      staffEmail,
      isToday,
      canQuickCheckout,
      roomsById,
      completeReservation,
      toggleRoomOccupied,
      updateManyTables,
      refreshAll,
    ]
  );

  /* -------------------------------- Render -------------------------------- */

  if (!staffEmail) {
    return (
      <div className="px-6 py-6 bg-gray-50 min-h-screen">
        <div className="rounded-xl border bg-white p-4 text-sm text-gray-700 shadow-sm">
          Please sign in to view reception.
        </div>
      </div>
    );
  }

  if (myRole && !canView) {
    return (
      <div className="px-6 py-6 bg-gray-50 min-h-screen">
        <div className="rounded-xl border bg-white p-4 text-sm text-gray-700 shadow-sm">
          You do not have permission to view this page.
        </div>
      </div>
    );
  }

  // Prepare up-to-date room info for the modal
  const modalRoom = openStayResolved ? roomsById.get(openStayResolved.roomId) : null;
  const modalRoomReservedNow = Boolean(modalRoom?.reserved ?? openStayResolved?.tableReservedNow);
  const modalRoomSpecialRequests = (modalRoom?.specialRequests ??
    openStayResolved?.specialRequests ??
    []) as string[];

  return (
    <div className="px-6 py-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="rounded-2xl border bg-white shadow-sm p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">Reception • Daily Ops</h1>
              {myRole ? <Badge label={`Role: ${myRole}`} /> : <Badge label="Role: —" />}
            </div>

            <p className="text-sm text-gray-600 mt-1">
              Arrivals / Departures / In‑house — stays are grouped to prevent duplication and keep Ops consistent.
            </p>

            {dateKey !== todayKey ? (
              <p className="text-xs text-amber-700 mt-1">
                Planning mode for <b>{dateKey}</b>. Operational actions are disabled.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Date</span>
              <input
                type="date"
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>

            <select
              value={hotelFilterId}
              onChange={(e) => setHotelFilterId(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm bg-white"
              title="Hotel filter"
            >
              <option value="ALL">All hotels</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              placeholder="Search room / guest / email / phone…"
            />

            <button
              onClick={refreshAll}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              disabled={isLoading}
            >
              Refresh
            </button>

            <button
              onClick={() => setWalkInOpen(true)}
              className="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm hover:bg-gray-950"
              title="Create a walk-in stay (multi-night) using the nightly reservation model"
            >
              Walk‑in Wizard
            </button>
          </div>
        </div>

        {anyError ? (
          <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm p-3">
            Error: {anyError.message}
          </div>
        ) : null}

        {isLoading ? <div className="mt-3 text-sm text-gray-500">Loading…</div> : null}
      </div>

      {/* KPIs */}
      <div className="grid gap-3 mt-4 md:grid-cols-5">
        <KpiCard title="Arrivals" value={`${arrivals.length}`} subtitle={`${totals.arrivalsGuests} guests`} />
        <KpiCard title="In‑house" value={`${inHouse.length}`} subtitle={`${totals.inHouseGuests} guests`} />
        <KpiCard title="Departures" value={`${departures.length}`} subtitle={`${totals.departuresGuests} guests`} />
        <KpiCard
          title="Rooms ready"
          value={`${readiness.counts.VACANT_CLEAN ?? 0}`}
          subtitle={`${readiness.counts.VACANT_DIRTY ?? 0} dirty • ${readiness.counts.MAINTENANCE ?? 0} maint • ${
            readiness.counts.OUT_OF_ORDER ?? 0
          } OOO`}
        />
        <KpiCard
          title="Future reservations"
          value={`${futureStays.length}`}
          subtitle={`${futureTotals.guests} guests • ${futureTotals.roomNights} room‑nights`}
          onClick={() => setTab("FUTURE")}
          hint={`Shows stays starting after ${dateKey}. Click to open Future list.`}
        />
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        <TabButton active={tab === "ARRIVALS"} onClick={() => setTab("ARRIVALS")}>
          Arrivals
        </TabButton>
        <TabButton active={tab === "IN_HOUSE"} onClick={() => setTab("IN_HOUSE")}>
          In‑house
        </TabButton>
        <TabButton active={tab === "DEPARTURES"} onClick={() => setTab("DEPARTURES")}>
          Departures
        </TabButton>
        <TabButton active={tab === "FUTURE"} onClick={() => setTab("FUTURE")}>
          Future ({futureStays.length})
        </TabButton>
        <TabButton active={tab === "SEARCH_ALL"} onClick={() => setTab("SEARCH_ALL")}>
          All stays
        </TabButton>

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          <span>Mutations:</span>
          <Badge label={toggling ? "Room toggle…" : "Room toggle"} tone={toggling ? "amber" : "gray"} />
          <Badge label={editing ? "Editing…" : "Editing"} tone={editing ? "amber" : "gray"} />
          <Badge label={cancelling ? "Cancelling…" : "Cancelling"} tone={cancelling ? "amber" : "gray"} />
          <Badge label={completing ? "Completing…" : "Completing"} tone={completing ? "amber" : "gray"} />
          <Badge label={updatingTables ? "Updating…" : "Updating"} tone={updatingTables ? "amber" : "gray"} />
        </div>
      </div>

      {/* Main grid */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Stays list */}
        <div className="lg:col-span-2 space-y-4">
          <CardShell
            title={
              tab === "ARRIVALS"
                ? "Arrivals (Check‑in button when NOT checked‑in)"
                : tab === "IN_HOUSE"
                ? "In‑house"
                : tab === "DEPARTURES"
                ? "Departures"
                : tab === "FUTURE"
                ? "Future reservations"
                : "All stays"
            }
            subtitle={
              tab === "FUTURE"
                ? `Stays starting after ${dateKey}. Showing ${listForTab.length} stay(s).`
                : `Showing ${listForTab.length} stay(s).`
            }
          >
            {listForTab.length === 0 ? (
              <div className="text-sm text-gray-500">No stays found for this view.</div>
            ) : (
              <div className="grid gap-2">
                {listForTab.map((s) => {
                  // ✅ Use rooms query as source of truth when available
                  const room = roomsById.get(s.roomId) ?? null;
                  const reservedNow = Boolean(room?.reserved ?? s.tableReservedNow);
                  const specialRequests = (room?.specialRequests ?? s.specialRequests ?? []) as string[];

                  const { hk } = parseHousekeepingTags(specialRequests);
                  const derived = deriveRoomStatus(reservedNow, hk);

                  const info = hotelInfoById.get(s.hotelId) ?? null;
                  const currency = info?.currency ?? "USD";
                  const base = info?.baseNightlyRate ?? 0;
                  const override = parseRoomRateTags(specialRequests).rate.overrideNightlyRate ?? null;
                  const effRate = getEffectiveNightlyRate(base, override);

                  const hotelName = info?.name ?? hotelNameById.get(s.hotelId) ?? "Hotel";

                  const folioDateKey = coversDateKey(s, dateKey) ? dateKey : s.startDateKey;
                  const folioId = folioReservationIdForDateKey(s, folioDateKey);

                  const checkedIn = isStayCheckedIn(s);

                  // ✅ “Inline check-in” in Arrivals
                  const showInlineCheckIn = tab === "ARRIVALS" && isToday && s.startDateKey === todayKey && !checkedIn;

                  const inlineCheckInDisabled =
                    !staffEmail ||
                    toggling ||
                    editing ||
                    checkingInRoomIds.has(s.roomId) ||
                    // cannot check in if room is physically occupied
                    reservedNow ||
                    // readiness requires override if not VACANT_CLEAN
                    (derived !== "VACANT_CLEAN" && !canOverride);

                  const inlineCheckInHint = !staffEmail
                    ? "Login required"
                    : reservedNow
                    ? "Room is OCCUPIED. Check‑out current guest first."
                    : derived !== "VACANT_CLEAN" && !canOverride
                    ? "Room not READY (VACANT_CLEAN). Manager/Admin override required."
                    : "Check‑in: occupy room + set reservations to Confirmed + post room charges (if enabled).";

                  return (
                    <div
                      key={s.stayId}
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenStay(s)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenStay(s);
                        }
                      }}
                      className="w-full rounded-lg border bg-white p-3 text-left hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-gray-900">
                              Room {s.roomNumber} • {s.guestName}
                            </div>

                            <ResStatusBadge status={s.status} />
                            <HkBadge status={hk.status} />

                            <Badge
                              label={derived.replaceAll("_", " ")}
                              tone={derived === "OCCUPIED" ? "red" : derived === "VACANT_CLEAN" ? "green" : "amber"}
                            />

                            {checkedIn ? (
                              <Badge label="CHECKED‑IN" tone="green" />
                            ) : (
                              <Badge label="NOT CHECKED‑IN" tone="amber" />
                            )}

                            {effRate > 0 ? (
                              <Badge label={`Rate: ${fmtMoney(effRate, currency)}`} tone="gray" />
                            ) : (
                              <Badge label="Rate: Not set" tone="amber" />
                            )}
                          </div>

                          <div className="mt-1 text-xs text-gray-600">
                            {hotelName} • {s.startDateKey} → {s.endDateKey} • {s.nights} night(s) • {s.guests} guest(s)
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {showInlineCheckIn ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                checkInStay(s);
                              }}
                              disabled={inlineCheckInDisabled}
                              title={inlineCheckInHint}
                              className="rounded-md bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-700 disabled:bg-gray-300"
                            >
                              Check‑in
                            </button>
                          ) : null}

                          <Link
                            href={`/dashboard/folio/${folioId}`}
                            className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open folio
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardShell>

          {/* Unlinked occupied rooms */}
          <CardShell
            title="Occupied rooms without an in‑house checked‑in stay"
            subtitle="Rooms are OCCUPIED, but no checked‑in stay matches this operational date. Release the room and you will see new bookings."
          >
            {unlinkedOccupied.length === 0 ? (
              <div className="text-sm text-gray-500">None ✅</div>
            ) : (
              <div className="grid gap-2">
                {unlinkedOccupied.map((r) => {
                  const { hk } = parseHousekeepingTags(r.specialRequests);
                  const derived = deriveRoomStatus(r.reserved, hk);

                  return (
                    <div key={r.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">Room {r.tableNumber}</div>

                        <ToggleOccupancy
                          room={tableRowToRoomInStore(r)}
                          // ✅ MUST refetch rooms + reservations to keep stays consistent
                          onChanged={refreshAll}
                        />

                        <div className="flex gap-2">
                          <HkBadge status={hk.status} />
                          <Badge label={derived.replaceAll("_", " ")} tone="red" />
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 mt-1">
                        Hotel: {hotelNameById.get(r.areaId) ?? r.areaId}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardShell>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <CardShell
            title="Readiness blockers"
            subtitle="Vacant rooms that are not VACANT_CLEAN (dirty / maintenance / out-of-order)"
          >
            {readiness.blockers.length === 0 ? (
              <div className="text-sm text-gray-500">No blockers ✅</div>
            ) : (
              <div className="grid gap-2">
                {readiness.blockers.slice(0, 12).map((b) => (
                  <div key={`${b.hotelId}:${b.roomNumber}`} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Room {b.roomNumber}</div>
                      <div className="flex gap-2">
                        <HkBadge status={b.hk} />
                        <Badge label={b.derived.replaceAll("_", " ")} tone="amber" />
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Hotel: {hotelNameById.get(b.hotelId) ?? b.hotelId}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardShell>

          {/* Hotel settings summary */}
          <CardShell
            title="Hotel settings summary"
            subtitle="Admin-defined per-hotel settings (Opening hours + Pricing + Policy)"
            actions={
              <Link href="/dashboard/settings" className="text-xs text-blue-700 hover:underline">
                Open settings →
              </Link>
            }
          >
            {hotelInfoRows.length === 0 ? (
              <div className="text-sm text-gray-500">No hotels loaded.</div>
            ) : (
              <div className="space-y-3">
                {hotelInfoRows.map((h) => (
                  <div key={h.id} className="rounded-lg border p-3 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">{h.name}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Rooms: {h.totalRooms} • Occupied: {h.occupiedRooms} • Available: {h.availableRooms}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Base rate:{" "}
                          <span className="font-semibold">
                            {h.baseNightlyRate > 0 ? fmtMoney(h.baseNightlyRate, h.currency) : "Not set"}
                          </span>{" "}
                          • Currency: <span className="font-semibold">{h.currency}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col gap-1 items-end">
                        <Badge
                          label={h.autoPostRoomCharges ? "Auto charges: ON" : "Auto charges: OFF"}
                          tone={h.autoPostRoomCharges ? "green" : "amber"}
                        />
                        {hotelFilterId === "ALL" ? (
                          <button
                            type="button"
                            className="text-xs text-blue-700 hover:underline"
                            onClick={() => setHotelFilterId(h.id)}
                            title="Filter reception view to this hotel"
                          >
                            Filter →
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
                      <div className="rounded-md border bg-gray-50 p-2">
                        <div className="text-[11px] text-gray-500">Breakfast</div>
                        <div className="font-medium text-gray-900">{h.breakfast ?? "—"}</div>
                      </div>
                      <div className="rounded-md border bg-gray-50 p-2">
                        <div className="text-[11px] text-gray-500">Restaurant</div>
                        <div className="font-medium text-gray-900">{h.restaurant ?? "—"}</div>
                      </div>
                      <div className="rounded-md border bg-gray-50 p-2">
                        <div className="text-[11px] text-gray-500">Room service</div>
                        <div className="font-medium text-gray-900">{h.roomService ?? "—"}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardShell>

          <CardShell title="Tasks" subtitle="Restaurant/ops tasks panel (shared component)">
            <TasksPanel currentUserEmail={staffEmail} />
          </CardShell>
        </div>
      </div>

      <StayDetailsModal
        open={!!openStayResolved}
        onClose={() => setOpenStay(null)}
        stay={openStayResolved}
        hotelInfo={openStayHotelInfo}
        selectedDateKey={dateKey}
        todayKey={todayKey}
        canOverride={canOverride}
        canQuickCheckout={canQuickCheckout}
        roomReservedNow={modalRoomReservedNow}
        roomSpecialRequests={modalRoomSpecialRequests}
        onCheckIn={checkInStay}
        onCheckOut={quickCheckOutStay}
        onCancelStay={cancelStay}
      />

      {/* Walk-in wizard */}
      <WalkInWizardModal
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        staffEmail={staffEmail}
        staffRole={myRole as any}
        onCreated={() => {
          setWalkInOpen(false);
          refreshAll();
        }}
      />
    </div>
  );
}
