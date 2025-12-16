// graphql/schema/Order/enum.ts
import { builder } from "@/graphql/builder";

/**
 * OrderStatus
 *
 * Represents the different stages an order can go through.
 * Matches the Prisma enum:
 *   PREPARING, UNASSIGNED, COLLECTED, DELIVERED,
 *   PENDING, READY, SERVED, COMPLETED, CANCELLED
 *
 * Adjust or add to this if your schema evolves.
 */
export const OrderStatus = builder.enumType("OrderStatus", {
  values: [
    "PREPARING",
    "UNASSIGNED",
    "COLLECTED",
    "DELIVERED",
    "PENDING",
    "READY",
    "SERVED",
    "COMPLETED",
    "CANCELLED",
  ] as const,
  description: "All possible statuses an order can have.",
});
