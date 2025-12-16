// graphql/schema/Notification/enum.ts

import { builder } from "@/graphql/builder";

/**
 * NotificationPriority Enum
 * Matches the Prisma NotificationPriority: LOW, NORMAL, HIGH
 */
export const NotificationPriority = builder.enumType("NotificationPriority", {
  values: ["LOW", "NORMAL", "HIGH"] as const,
  description: "The priority of a notification",
});

/**
 * NotificationStatus Enum
 * Matches the Prisma NotificationStatus: READ, UNREAD
 */
export const NotificationStatus = builder.enumType("NotificationStatus", {
  values: ["READ", "UNREAD"] as const,
  description: "The status of a notification",
});
