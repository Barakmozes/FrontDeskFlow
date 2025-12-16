// graphql/schema/Waitlist/mutations.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";
import { WaitlistStatus } from "./enum";

/**
 * Mutation Fields for Waitlist
 */
builder.mutationFields((t) => ({
  /**
   * addWaitlistEntry
   * Adds a user to the waitlist for a given area. Defaults to WAITING status.
   */
  addWaitlistEntry: t.prismaField({
    type: "Waitlist",
    args: {
      userEmail: t.arg.string({ required: true }),
      areaId: t.arg.string({ required: true }),
      numOfDiners: t.arg.int({ required: true }),
      priority: t.arg.int(),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to join the waitlist");
      }

      const isAdminOrManager =
        context.user.role === "ADMIN" || context.user.role === "MANAGER";
      // If not admin/manager, the user can only add themselves
      if (!isAdminOrManager && context.user.email !== args.userEmail) {
        throw new GraphQLError("You are not authorized to add another user to the waitlist");
      }

      // Create a new waitlist entry
      const newEntry = await prisma.waitlist.create({
        ...query,
        data: {
          userEmail: args.userEmail,
          areaId: args.areaId,
          numOfDiners: args.numOfDiners,
          priority: args.priority ?? null,
          // status defaults to WAITING
        },
      });
      return newEntry;
    },
  }),

  /**
   * updateWaitlistEntry
   * Updates 'numOfDiners', 'priority', or 'status' by ID.
   */
  updateWaitlistEntry: t.prismaField({
    type: "Waitlist",
    args: {
      id: t.arg.string({ required: true }),
      numOfDiners: t.arg.int(),
      priority: t.arg.int(),
      status: t.arg({ type: WaitlistStatus }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to modify this waitlist entry");
      }

      // Retrieve existing entry
      const existing = await prisma.waitlist.findUnique({
        where: { id: args.id },
      });
      if (!existing) {
        throw new GraphQLError("Waitlist entry not found");
      }

      // Only admin/manager or the entry's user can edit
      const isAdminOrManager =
        context.user.role === "ADMIN" || context.user.role === "MANAGER";
      if (!isAdminOrManager && existing.userEmail !== context.user.email) {
        throw new GraphQLError("You are not authorized to edit this waitlist entry");
      }

      return prisma.waitlist.update({
        where: { id: args.id },
        data: {
          numOfDiners: args.numOfDiners ?? undefined,
          priority: args.priority ?? undefined,
          status: args.status ?? undefined,
        },
      });
    },
  }),

  /**
   * removeWaitlistEntry
   * Deletes a waitlist entry by ID. Typically an admin/manager or the same user can remove it.
   */
  removeWaitlistEntry: t.prismaField({
    type: "Waitlist",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to remove a waitlist entry");
      }

      // Retrieve existing entry
      const existing = await prisma.waitlist.findUnique({
        where: { id: args.id },
      });
      if (!existing) {
        throw new GraphQLError("Waitlist entry not found");
      }

      // Only admin/manager or the entry's user can remove
      const isAdminOrManager =
        context.user.role === "ADMIN" || context.user.role === "MANAGER";
      if (!isAdminOrManager && existing.userEmail !== context.user.email) {
        throw new GraphQLError("You are not authorized to remove this waitlist entry");
      }

      return prisma.waitlist.delete({
        where: { id: args.id },
      });
    },
  }),

  /**
   * callWaitlistEntry
   * Sets status to 'CALLED' and 'calledAt = now()'. Typically only staff.
   */
  callWaitlistEntry: t.prismaField({
    type: "Waitlist",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to call a waitlist entry");
      }

      // Must be admin/manager
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "MANAGER"
      ) {
        throw new GraphQLError("You are not authorized to call a waitlist entry");
      }

      const existing = await prisma.waitlist.findUnique({
        where: { id: args.id },
      });
      if (!existing) {
        throw new GraphQLError("Waitlist entry not found");
      }

      return prisma.waitlist.update({
        where: { id: args.id },
        data: {
          status: "CALLED" as any,
          calledAt: new Date(),
        },
      });
    },
  }),

  /**
   * seatWaitlistEntry
   * Marks an entry as SEATED (and records 'seatedAt').
   */
  seatWaitlistEntry: t.prismaField({
    type: "Waitlist",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to seat a waitlist entry");
      }

      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "MANAGER"
      ) {
        throw new GraphQLError("You are not authorized to seat a waitlist entry");
      }

      const existing = await prisma.waitlist.findUnique({
        where: { id: args.id },
      });
      if (!existing) {
        throw new GraphQLError("Waitlist entry not found");
      }

      // Only seat if status is WAITING or CALLED
      if (["SEATED", "CANCELLED"].includes(existing.status)) {
        throw new GraphQLError("Entry cannot be seated in its current state");
      }

      return prisma.waitlist.update({
        where: { id: args.id },
        data: {
          status: "SEATED" as any,
          seatedAt: new Date(),
        },
      });
    },
  }),

  /**
   * cancelWaitlistEntry
   * Cancels a waitlist entry by setting status = CANCELLED.
   * Either the user or staff can cancel.
   */
  cancelWaitlistEntry: t.prismaField({
    type: "Waitlist",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to cancel a waitlist entry");
      }

      // Retrieve existing entry
      const existing = await prisma.waitlist.findUnique({
        where: { id: args.id },
      });
      if (!existing) {
        throw new GraphQLError("Waitlist entry not found");
      }

      // Staff or user can cancel
      const isAdminOrManager =
        context.user.role === "ADMIN" || context.user.role === "MANAGER";
      if (!isAdminOrManager && existing.userEmail !== context.user.email) {
        throw new GraphQLError("You are not authorized to cancel this waitlist entry");
      }

      // If already seated or cancelled, skip
      if (["SEATED", "CANCELLED"].includes(existing.status)) {
        throw new GraphQLError("Entry cannot be cancelled in its current status");
      }

      return prisma.waitlist.update({
        where: { id: args.id },
        data: {
          status: "CANCELLED" as any,
        },
      });
    },
  }),
}));
