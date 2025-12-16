// graphql/schema/Waitlist/enum.ts

import { builder } from "@/graphql/builder";

/**
 * WaitlistStatus
 * Indicates the status of a waitlist entry.
 */
export const WaitlistStatus = builder.enumType("WaitlistStatus", {
  values: ["WAITING", "CALLED", "SEATED", "CANCELLED"] as const,
  description: "Status of a waitlist entry",
});
