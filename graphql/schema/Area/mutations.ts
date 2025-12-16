// graphql/schema/Area/mutations.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Mutation Fields for Area
 */
builder.mutationFields((t) => ({
  /**
   * addArea
   * Creates a new Area. Requires ADMIN role for creation.
   */
  addArea: t.prismaField({
    type: "Area",
    args: {
      name: t.arg.string({ required: true }),
      description: t.arg.string(),
      floorPlanImage: t.arg.string(),
      parentId: t.arg.string(),
      restaurantId: t.arg.string(),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      // Must be ADMIN
      if (!["ADMIN", "MANAGER"].includes(context.user?.role ?? "")) {
        throw new GraphQLError("You are not authorized to perform this action");
      }

      // Check for existing area with the same name
      const existingArea = await prisma.area.findFirst({
        where: { name: args.name },
      });
      if (existingArea) {
        throw new GraphQLError("Area with this name already exists");
      }

      // Create a new area
      const newArea = await prisma.area.create({
        ...query,
        data: {
          name: args.name,
          description: args.description ?? undefined,
          floorPlanImage: args.floorPlanImage ?? undefined,
          parentId: args.parentId ?? null,
          restaurantId: args.restaurantId ?? undefined,
        },
      });
      return newArea;
    },
  }),

  /**
   * editArea
   * Updates an existing Area by "id". Requires ADMIN role.
   */
  editArea: t.prismaField({
    type: "Area",
    args: {
      id: t.arg.string({ required: true }),
      name: t.arg.string(),
      description: t.arg.string(),
      floorPlanImage: t.arg.string(),
      parentId: t.arg.string(),
      restaurantId: t.arg.string(),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in & be ADMIN
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      if (!["ADMIN", "MANAGER"].includes(context.user?.role ?? "")) {
        throw new GraphQLError("You are not authorized to perform this action");
      }

      // Attempt to update the area
      const updatedArea = await prisma.area.update({
        where: { id: args.id },
        data: {
          name: args.name ?? undefined,
          description: args.description ?? undefined,
          floorPlanImage: args.floorPlanImage ?? undefined,
          parentId: args.parentId ?? null,
          restaurantId: args.restaurantId ?? undefined,
        },
      });

      return updatedArea;
    },
  }),

  /**
   * deleteArea
   * Deletes an Area by "id". Requires ADMIN role.
   * Optionally, you may need to handle children or reassign them before deleting.
   */
  deleteArea: t.prismaField({
    type: "Area",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in & be ADMIN
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      if (!["ADMIN", "MANAGER"].includes(context.user?.role ?? "")) {
        throw new GraphQLError("You are not authorized to perform this action");
      }

      // Delete the area
      const deletedArea = await prisma.area.delete({
        where: { id: args.id },
      });
      return deletedArea;
    },
  }),
}));
