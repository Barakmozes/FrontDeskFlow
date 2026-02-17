import { builder } from "@/graphql/builder";

/**
 * Role Enum (Hotel + Legacy)
 * Keep legacy values until DB rows are migrated.
 */
export const Role = builder.enumType("Role", {
  values: [
    // Guest
    "USER",

    // Hotel roles
    "RECEPTION",
    "HOUSEKEEPING",
    "ACCOUNTING",
    "MANAGER",
    "ADMIN",

    // Legacy restaurant roles (temporary)
    "DELIVERY",
    "WAITER",
    "CHEF",
  ] as const,
  description: "User roles in the system (hotel roles + legacy roles during migration)",
});
