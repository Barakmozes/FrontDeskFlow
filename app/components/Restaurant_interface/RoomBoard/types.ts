// app/components/Restaurant_interface/RoomBoard/types.ts
import type { ReservationStatus } from "@/graphql/generated";

export type StayBlock = {
  stayId: string; // stable for UI
  roomId: string;
  roomNumber: number;
  hotelId: string;

  startDateKey: string;
  endDateKey: string; // exclusive
  nights: number;

  userEmail: string;
  guestName: string;
  guestPhone?: string | null;

  status: ReservationStatus;
  reservationIds: string[];
};
