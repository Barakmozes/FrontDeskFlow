"use client";

import { useEffect } from "react";
import { useQuery } from "@urql/next";

import {
  GetAreasNameDescriptionDocument,
  GetAreasNameDescriptionQuery,
  GetAreasNameDescriptionQueryVariables,
  GetTablesDocument,
  GetTablesQuery,
  GetTablesQueryVariables,
} from "@/graphql/generated";

import { useHotelStore, type RoomInStore } from "@/lib/AreaStore";

/**
 * Loads:
 * - Hotels (Areas)
 * - Rooms (Tables)
 * And hydrates the existing useHotelStore.
 *
 * This preserves your existing mechanics (layout editor uses same store) :contentReference[oaicite:5]{index=5}
 */
const asIsoString = (value: unknown): string => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

export function useHotelsAndRooms() {
  const setHotels = useHotelStore((s) => s.setHotels);
  const setRooms = useHotelStore((s) => s.setRooms);

  const [hotelsRes] = useQuery<GetAreasNameDescriptionQuery, GetAreasNameDescriptionQueryVariables>({
    query: GetAreasNameDescriptionDocument,
    variables: { orderBy: { createdAt: "asc" as any } },
  });

  const [roomsRes, reexecuteRooms] = useQuery<GetTablesQuery, GetTablesQueryVariables>({
    query: GetTablesDocument,
    variables: {},
  });

  useEffect(() => {
    const fetched = hotelsRes.data?.getAreasNameDescription;
    if (!fetched) return;

    setHotels(
      fetched.map((h) => ({
        id: h.id,
        name: h.name,
        floorPlanImage: h.floorPlanImage ?? null,
        createdAt: h.createdAt,
      }))
    );
  }, [hotelsRes.data, setHotels]);

  useEffect(() => {
    const fetched = roomsRes.data?.getTables;
    if (!fetched) return;

    const mapped: RoomInStore[] = fetched.map((t) => ({
      id: t.id,
      roomNumber: t.tableNumber,
      hotelId: t.areaId,
      position: (t.position as { x: number; y: number }) ?? { x: 0, y: 0 },
      capacity: t.diners,
      isOccupied: t.reserved,
      notes: t.specialRequests ?? [],
      createdAt: asIsoString(t.createdAt),
      updatedAt: asIsoString(t.updatedAt),
      dirty: false,
    }));

    setRooms(mapped);
  }, [roomsRes.data, setRooms]);

  return {
    hotelsRes,
    roomsRes,
    refetchRooms: () => reexecuteRooms({ requestPolicy: "network-only" }),
  };
}
