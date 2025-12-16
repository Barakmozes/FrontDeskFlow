// graphql/schema/User/enum.ts

import { builder } from "@/graphql/builder";

/**
 * Role Enum
 * Defines the roles of users in the system with varying levels
 * of access and responsibilities.
 */
export const Role = builder.enumType("Role", {
  values: [
    "USER",      // Regular customer
    "ADMIN",     // System administrator
    "DELIVERY",  // Delivery personnel
    "WAITER",    // Restaurant staff (waiter)
    "CHEF",      // Kitchen staff
    "MANAGER",   // Restaurant manager
  ] as const,
  description: "User roles in the system",
});
