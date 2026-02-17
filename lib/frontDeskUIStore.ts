import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Keep "board state" separate from AreaStore (rooms/hotels data).
 * AreaStore = data model + layout mechanics.
 * FrontDeskUIStore = UI state (date, modal open, selection).
 */

// Local date => YYYY-MM-DD (matches <input type="date" />)
const todayLocalDateKey = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

type ReservationModalState = {
  isOpen: boolean;
  roomId: string | null;
  roomNumber: number | null;
};

type FrontDeskUIStore = {
  // Board date drives "booked/free" calculations.
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (dateKey: string) => void;

  // Create-booking modal context
  reservationModal: ReservationModalState;
  openReservationModal: (roomId: string, roomNumber: number) => void;
  closeReservationModal: () => void;
};

export const useFrontDeskUIStore = create<FrontDeskUIStore>()(
  devtools((set) => ({
    selectedDate: todayLocalDateKey(),
    setSelectedDate: (selectedDate) => set({ selectedDate }),

    reservationModal: { isOpen: false, roomId: null, roomNumber: null },
    openReservationModal: (roomId, roomNumber) =>
      set({ reservationModal: { isOpen: true, roomId, roomNumber } }),
    closeReservationModal: () =>
      set({ reservationModal: { isOpen: false, roomId: null, roomNumber: null } }),
  }))
);
