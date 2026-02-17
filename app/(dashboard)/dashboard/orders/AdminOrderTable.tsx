"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@urql/next";


import OrdersFilter from "./OrdersFilter";
import { AdminFetchedOrders } from "./AdminFetchedOrders";

import {
  GetAreasDocument,
  type GetAreasQuery,
  type GetAreasQueryVariables,
  GetTablesDocument,
  type GetTablesQuery,
  type GetTablesQueryVariables,
  GetReservationsDocument,
  type GetReservationsQuery,
  type GetReservationsQueryVariables,
} from "@/graphql/generated";

import { groupReservationsIntoStays, type StayBlock } from "@/lib/stayGrouping";
import type { OrdersLookups } from "./orderLinking";
import TableWrapper from "../Components/TableWrapper";

const PAGE_SIZE = 12;

export default function AdminOrderTable({ staffEmail }: { staffEmail: string | null }) {
  // --- Pagination ---
  const [pageVariables, setPageVariables] = useState<Array<{ first: number; after: string | null }>>([
    { first: PAGE_SIZE, after: null },
  ]);

  // --- Load hotels (areas) ---
  const [{ data: hotelsData, fetching: hotelsFetching, error: hotelsError }] = useQuery<
    GetAreasQuery,
    GetAreasQueryVariables
  >({
    query: GetAreasDocument,
    variables: {},
    requestPolicy: "cache-and-network",
  });

  // --- Load rooms (tables) ---
  const [{ data: roomsData, fetching: roomsFetching, error: roomsError }] = useQuery<
    GetTablesQuery,
    GetTablesQueryVariables
  >({
    query: GetTablesDocument,
    variables: {},
    requestPolicy: "cache-and-network",
  });

  // --- Load reservations (bookings) ---
  const [{ data: resData, fetching: resFetching, error: resError }] = useQuery<
    GetReservationsQuery,
    GetReservationsQueryVariables
  >({
    query: GetReservationsDocument,
    variables: {},
    requestPolicy: "cache-and-network",
  });

  const hotels = useMemo(() => {
    const list = hotelsData?.getAreas ?? [];
    return [...list].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [hotelsData?.getAreas]);

  const rooms = useMemo(() => roomsData?.getTables ?? [], [roomsData?.getTables]);
  const reservations = useMemo(() => resData?.getReservations ?? [], [resData?.getReservations]);

  // Group reservations into stays (same logic as Reception)
  const stays: StayBlock[] = useMemo(() => groupReservationsIntoStays(reservations), [reservations]);

  // Build lookup maps for fast linking (orders -> room -> hotel -> stay)
  const lookups: OrdersLookups = useMemo(() => {
    const hotelById = new Map<string, { id: string; name: string; description?: string | null }>();
    for (const h of hotels) {
      hotelById.set(h.id, { id: h.id, name: h.name, description: (h as any)?.description ?? null });
    }

    const roomById = new Map<
      string,
      { id: string; tableNumber: number; areaId: string; reserved: boolean; specialRequests?: any }
    >();
    for (const r of rooms) {
      roomById.set(r.id, {
        id: r.id,
        tableNumber: r.tableNumber,
        areaId: r.areaId,
        reserved: r.reserved,
        specialRequests: (r as any)?.specialRequests ?? null,
      });
    }

    const stayByReservationId = new Map<string, StayBlock>();
    const stayByRoomEmailDateKey = new Map<string, StayBlock>();

    for (const s of stays) {
      // reservationIds should exist on StayBlock per your usage in Reception
      for (const rid of s.reservationIds) stayByReservationId.set(rid, s);

      const email = (s.userEmail ?? "").toLowerCase();
      // nightsList: [{ reservationId, dateKey }]
      for (const n of s.nightsList) {
        stayByRoomEmailDateKey.set(`${s.roomId}|${email}|${n.dateKey}`, s);
      }
    }

    return { hotelById, roomById, stayByReservationId, stayByRoomEmailDateKey };
  }, [hotels, rooms, stays]);

  const isLoading = hotelsFetching || roomsFetching || resFetching;
  const anyError = hotelsError || roomsError || resError;

  return (
    <TableWrapper title={"Orders • Folios • Bookings"} showSearchAndFilter={false}>
      <div className="flex flex-col gap-2 px-4 py-3 bg-white border-b">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-800">Admin Orders (Hotel-aware)</div>
            <div className="text-xs text-slate-500">
              Includes: deliveries + in-house room service + nightly room charges (folio lines).
            </div>
          </div>

          <OrdersFilter
            hotels={hotels.map((h) => ({ id: h.id, name: h.name }))}
            disabled={isLoading}
          />
        </div>

        {isLoading ? <div className="text-xs text-slate-500">Loading hotels/rooms/bookings…</div> : null}
        {anyError ? (
          <div className="text-xs text-red-600">
            Failed to load hotel context: {anyError.message}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-slate-600">
          <thead className="text-xs whitespace-nowrap text-slate-700 uppercase bg-slate-100">
            <tr>
              <th className="px-6 py-3">Booking / Room</th>
              <th className="px-6 py-3">Order #</th>
              <th className="px-6 py-3">Placed</th>
              <th className="px-6 py-3">Guest</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Paid</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Actions</th>
              <th className="px-6 py-3">View</th>
            </tr>
          </thead>

          {pageVariables.map((variables, i) => (
            <AdminFetchedOrders
              key={`${variables.after ?? "FIRST"}:${i}`}
              variables={variables}
              isLastPage={i === pageVariables.length - 1}
              lookups={lookups}
              staffEmail={staffEmail}
              onLoadMore={(after) =>
                setPageVariables((prev) => [...prev, { after, first: PAGE_SIZE }])
              }
            />
          ))}
        </table>
      </div>
    </TableWrapper>
  );
}
