import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { BasicArea } from "@/graphql/generated";

/**
 * Hotel Layout Store (client-side)
 *
 * IMPORTANT: We are NOT changing the backend schema.
 * The backend still uses:
 *   - Area  => Hotel (property)
 *   - Table => Room
 *
 * This store provides HOTEL/ROOM vocabulary to the UI.
 */

export interface RoomInStore {
  id: string;
  roomNumber: number; // backend: tableNumber
  hotelId: string; // backend: areaId
  position: { x: number; y: number };

  /** Maximum guests (capacity). Backend: diners */
  capacity: number;

  /** Simple occupancy flag. Backend: reserved */
  isOccupied: boolean;

  /** Notes / requests. Backend: specialRequests */
  notes: string[];

  /** Backend scalars are usually ISO strings */
  createdAt: string;
  updatedAt: string;

  /** Marks layout changes (drag/drop). Saved via "Save Layout". */
  dirty?: boolean;
}

export type HotelInStore = BasicArea;

type HotelStore = {
  // ---------- Hotels (Areas) ----------
  selectedHotel: HotelInStore | null;
  hotels: HotelInStore[];

  setHotels: (fetchedHotels: HotelInStore[]) => void;
  setSelectedHotel: (hotelIdOrName: string) => void;
  clearSelectedHotel: () => void;

  // ---------- Zoom ----------
  scale: number;
  scaleLimits: { min: number; max: number };
  setScale: (newScale: number) => void;
  adjustScale: (delta: number) => void;

  // ---------- Rooms (Tables) ----------
  rooms: RoomInStore[];
  setRooms: (rooms: RoomInStore[]) => void;
  removeRoom: (roomId: string) => void;

  updateRoom: (roomId: string, patch: Partial<Omit<RoomInStore, "id">>) => void;

  moveRoom: (
    roomId: string,
    newHotelId: string,
    newPosition: { x: number; y: number }
  ) => void;

  // ---------- Manual Persistence Helper ----------
  persistHotelState: () => void;
};

export const useHotelStore = create<HotelStore>()(
  persist(
    devtools((set, get) => ({
      // ---------- State ----------
      selectedHotel: null,
      hotels: [],

      scale: 1,
      scaleLimits: { min: 0.5, max: 2 },

      rooms: [],

      // ---------- Actions ----------
      setHotels: (fetchedHotels) => set({ hotels: fetchedHotels }),

      setSelectedHotel: (hotelIdOrName) => {
        const { hotels } = get();
        const found = hotels.find(
          (h) => h.id === hotelIdOrName || h.name === hotelIdOrName
        );
        if (!found) {
          console.warn(`Hotel "${hotelIdOrName}" not found in store.hotels`);
          return;
        }
        set({
          selectedHotel: {
            id: found.id,
            name: found.name,
            floorPlanImage: found.floorPlanImage ?? null,
            createdAt: found.createdAt,
          },
        });
      },

      clearSelectedHotel: () => set({ selectedHotel: null }),

      setScale: (newScale) => {
        const { min, max } = get().scaleLimits;
        const clampedScale = Math.max(min, Math.min(max, newScale));
        set({ scale: clampedScale });
      },

      adjustScale: (delta) => {
        const { scale, setScale } = get();
        setScale(scale + delta);
      },

      setRooms: (rooms) => set({ rooms }),

      removeRoom: (roomId) =>
        set((state) => ({
          rooms: state.rooms.filter((r) => r.id !== roomId),
        })),

      updateRoom: (roomId, patch) =>
        set((state) => ({
          rooms: state.rooms.map((r) =>
            r.id === roomId ? { ...r, ...patch } : r
          ),
        })),

      moveRoom: (roomId, newHotelId, newPosition) => {
        set((state) => {
          const updatedRooms = state.rooms.map((r) => {
            if (r.id !== roomId) return r;

            const positionChanged =
              r.position.x !== newPosition.x || r.position.y !== newPosition.y;
            const hotelChanged = r.hotelId !== newHotelId;

            if (!positionChanged && !hotelChanged) return r;

            return {
              ...r,
              hotelId: newHotelId,
              position: newPosition,
              dirty: true,
            };
          });

          return { rooms: updatedRooms };
        });
      },

      persistHotelState: () => {
        try {
          const { hotels, selectedHotel, scale } = get();
          localStorage.setItem(
            "hotelLayoutState",
            JSON.stringify({ hotels, selectedHotel, scale })
          );
        } catch (error) {
          console.error("Failed to persist hotel state:", error);
        }
      },
    })),
    {
      name: "hotel-layout-store",
      skipHydration: true,
      /**
       * Persist only UI preferences (selection + zoom).
       * Hotels/rooms are fetched from the backend.
       */
      partialize: (state) => ({
        selectedHotel: state.selectedHotel,
        scale: state.scale,
      }),
    }
  )
);

/**
 * Backward compatibility exports.
 * You can remove these once all imports are migrated.
 */
export const useRestaurantStore = useHotelStore;
export type TableInStore = RoomInStore;
