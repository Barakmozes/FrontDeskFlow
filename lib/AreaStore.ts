import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { BasicArea } from "@/graphql/generated";

/**
 * Extended shape of the store:
 * 1) The currently selected area (with 'id', 'name', 'floorPlanImage?'), or null
 * 2) The array of areas from the DB
 * 3) Scale logic for zooming
 * 4) moveTable or similar method for updating a table's position (can be local or call DB)
 * 5) setSelectedArea, clearSelectedArea, etc.
 */

// If your store also needs to keep local track of Tables, add a type for them:
export interface TableInStore {
  id: string;
  tableNumber: number;
  areaId: string;
  position: { x: number; y: number };
  dirty?: boolean; // optional: track if table was modified
    diners: number;
   reserved: boolean;
    specialRequests: string[];
   createdAt: Date;
   updatedAt: Date;
}

type AreaStore = {
  // ---------- Areas and Selection ----------
  selectedArea: BasicArea | null;
  areas: BasicArea[];

  setAreas: (fetchedAreas: BasicArea[]) => void;
  setSelectedArea: (areaIdOrName: string) => void;
  clearSelectedArea: () => void;

  // ---------- Scale Logic ----------
  scale: number;
  scaleLimits: { min: number; max: number };
  setScale: (newScale: number) => void;
  adjustScale: (delta: number) => void;

  // ---------- Table Data & Moving Logic ----------
  // Optional: local array of tables if you store them in Zustand
  tables: TableInStore[];
  setTables: (t: TableInStore[]) => void;

  /**
   * Use a stable 'id' to update table location or area.
   * The newAreaId could be an actual area ID. 
   */
  moveTable: (
    tableId: string,
    newAreaId: string,
    newPosition: { x: number; y: number }
  ) => void;

  // ---------- Persistence ----------
  persistAreaState: () => void;
};

export const useRestaurantStore = create<AreaStore>()(
  persist(
    devtools((set, get) => ({
      // ---------- State Initialization ----------
      selectedArea: null,
      areas: [],

      // Scale logic
      scale: 1,
      scaleLimits: { min: 0.5, max: 2 },

      // If you want to keep local table data:
      tables: [],
      setTables: (fetchedTables) => {
        set({ tables: fetchedTables });
      },

      // ---------- Actions / Methods ----------

      setAreas: (fetchedAreas) => {
        set({ areas: fetchedAreas });
      },

      setSelectedArea: (areaIdOrName) => {
        const { areas } = get();
        const found = areas.find(
          (a) => a.id === areaIdOrName || a.name === areaIdOrName
        );
        if (!found) {
          console.warn(`Area "${areaIdOrName}" not found in store.areas`);
          return;
        }
        set({
          selectedArea: {
            id: found.id,
            name: found.name,
            floorPlanImage: found.floorPlanImage ?? null,
            createdAt: found.createdAt,
          },
        });
      },

      clearSelectedArea: () => set({ selectedArea: null }),

      setScale: (newScale) => {
        const { scaleLimits } = get();
        // clamp the new scale
        const clampedScale = Math.max(
          scaleLimits.min,
          Math.min(scaleLimits.max, newScale)
        );
        set({ scale: clampedScale });
      },

      adjustScale: (delta) => {
        const { scale, setScale } = get();
        setScale(scale + delta);
      },

      /**
       * 6) moveTable
       * We'll do a local update if 'tables' are stored here.
       * Or you can do nothing local and just rely on server re-fetch.
       */
      moveTable: (tableId, newAreaId, newPosition) => {
        set((state) => {
          const updatedTables = state.tables.map((t) => {
            if (t.id === tableId) {
              const positionChanged =
                t.position.x !== newPosition.x || t.position.y !== newPosition.y;
              const areaChanged = t.areaId !== newAreaId;
      
              if (positionChanged || areaChanged) {
                return { ...t, areaId: newAreaId, position: newPosition, dirty: true };
              }
            }
            return t;
          });
          return { tables: updatedTables };
        });
      },
      

      persistAreaState: () => {
        try {
          const { areas, selectedArea, scale } = get();
          localStorage.setItem(
            "restaurantAreaState",
            JSON.stringify({ areas, selectedArea, scale })
          );
        } catch (error) {
          console.error("Failed to persist area state:", error);
        }
      },
    })),
    {
      name: "restaurant-areas",
      skipHydration: true,
    }
  )
);
