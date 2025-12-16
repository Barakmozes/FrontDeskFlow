// graphql/schema/Restaurant/mutations.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Mutation Fields for Restaurant
 */
builder.mutationFields((t) => ({
  /**
   * addRestaurant
   * Creates a new Restaurant. Typically requires ADMIN privileges.
   */
  addRestaurant: t.prismaField({
    type: "Restaurant",
    args: {
      name: t.arg.string({ required: true }),
      address: t.arg.string(),
      openTimes: t.arg({ type: "JSON" }),
      deliveryFee: t.arg.float(),
      serviceFee: t.arg.float(),
      bannerImg: t.arg.string(),
      rating: t.arg.float(),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      if (!context.user) {
        throw new GraphQLError("You must be logged in to add a restaurant");
      }

      // Must be ADMIN
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to add a restaurant");
      }

      // Optionally check if a restaurant by this name already exists
      const existing = await prisma.restaurant.findFirst({
        where: { name: args.name },
      });
      if (existing) {
        throw new GraphQLError("Restaurant with this name already exists");
      }

      // Create the new restaurant
      const newRestaurant = await prisma.restaurant.create({
        ...query,
        data: {
          name: args.name,
          address: args.address ?? undefined,
          openTimes: args.openTimes ?? [],
          deliveryFee: args.deliveryFee ?? 4,  // fallback to default
          serviceFee: args.serviceFee ?? 3,   // fallback to default
          bannerImg: args.bannerImg ?? undefined,
          rating: args.rating ?? 4.5,         // fallback to default
        },
      });
      return newRestaurant;
    },
  }),

  /**
   * editRestaurant
   * Updates an existing Restaurant by ID. Requires ADMIN.
   */
  editRestaurant: t.prismaField({
    type: "Restaurant",
    args: {
      id: t.arg.string({ required: true }),
      name: t.arg.string(),
      address: t.arg.string(),
      openTimes: t.arg({ type: "JSON" }),
      deliveryFee: t.arg.float(),
      serviceFee: t.arg.float(),
      bannerImg: t.arg.string(),
      rating: t.arg.float(),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to edit a restaurant");
      }
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to edit restaurants");
      }

      // Attempt to update
      const updatedRestaurant = await prisma.restaurant.update({
        where: { id: args.id },
        data: {
          name: args.name ?? undefined,
          address: args.address ?? undefined,
          openTimes: args.openTimes ?? undefined,
          deliveryFee: args.deliveryFee ?? undefined,
          serviceFee: args.serviceFee ?? undefined,
          bannerImg: args.bannerImg ?? undefined,
          rating: args.rating ?? undefined,
        },
      });
      return updatedRestaurant;
    },
  }),

  /**
   * deleteRestaurant
   * Deletes a Restaurant by ID. ADMIN-only.
   */
  deleteRestaurant: t.prismaField({
    type: "Restaurant",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to delete a restaurant");
      }
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to delete restaurants");
      }

      // Delete
      const deleted = await prisma.restaurant.delete({
        where: { id: args.id },
      });
      return deleted;
    },
  }),
}));
