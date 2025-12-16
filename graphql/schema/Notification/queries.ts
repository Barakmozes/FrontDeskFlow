// graphql/schema/Notification/queries.ts

import prisma from "@/lib/prisma";
import { builder } from "@/graphql/builder";
import { GraphQLError } from "graphql";
import { NotificationPriority, NotificationStatus } from "./enum";

/**
 * Pothos Prisma Object: Notification
 *
 * Reflects the Prisma Notification model:
 *  - id: String (cuid)
 *  - userEmail: String -> user: User (by email)
 *  - type: String
 *  - priority: NotificationPriority @default(NORMAL)
 *  - message: String
 *  - status: NotificationStatus @default(UNREAD)
 *  - createdAt, updatedAt: DateTime
 *
 * We do NOT define the User object here; only reference user by relation.
 */
builder.prismaObject("Notification", {
  fields: (t) => ({
    id: t.exposeID("id"),
    userEmail: t.exposeString("userEmail"),
    user: t.relation("user"), // Not defining the User object here
    type: t.exposeString("type"),
    priority: t.expose("priority", { type: NotificationPriority }),
    message: t.exposeString("message"),
    status: t.expose("status", { type: NotificationStatus }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

/**
 * Query Fields for Notification
 */
builder.queryFields((t) => ({
  /**
   * getNotification
   * Fetch a single notification by ID. Throws if not found.
   */
  getNotification: t.prismaField({
    type: "Notification",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      const notification = await prisma.notification.findUnique({
        ...query,
        where: { id: args.id },
      });
      if (!notification) {
        throw new GraphQLError("Notification not found");
      }
      return notification;
    },
  }),

  /**
   * getNotifications
   * Fetch all notifications. Typically restricted to ADMIN or some privileged user.
   */
  getNotifications: t.prismaField({
    type: ["Notification"],
    resolve: async (query, _parent, _args, contextPromise) => {
      const context = await contextPromise;
      // Example authorization check
      if (context.user?.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to view all notifications");
      }
      return prisma.notification.findMany({ ...query });
    },
  }),

  /**
   * getUserNotifications
   * Fetch all notifications for a specific userEmail. The user can fetch their own,
   * or an ADMIN can fetch them for any user.
   */
  getUserNotifications: t.prismaField({
    type: ["Notification"],
    args: {
      userEmail: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      // Must be logged in
      if (!context.user) {
        throw new GraphQLError("You must be logged in to fetch notifications");
      }

      // If not admin, the userEmail must match the current user's email
      const isAdmin = context.user.role === "ADMIN";
      if (!isAdmin && context.user.email !== args.userEmail) {
        throw new GraphQLError("You are not authorized to view another user's notifications");
      }

      // Fetch notifications by userEmail
      return prisma.notification.findMany({
        ...query,
        where: { userEmail: args.userEmail },
      });
    },
  }),
}));
