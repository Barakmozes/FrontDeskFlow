import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type HousekeepingFilter =
  | "ALL"
  | "NEEDS_CLEANING"
  | "IN_CLEANING_LIST"
  | "MAINTENANCE"
  | "OUT_OF_ORDER";

export type OccupancyFilter = "ALL" | "AVAILABLE" | "OCCUPIED";

type HousekeepingUIStore = {
  selectedHotelId: string | null;
  setSelectedHotelId: (id: string | null) => void;

  filter: HousekeepingFilter;
  setFilter: (f: HousekeepingFilter) => void;

  occupancy: OccupancyFilter;
  setOccupancy: (f: OccupancyFilter) => void;

  search: string;
  setSearch: (s: string) => void;
};

export const useHousekeepingUIStore = create<HousekeepingUIStore>()(
  persist(
    devtools((set) => ({
      selectedHotelId: null,
      setSelectedHotelId: (selectedHotelId) => set({ selectedHotelId }),

      filter: "NEEDS_CLEANING",
      setFilter: (filter) => set({ filter }),

      occupancy: "ALL",
      setOccupancy: (occupancy) => set({ occupancy }),

      search: "",
      setSearch: (search) => set({ search }),
    })),
    {
      name: "housekeeping-ui",
      skipHydration: true,
      partialize: (s) => ({
        selectedHotelId: s.selectedHotelId,
        filter: s.filter,
        occupancy: s.occupancy,
      }),
    }
  )
);
