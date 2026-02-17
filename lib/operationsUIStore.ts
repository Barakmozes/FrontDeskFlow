import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

/**
 * Front Desk Operations UI state:
 * - selected hotel
 * - selected day
 * - active tab (arrivals / in-house / departures)
 * - search
 *
 * Backend truth is still GraphQL. This is ONLY UI state.
 */

export type OpsTab = "ARRIVALS" | "IN_HOUSE" | "DEPARTURES";

const todayKey = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

type OperationsUIStore = {
  hotelId: string | null;
  setHotelId: (id: string | null) => void;

  dateKey: string; // YYYY-MM-DD
  setDateKey: (k: string) => void;

  tab: OpsTab;
  setTab: (t: OpsTab) => void;

  search: string;
  setSearch: (s: string) => void;
};

export const useOperationsUIStore = create<OperationsUIStore>()(
  persist(
    devtools((set) => ({
      hotelId: null,
      setHotelId: (hotelId) => set({ hotelId }),

      dateKey: todayKey(),
      setDateKey: (dateKey) => set({ dateKey }),

      tab: "ARRIVALS",
      setTab: (tab) => set({ tab }),

      search: "",
      setSearch: (search) => set({ search }),
    })),
    {
      name: "frontdesk-operations-ui",
      skipHydration: true,
      partialize: (s) => ({
        hotelId: s.hotelId,
        dateKey: s.dateKey,
        tab: s.tab,
      }),
    }
  )
);
