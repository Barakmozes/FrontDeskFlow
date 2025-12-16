// graphql/schema/TableUsage/mutations.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Mutation Fields for TableUsage
 */
builder.mutationFields((t) => ({
  /**
   * addTableUsage
   * Creates a TableUsage record for a given tableId if none exists.
   * Typically requires ADMIN or MANAGER roles.
   */
  addTableUsage: t.prismaField({
    type: "TableUsage",
    args: {
      tableId: t.arg.string({ required: true }),
      usageCount: t.arg.int(),
      lastUsed: t.arg({ type: "DateTime" }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      // Must be ADMIN or MANAGER
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "MANAGER"
      ) {
        throw new GraphQLError("You are not authorized to add TableUsage");
      }

      // Check if a TableUsage for this tableId already exists
      const existing = await prisma.tableUsage.findUnique({
        where: { tableId: args.tableId },
      });
      if (existing) {
        throw new GraphQLError("Usage for this table already exists");
      }

      // Create a new usage record
      const newUsage = await prisma.tableUsage.create({
        ...query,
        data: {
          tableId: args.tableId,
          usageCount: args.usageCount ?? 0,
          lastUsed: args.lastUsed ?? null,
        },
      });
      return newUsage;
    },
  }),

  /**
   * updateTableUsage
   * Updates usageCount and/or lastUsed fields by "id". 
   * Typically requires ADMIN or MANAGER roles.
   */
  updateTableUsage: t.prismaField({
    type: "TableUsage",
    args: {
      id: t.arg.string({ required: true }),
      usageCount: t.arg.int(),
      lastUsed: t.arg({ type: "DateTime" }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "MANAGER"
      ) {
        throw new GraphQLError("You are not authorized to update TableUsage");
      }

      const updated = await prisma.tableUsage.update({
        where: { id: args.id },
        data: {
          usageCount: args.usageCount ?? undefined,
          lastUsed: args.lastUsed ?? undefined,
        },
      });

      return updated;
    },
  }),

  /**
   * incrementUsageCount
   * Increments usageCount for a particular TableUsage record. 
   * Also sets 'lastUsed' to now, if desired.
   */
  incrementUsageCount: t.prismaField({
    type: "TableUsage",
    args: {
      id: t.arg.string({ required: true }),
      setLastUsed: t.arg.boolean(), // optional flag to set lastUsed = now
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Auth checks
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "MANAGER"
      ) {
        throw new GraphQLError("You are not authorized to increment TableUsage");
      }

      // Retrieve the existing usage record
      const usage = await prisma.tableUsage.findUnique({
        where: { id: args.id },
      });
      if (!usage) {
        throw new GraphQLError("TableUsage not found");
      }

      // Increment usageCount by 1, optionally set lastUsed to current time
      const updatedUsage = await prisma.tableUsage.update({
        where: { id: args.id },
        data: {
          usageCount: usage.usageCount + 1,
          lastUsed: args.setLastUsed ? new Date() : usage.lastUsed,
        },
      });
      return updatedUsage;
    },
  }),

  /**
   * deleteTableUsage
   * Deletes a TableUsage record by "id". Typically ADMIN or MANAGER only.
   */
  deleteTableUsage: t.prismaField({
    type: "TableUsage",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in & have privileges
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "MANAGER"
      ) {
        throw new GraphQLError("You are not authorized to delete TableUsage");
      }

      const deleted = await prisma.tableUsage.delete({
        where: { id: args.id },
      });
      return deleted;
    },
  }),
}));
