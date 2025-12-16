// graphql/schema/Reservation/enum.ts

import { builder } from "@/graphql/builder";

/**
 * ReservationStatus Enum
 * Represents the reservation status lifecycle.
 */
export const ReservationStatus = builder.enumType("ReservationStatus", {
  values: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] as const,
  description: "The status of a reservation",
});
