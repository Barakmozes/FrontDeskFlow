// graphql/schema/GridConfig/mutations.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Mutation Fields for GridConfig
 */
builder.mutationFields((t) => ({
  /**
   * addGridConfig
   * Creates a new GridConfig. Typically requires ADMIN user.
   */
  addGridConfig: t.prismaField({
    type: "GridConfig",
    args: {
      areaId: t.arg.string({ required: true }),
      gridSize: t.arg.int(),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Check if user is logged in and is ADMIN
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to add GridConfig");
      }

      // Check if a GridConfig for this areaId already exists
      const existing = await prisma.gridConfig.findUnique({
        where: { areaId: args.areaId },
      });
      if (existing) {
        throw new GraphQLError("A GridConfig for this area already exists");
      }

      // Create a new GridConfig
      const newGridConfig = await prisma.gridConfig.create({
        ...query,
        data: {
          areaId: args.areaId,
          gridSize: args.gridSize ?? 20,
        },
      });
      return newGridConfig;
    },
  }),

  /**
   * editGridConfig
   * Updates an existing GridConfig by "id". Typically ADMIN user only.
   */
  editGridConfig: t.prismaField({
    type: "GridConfig",
    args: {
      id: t.arg.string({ required: true }),
      gridSize: t.arg.int(),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Check user + ADMIN
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to edit GridConfig");
      }

      // Update the GridConfig
      const updatedGridConfig = await prisma.gridConfig.update({
        where: { id: args.id },
        data: {
          gridSize: args.gridSize ?? undefined,
        },
      });
      return updatedGridConfig;
    },
  }),

  /**
   * deleteGridConfig
   * Deletes a GridConfig by "id". Typically ADMIN user only.
   * Because areaId is unique, you might want to confirm no references remain, but
   * that depends on your domain logic.
   */
  deleteGridConfig: t.prismaField({
    type: "GridConfig",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Admin check
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to delete GridConfig");
      }

      // Delete the record
      const deletedConfig = await prisma.gridConfig.delete({
        where: { id: args.id },
      });
      return deletedConfig;
    },
  }),
}));
