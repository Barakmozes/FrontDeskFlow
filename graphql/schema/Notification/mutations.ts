// graphql/schema/Notification/mutations.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";
import { NotificationPriority, NotificationStatus } from "./enum";

/**
 * Mutation Fields for Notification
 */
builder.mutationFields((t) => ({
  /**
   * addNotification
   * Creates a new notification for a user. Typically the system or an admin would do this.
   */
  addNotification: t.prismaField({
    type: "Notification",
    args: {
      userEmail: t.arg.string({ required: true }),
      type: t.arg.string({ required: true }),
      priority: t.arg({ type: NotificationPriority }),
      message: t.arg.string({ required: true }),
      status: t.arg({ type: NotificationStatus }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      if (!context.user) {
        throw new GraphQLError("You must be logged in to add a notification");
      }

      // Example check: Only ADMIN can create arbitrary notifications
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to create notifications");
      }

      const newNotification = await prisma.notification.create({
        ...query,
        data: {
          userEmail: args.userEmail,
          type: args.type,
          priority: args.priority ?? "NORMAL",
          message: args.message,
          status: args.status ?? "UNREAD",
        },
      });
      return newNotification;
    },
  }),

  /**
   * markNotificationAsRead
   * Sets status to READ for the given notification ID.
   */
  markNotificationAsRead: t.prismaField({
    type: "Notification",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to mark a notification as read");
      }

      // Retrieve existing notification
      const existing = await prisma.notification.findUnique({
        where: { id: args.id },
      });
      if (!existing) {
        throw new GraphQLError("Notification not found");
      }

      // If not admin, must own that notification (by userEmail)
      const isAdmin = context.user.role === "ADMIN";
      if (!isAdmin && existing.userEmail !== context.user.email) {
        throw new GraphQLError("You are not authorized to mark this notification as read");
      }

      // Update
      const updated = await prisma.notification.update({
        where: { id: args.id },
        data: { status: "READ" },
      });
      return updated;
    },
  }),

  /**
   * updateNotification
   * Allows updating fields like 'priority', 'message', 'status' for an existing notification.
   * Typically restricted to ADMIN or the user who owns it.
   */
  updateNotification: t.prismaField({
    type: "Notification",
    args: {
      id: t.arg.string({ required: true }),
      priority: t.arg({ type: NotificationPriority }),
      message: t.arg.string(),
      status: t.arg({ type: NotificationStatus }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to update a notification");
      }

      // Retrieve existing
      const existing = await prisma.notification.findUnique({
        where: { id: args.id },
      });
      if (!existing) {
        throw new GraphQLError("Notification not found");
      }

      // Only admin or the user who owns it can update
      const isAdmin = context.user.role === "ADMIN";
      if (!isAdmin && existing.userEmail !== context.user.email) {
        throw new GraphQLError("You are not authorized to update this notification");
      }

      // Perform update
      const updated = await prisma.notification.update({
        where: { id: args.id },
        data: {
          priority: args.priority ?? undefined,
          message: args.message ?? undefined,
          status: args.status ?? undefined,
        },
      });
      return updated;
    },
  }),

  /**
   * deleteNotification
   * Deletes a notification. Admin or the notification's owner can delete.
   */
  deleteNotification: t.prismaField({
    type: "Notification",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to delete a notification");
      }

      const existing = await prisma.notification.findUnique({
        where: { id: args.id },
      });
      if (!existing) {
        throw new GraphQLError("Notification not found");
      }

      const isAdmin = context.user.role === "ADMIN";
      if (!isAdmin && existing.userEmail !== context.user.email) {
        throw new GraphQLError("You are not authorized to delete this notification");
      }

      return prisma.notification.delete({
        where: { id: args.id },
      });
    },
  }),
}));
