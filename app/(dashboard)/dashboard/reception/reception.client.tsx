"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";
import { useClient } from "urql";

import Modal from "@/app/components/Common/Modal";
import TasksPanel from "@/app/components/Restaurant_interface/Tasks/TasksPanel";
import WalkInWizardModal from "./WalkInWizardModal";

import {
  // data
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

  // actions
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

  ReservationStatus,
  Role,
} from "@/graphql/generated";

import {
  coversDateKey,
  folioReservationIdForDateKey,
  groupReservationsIntoStays,
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

// auto-post room charges (folio)
import { ensureNightlyRoomCharges } from "@/lib/folioRoomCharges";
import { parseHotelSettings } from "@/lib/hotelSettingsTags";
import { parseRoomRateTags, getEffectiveNightlyRate } from "@/lib/roomRateTags";

/* ----------------------- Hotel settings tags constants ---------------------- */
/**
 * Must match Settings -> OpeningHours.tsx
 * Stored inside Area.description via hotelSettingsTags helpers.
 */
const TAG_BREAKFAST = "HOURS_BREAKFAST";
const TAG_RESTAURANT = "HOURS_RESTAURANT";
const TAG_ROOM_SERVICE = "HOURS_ROOM_SERVICE";

/* ------------------------------- Helpers ----------------------------------- */

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

  onCheckIn: (stay: StayBlock) => void;
  onCheckOut: (stay: StayBlock) => void;
  onCancelStay: (stay: StayBlock) => void;
}) {
  if (!open || !stay) return null;

  const isToday = selectedDateKey === todayKey;

  const { hk, notes } = parseHousekeepingTags(stay.specialRequests);
  const roomStatus = deriveRoomStatus(stay.tableReservedNow, hk);

  // Robust folio selection:
  // - If selectedDateKey is inside stay, use it
  // - Otherwise (future/past search), use the startDateKey
  const folioDateKey = coversDateKey(stay, selectedDateKey) ? selectedDateKey : stay.startDateKey;
  const folioId = folioReservationIdForDateKey(stay, folioDateKey);

  const isArrivingToday = stay.startDateKey === todayKey;
  const isFutureArrival = stay.startDateKey > todayKey;

  // Pricing preview
  const currency = hotelInfo?.currency ?? "USD";
  const baseRate = hotelInfo?.baseNightlyRate ?? 0;
  const overrideRate = parseRoomRateTags(stay.specialRequests).rate.overrideNightlyRate ?? null;
  const effectiveRate = getEffectiveNightlyRate(baseRate, overrideRate);

  return (
    <Modal isOpen={open} title={`Stay • Room ${stay.roomNumber}`} closeModal={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs text-gray-600">Hotel</div>
          <div className="text-sm font-semibold text-gray-900">{hotelInfo?.name ?? "Hotel"}</div>

          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <ResStatusBadge status={stay.status} />
            <HkBadge status={hk.status} />
            <Badge label={roomStatus.replaceAll("_", " ")} tone={roomStatus === "OCCUPIED" ? "red" : "gray"} />
            <Badge label={`${stay.startDateKey} → ${stay.endDateKey}`} />
            <Badge label={`${stay.nights} night${stay.nights === 1 ? "" : "s"}`} />
            <Badge label={`${stay.guests} guest${stay.guests === 1 ? "" : "s"}`} />
            {isFutureArrival ? <Badge label="FUTURE ARRIVAL" tone="blue" /> : null}
          </div>

          {notes.length ? (
            <div className="mt-2 text-xs text-gray-600">
              Notes: <span className="text-gray-800">{notes.slice(0, 2).join(" • ")}</span>
              {notes.length > 2 ? <span className="text-gray-500"> • +{notes.length - 2} more</span> : null}
            </div>
          ) : null}
        </div>

        {/* Hotel settings summary */}
        {hotelInfo ? (
          <div className="rounded-lg border p-3">
            <div className="text-xs text-gray-600">Hotel settings (from Settings)</div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="text-sm">
                <div className="text-[11px] text-gray-500">Base nightly rate</div>
                <div className="font-semibold text-gray-900">
                  {hotelInfo.baseNightlyRate > 0 ? fmtMoney(hotelInfo.baseNightlyRate, currency) : "Not set"}
                </div>
              </div>

              <div className="text-sm">
                <div className="text-[11px] text-gray-500">Effective room rate</div>
                <div className="font-semibold text-gray-900">
                  {effectiveRate > 0 ? fmtMoney(effectiveRate, currency) : "Not set"}
                  {overrideRate != null ? <span className="text-xs text-gray-500"> (override)</span> : null}
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
                  {hotelInfo.occupiedRooms} occupied • {hotelInfo.availableRooms} available (total {hotelInfo.totalRooms})
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

        <div className="rounded-lg border p-3">
          <div className="text-xs text-gray-600">Nights (debug-friendly)</div>
          <div className="mt-2 grid gap-2">
            {stay.reservations.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <div className="text-gray-700">
                  {stay.nightsList.find((n) => n.reservationId === r.id)?.dateKey ?? ""} • {r.numOfDiners} guests
                </div>
                <ResStatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={`/dashboard/folio/${folioId}`}
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Open folio
          </Link>

          {/* Operational rules */}
          {!isToday ? (
            <div className="text-xs text-amber-700 px-2 py-2">
              Actions disabled (planning mode). Switch date to today to operate.
            </div>
          ) : null}

          {isToday && !isArrivingToday ? (
            <div className="text-xs text-gray-500 px-2 py-2">
              This stay arrives on <b>{stay.startDateKey}</b>. Check‑in is only allowed on arrival day.
            </div>
          ) : null}

          {isToday && !stay.tableReservedNow && isArrivingToday ? (
            <button
              onClick={() => onCheckIn(stay)}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700"
              title={hk.status !== "CLEAN" && !canOverride ? "Requires Manager/Admin override" : "Confirm + Occupy room"}
            >
              Check‑in
            </button>
          ) : null}

          {isToday && stay.tableReservedNow ? (
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
  // Requires urql Provider in dashboard layout
  const client = useClient();

  const todayKey = useMemo(() => todayLocalDateKey(), []);
  const [dateKey, setDateKey] = useState<string>(todayKey);
  const [hotelFilterId, setHotelFilterId] = useState<string>("ALL");
  const [tab, setTab] = useState<Tab>("ARRIVALS");
  const [search, setSearch] = useState("");

  const [openStay, setOpenStay] = useState<StayBlock | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  // Who am I? (role controls overrides)
  const [{ data: meData }] = useQuery<GetUserQuery, GetUserQueryVariables>({
    query: GetUserDocument,
    variables: staffEmail ? { email: staffEmail } : ({} as any),
    pause: !staffEmail,
  });

  const myRole = meData?.getUser?.role ?? null;
  const canOverride = myRole === Role.Admin || myRole === Role.Manager;
  const canQuickCheckout = canOverride;

  // Hotels (Areas)
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

  // Rooms (Tables)
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

  const inHotel = (hid: string) => hotelFilterId === "ALL" || hotelFilterId === hid;

  // ✅ SINGLE source of truth (shared stay grouping)
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
  }, [staysAll, hotelFilterId, search]);

  const arrivals = useMemo(() => {
    return staysFiltered
      .filter((s) => {
        if (s.startDateKey !== dateKey) return false;
        if (s.status === ReservationStatus.Cancelled) return false;
        if (isToday && s.tableReservedNow) return false;
        return isActiveStay(s);
      })
      .sort((a, b) => a.roomNumber - b.roomNumber);
  }, [staysFiltered, dateKey, isToday]);

  const departures = useMemo(() => {
    return staysFiltered
      .filter((s) => {
        if (s.status === ReservationStatus.Cancelled) return false;
        return s.endDateKey === dateKey;
      })
      .sort((a, b) => a.roomNumber - b.roomNumber);
  }, [staysFiltered, dateKey]);

  const inHouse = useMemo(() => {
    return staysFiltered
      .filter((s) => {
        if (s.status === ReservationStatus.Cancelled) return false;
        if (!coversDateKey(s, dateKey)) return false;
        if (isToday) return s.tableReservedNow === true;
        return true;
      })
      .sort((a, b) => a.roomNumber - b.roomNumber);
  }, [staysFiltered, dateKey, isToday]);

  /**
   * ✅ Future reservations:
   * - Active only (Pending/Confirmed)
   * - Start AFTER selected dateKey
   */
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

  const futureByHotel = useMemo(() => {
    const m = new Map<
      string,
      { hotelId: string; hotelName: string; stays: number; guests: number; roomNights: number; nextArrival: string }
    >();

    for (const s of futureStays) {
      const prev = m.get(s.hotelId);
      const hotelName = hotelNameById.get(s.hotelId) ?? s.hotelId;

      if (!prev) {
        m.set(s.hotelId, {
          hotelId: s.hotelId,
          hotelName,
          stays: 1,
          guests: s.guests ?? 0,
          roomNights: s.nights ?? 0,
          nextArrival: s.startDateKey,
        });
      } else {
        prev.stays += 1;
        prev.guests += s.guests ?? 0;
        prev.roomNights += s.nights ?? 0;
        if (s.startDateKey < prev.nextArrival) prev.nextArrival = s.startDateKey;
      }
    }

    return Array.from(m.values()).sort((a, b) => a.nextArrival.localeCompare(b.nextArrival));
  }, [futureStays, hotelNameById]);

  const unlinkedOccupied = useMemo(() => {
    const occupiedRooms = rooms.filter((r) => r.reserved && inHotel(r.areaId));
    const roomIdsWithStay = new Set(inHouse.map((s) => s.roomId));
    return occupiedRooms
      .filter((r) => !roomIdsWithStay.has(r.id))
      .sort((a, b) => a.tableNumber - b.tableNumber);
  }, [rooms, inHouse, hotelFilterId]);

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
  }, [rooms, hotelFilterId]);

  const isLoading = hotelsFetching || roomsFetching || resFetching;
  const anyError = hotelsError || roomsError || resError;

  const totals = useMemo(() => {
    return {
      arrivalsGuests: sumStayGuests(arrivals),
      inHouseGuests: sumStayGuests(inHouse),
      departuresGuests: sumStayGuests(departures),
    };
  }, [arrivals, inHouse, departures]);

  const listForTab =
    tab === "ARRIVALS"
      ? arrivals
      : tab === "IN_HOUSE"
      ? inHouse
      : tab === "DEPARTURES"
      ? departures
      : tab === "FUTURE"
      ? futureStays
      : staysFiltered;

  const refreshAll = () => {
    refetchReservations({ requestPolicy: "network-only" });
    refetchRooms({ requestPolicy: "network-only" });
  };

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

    const filtered = hotelFilterId === "ALL" ? all : all.filter((x) => x.id === hotelFilterId);
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [hotels, hotelInfoById, hotelFilterId]);

  const openStayHotelInfo = useMemo(() => {
    if (!openStay) return null;
    return hotelInfoById.get(openStay.hotelId) ?? null;
  }, [openStay, hotelInfoById]);

  /* ------------------------------- Actions -------------------------------- */

  const checkInStay = async (stay: StayBlock) => {
    if (!isToday) return toast.error("Check-in is only allowed for today.");
    if (stay.startDateKey !== todayKey) return toast.error("This stay is not arriving today.");

    const room = roomsById.get(stay.roomId);
    if (!room) return toast.error("Room not found.");
    if (room.reserved) return toast.error("Room is already occupied.");

    const { hk } = parseHousekeepingTags(room.specialRequests);
    const derived = deriveRoomStatus(room.reserved, hk);

    if (derived !== "VACANT_CLEAN" && !canOverride) {
      toast.error("Room is not READY (vacant clean). Manager/Admin override required.");
      return;
    }

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

    // 2) confirm all nights
    for (const r of stay.reservations) {
      if (r.status === ReservationStatus.Cancelled || r.status === ReservationStatus.Completed) continue;
      if (r.status === ReservationStatus.Confirmed) continue;

      const e = await editReservation({
        editReservationId: r.id,
        status: ReservationStatus.Confirmed,
      });

      if (e.error) {
        console.error(e.error);
        toast.error("Room occupied, but failed to confirm all nights.");
        break;
      }
    }

    // 3) auto-post nightly room charges (if enabled in hotel settings)
    const hotelInfo = hotelInfoById.get(stay.hotelId) ?? null;

    if (hotelInfo?.autoPostRoomCharges) {
      const override = parseRoomRateTags(room.specialRequests).rate.overrideNightlyRate ?? null;
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
            toast.success(`Room charges posted: ${result.created} night${result.created === 1 ? "" : "s"}`);
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
  };

  const cancelStay = async (stay: StayBlock) => {
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
  };

  const quickCheckOutStay = async (stay: StayBlock) => {
    if (!isToday) return toast.error("Check-out is only allowed for today.");

    const room = roomsById.get(stay.roomId);
    if (!room) return toast.error("Room not found.");
    if (!room.reserved) return toast.error("Room is already vacant.");

    if (!canQuickCheckout) {
      toast.error("Quick check-out requires Manager/Admin. Use folio checkout.");
      return;
    }

    // 1) complete reservations
    for (const r of stay.reservations) {
      if (r.status === ReservationStatus.Cancelled || r.status === ReservationStatus.Completed) continue;
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
  };

  /* -------------------------------- Render -------------------------------- */

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
              Arrivals / Departures / In‑house guests — grouped into stays to prevent duplication and keep Ops consistent.
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

            <Link href="/dashboard/operations" className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
              Operations →
            </Link>
          </div>
        </div>

        {anyError ? (
          <div className="mt-4 rounded-lg bg-red-50 text-red-700 text-sm p-3">Error: {anyError.message}</div>
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
        {/* Future */}
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
                ? "Arrivals"
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
                : `Showing ${listForTab.length} stay(s)`
            }
          >
            {/* Future breakdown by hotel */}
            {tab === "FUTURE" && futureByHotel.length > 0 ? (
              <div className="mb-3 rounded-lg border bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">Future load by hotel</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {futureByHotel.map((row) => (
                    <button
                      key={row.hotelId}
                      type="button"
                      className="rounded-lg border bg-white p-3 text-left hover:bg-gray-50"
                      onClick={() => {
                        if (hotelFilterId === "ALL") setHotelFilterId(row.hotelId);
                      }}
                      title={hotelFilterId === "ALL" ? "Click to filter by this hotel" : undefined}
                    >
                      <div className="text-sm font-semibold text-gray-900">{row.hotelName}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        {row.stays} stay(s) • {row.guests} guests • {row.roomNights} room‑nights
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">Next arrival: {row.nextArrival}</div>
                    </button>
                  ))}
                </div>
                {hotelFilterId !== "ALL" ? (
                  <div className="mt-2 text-[11px] text-gray-500">
                    Tip: set Hotel filter to <b>All hotels</b> to see a multi-hotel breakdown here.
                  </div>
                ) : null}
              </div>
            ) : null}

            {listForTab.length === 0 ? (
              <div className="text-sm text-gray-500">No stays found for this view.</div>
            ) : (
              <div className="grid gap-2">
                {listForTab.map((s) => {
                  const { hk } = parseHousekeepingTags(s.specialRequests);
                  const derived = deriveRoomStatus(s.tableReservedNow, hk);

                  const info = hotelInfoById.get(s.hotelId) ?? null;
                  const currency = info?.currency ?? "USD";
                  const base = info?.baseNightlyRate ?? 0;
                  const override = parseRoomRateTags(s.specialRequests).rate.overrideNightlyRate ?? null;
                  const effRate = getEffectiveNightlyRate(base, override);

                  const hotelName = info?.name ?? hotelNameById.get(s.hotelId) ?? "Hotel";

                  const folioDateKey = coversDateKey(s, dateKey) ? dateKey : s.startDateKey;
                  const folioId = folioReservationIdForDateKey(s, folioDateKey);

                  return (
                    <button
                      key={s.stayId}
                      type="button"
                      onClick={() => setOpenStay(s)}
                      className="w-full rounded-lg border bg-white p-3 text-left hover:bg-gray-50"
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
                            {effRate > 0 ? (
                              <Badge label={`Rate: ${fmtMoney(effRate, currency)}`} tone="gray" />
                            ) : (
                              <Badge label="Rate: Not set" tone="amber" />
                            )}
                          </div>

                          <div className="mt-1 text-xs text-gray-600">
                            {hotelName} • {s.startDateKey} → {s.endDateKey} • {s.nights} night(s) • {s.guests} guest(s)
                            {tab === "FUTURE" ? (
                              <span className="text-gray-500"> • Arrival: {s.startDateKey}</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <Link
                            href={`/dashboard/folio/${folioId}`}
                            className="rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open folio
                          </Link>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardShell>

          {/* Unlinked occupied rooms */}
          <CardShell
            title="Occupied rooms without an active stay"
            subtitle="These rooms are marked OCCUPIED but no stay matches the selected date."
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
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">Room {r.tableNumber}</div>
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
                {readiness.blockers.length > 12 ? (
                  <div className="text-xs text-gray-500">
                    Showing first 12 of {readiness.blockers.length}. Filter by hotel to narrow.
                  </div>
                ) : null}
              </div>
            )}
          </CardShell>

          {/* ✅ NEW: Hotel settings summary (per hotel) */}
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
                        <Badge label={h.autoPostRoomCharges ? "Auto charges: ON" : "Auto charges: OFF"} tone={h.autoPostRoomCharges ? "green" : "amber"} />
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
        open={!!openStay}
        onClose={() => setOpenStay(null)}
        stay={openStay}
        hotelInfo={openStayHotelInfo}
        selectedDateKey={dateKey}
        todayKey={todayKey}
        canOverride={canOverride}
        canQuickCheckout={canQuickCheckout}
        onCheckIn={checkInStay}
        onCheckOut={quickCheckOutStay}
        onCancelStay={cancelStay}
      />

{/* Walk-in wizard */}
      <WalkInWizardModal
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        staffEmail={staffEmail}
        staffRole={myRole}
        // If your WalkInWizardModal supports onCreated, keep it.
        // If not, remove this prop (or add it in the modal).
        onCreated={() => {
          setWalkInOpen(false);
          refreshAll();
        }}
      />
    </div>
  );
}
