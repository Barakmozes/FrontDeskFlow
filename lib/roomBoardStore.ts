// lib/roomBoardStore.ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { HkRoomStatus } from "@/lib/housekeepingTags";

export type OccupancyFilter = "ALL" | "AVAILABLE" | "OCCUPIED";

type RoomBoardStore = {
  startDateKey: string;
  days: number;

  hotelId: "ALL" | string;
  occupancy: OccupancyFilter;
  hkStatus: "ALL" | HkRoomStatus;

  floor: "ALL" | number;      // derived from roomNumber
  capacity: "ALL" | number;   // from Table.diners

  selectedStayId: string | null;

  setStartDateKey: (v: string) => void;
  setDays: (v: number) => void;

  setHotelId: (v: "ALL" | string) => void;
  setOccupancy: (v: OccupancyFilter) => void;
  setHkStatus: (v: "ALL" | HkRoomStatus) => void;

  setFloor: (v: "ALL" | number) => void;
  setCapacity: (v: "ALL" | number) => void;

  openStay: (stayId: string) => void;
  closeStay: () => void;
};

export const useRoomBoardStore = create<RoomBoardStore>()(
  persist(
    devtools((set) => ({
      startDateKey: (() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      })(),
      days: 14,

      hotelId: "ALL",
      occupancy: "ALL",
      hkStatus: "ALL",

      floor: "ALL",
      capacity: "ALL",

      selectedStayId: null,

      setStartDateKey: (v) => set({ startDateKey: v }),
      setDays: (v) => set({ days: Math.max(7, Math.min(31, v)) }),

      setHotelId: (v) => set({ hotelId: v }),
      setOccupancy: (v) => set({ occupancy: v }),
      setHkStatus: (v) => set({ hkStatus: v }),

      setFloor: (v) => set({ floor: v }),
      setCapacity: (v) => set({ capacity: v }),

      openStay: (stayId) => set({ selectedStayId: stayId }),
      closeStay: () => set({ selectedStayId: null }),
    })),
    {
      name: "room-board-store",
      partialize: (s) => ({
        startDateKey: s.startDateKey,
        days: s.days,
        hotelId: s.hotelId,
        occupancy: s.occupancy,
        hkStatus: s.hkStatus,
        floor: s.floor,
        capacity: s.capacity,
      }),
    }
  )
);
