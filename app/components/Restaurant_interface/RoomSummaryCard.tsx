"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";

import {
  GetTableOrderDocument,
  GetTableOrderQuery,
  GetTableOrderQueryVariables,
  ReservationStatus,
  ToggleTableReservationDocument,
  ToggleTableReservationMutation,
  ToggleTableReservationMutationVariables,
} from "@/graphql/generated";

import { useCartStore } from "@/lib/store";
import { useHotelStore, type RoomInStore } from "@/lib/AreaStore";
import { useFrontDeskUIStore } from "@/lib/frontDeskUIStore";

export type RoomReservationPreview = {
  id: string;
  reservationTime: string; // DateTime scalar => string in client
  status: ReservationStatus;
  numOfDiners: number; // we treat this as "guests" for now
  guestEmail: string;
  guestName?: string | null;
  guestPhone?: string | null;
};

type Props = {
  room: RoomInStore;
  dateKey: string; // YYYY-MM-DD (board date)
  reservationsForDate?: RoomReservationPreview[];
  compact?: boolean; // side panel = compact mode
};

// Small helper: consistent styling for reservation statuses
const statusPillClass = (status: ReservationStatus) => {
  switch (status) {
    case ReservationStatus.Confirmed:
      return "bg-green-100 text-green-800";
    case ReservationStatus.Pending:
      return "bg-yellow-100 text-yellow-800";
    case ReservationStatus.Cancelled:
      return "bg-gray-100 text-gray-600";
    case ReservationStatus.Completed:
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

export default function RoomSummaryCard({
  room,
  dateKey,
  reservationsForDate = [],
  compact = false,
}: Props) {
  const router = useRouter();

  // Existing “Room service” mechanics: reuse cart global store
  const startOrderForTable = useCartStore((s) => s.startOrderForTable);

  // Keep room occupancy synced locally after mutation
  const updateRoom = useHotelStore((s) => s.updateRoom);

  // Open booking modal with room context
  const openReservationModal = useFrontDeskUIStore((s) => s.openReservationModal);

  const [expanded, setExpanded] = useState(false);

  // Load orders only when expanded (avoids noisy network)
  const [{ data: orderData, fetching: orderFetching }] = useQuery<
    GetTableOrderQuery,
    GetTableOrderQueryVariables
  >({
    query: GetTableOrderDocument,
    variables: { tableId: room.id },
    pause: !expanded,
    requestPolicy: "cache-first",
  });

  const lastOrder = useMemo(() => {
    const orders = orderData?.getTableOrder ?? [];
    if (orders.length === 0) return null;

    // Sort by orderDate to safely get latest (backend could return any order)
    return [...orders].sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    )[0];
  }, [orderData]);

  // Occupied/Vacant uses existing backend field: Table.reserved
  // For hotels this becomes "occupied". (Later we'll replace with RoomStatus enum.)
  const [{ fetching: toggling }, toggleOccupiedMutation] = useMutation<
    ToggleTableReservationMutation,
    ToggleTableReservationMutationVariables
  >(ToggleTableReservationDocument);

  const toggleOccupied = async () => {
    const next = !room.isOccupied;

    const res = await toggleOccupiedMutation({
      toggleTableReservationId: room.id,
      reserved: next,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to update room occupancy.");
      return;
    }

    updateRoom(room.id, {
      isOccupied: res.data?.toggleTableReservation.reserved ?? next,
      updatedAt: new Date().toISOString(),
    });

    toast.success(next ? `Room ${room.roomNumber} marked occupied.` : `Room ${room.roomNumber} marked vacant.`);
  };

  const startRoomService = () => {
    // Important: this does NOT clear anything in backend.
    // It just starts a new cart in the existing cart mechanics.
    startOrderForTable(room.id, room.roomNumber);
    toast.success(`Room service started for Room ${room.roomNumber}`);

    // Convention from your folder structure: /dashboard/menu
    // If your menu route is different, change it here.
    router.push("/dashboard/menu");
  };

  const bookedCount = reservationsForDate.length;

  return (
    <div
      className={[
        "border rounded-lg bg-white p-3 shadow-sm transition",
        compact ? "" : "hover:shadow-md",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-800 truncate">
              Room {room.roomNumber}
            </p>

            <span
              className={[
                "text-[10px] px-2 py-0.5 rounded-full",
                room.isOccupied ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800",
              ].join(" ")}
              title="Uses Table.reserved from backend"
            >
              {room.isOccupied ? "Occupied" : "Available"}
            </span>
          </div>

          <p className="text-xs text-gray-500">
            Capacity: {room.capacity}
          </p>

          <div className="mt-1">
            {bookedCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px]">
                Booked ({bookedCount}) on {dateKey}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-[11px]">
                Free on {dateKey}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition"
        >
          {expanded ? "Hide" : "Details"}
        </button>
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startRoomService}
          className="text-xs bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Room Service
        </button>

        <button
          type="button"
          onClick={() => openReservationModal(room.id, room.roomNumber)}
          className="text-xs bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 transition"
        >
          New Booking
        </button>

        <button
          type="button"
          onClick={toggleOccupied}
          disabled={toggling}
          className={[
            "text-xs px-3 py-2 rounded-lg transition",
            toggling
              ? "bg-gray-200 text-gray-600 cursor-not-allowed"
              : "bg-gray-800 text-white hover:bg-gray-900",
          ].join(" ")}
        >
          {toggling ? "Updating…" : room.isOccupied ? "Mark Vacant" : "Mark Occupied"}
        </button>
      </div>

      {/* Expanded details */}
      {expanded ? (
        <div className="mt-3 border-t pt-3 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-700">Notes</p>
            {room.notes.length ? (
              <ul className="mt-1 list-disc list-inside text-xs text-gray-600">
                {room.notes.map((n, idx) => (
                  <li key={`${room.id}-note-${idx}`}>{n}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">No notes.</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700">Bookings on {dateKey}</p>
            {reservationsForDate.length ? (
              <ul className="mt-1 space-y-1">
                {reservationsForDate.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-700 truncate">
                      {r.guestName || r.guestEmail} • {r.numOfDiners} guests
                      {r.guestPhone ? ` • ${r.guestPhone}` : ""}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusPillClass(r.status)}`}>
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">No bookings.</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700">Latest Order</p>
            {orderFetching ? (
              <p className="text-xs text-gray-500">Loading orders…</p>
            ) : lastOrder ? (
              <p className="text-xs text-gray-600">
                #{lastOrder.orderNumber} • {lastOrder.status} • ₪{lastOrder.total.toFixed(2)} •{" "}
                {lastOrder.paid ? "Paid" : "Unpaid"}
              </p>
            ) : (
              <p className="text-xs text-gray-500">No orders yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
