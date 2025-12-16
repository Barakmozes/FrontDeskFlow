// graphql/schema/Favorite/mutations.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Mutation Fields for Favorite
 */
builder.mutationFields((t) => ({
  /**
   * addFavorite
   * Adds a new favorite menu item for the given userEmail, creating a Favorite record
   * if it does not already exist. Must be the same user as logged in.
   */
  addFavorite: t.prismaField({
    type: "Favorite",
    args: {
      userEmail: t.arg.string({ required: true }),
      menuId: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      const isLoggedIn = !context.user;
      if (isLoggedIn) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // User can only add a favorite to their own account
      if (context.user?.email !== args.userEmail) {
        throw new GraphQLError(
          "You cannot add a favorite to an account that is not yours"
        );
      }

      // Check if a Favorite record for this userEmail already exists
      const existingFavorite = await prisma.favorite.findFirst({
        ...query,
        where: { userEmail: args.userEmail },
      });

      // If none exists, create a new record with the single menuId
      if (!existingFavorite) {
        const newFavorite = await prisma.favorite.create({
          data: {
            userEmail: args.userEmail,
            menu: [args.menuId], // create a new array with this menuId
          },
        });
        return newFavorite;
      }

      // Otherwise, update the existing record:
      // Check if the menuId is already in the user’s favorites
      if (existingFavorite.menu.includes(args.menuId)) {
        throw new GraphQLError("Favorite already exists for this user");
      }

      // Push the new menuId to the existing array
      const updatedFavorite = await prisma.favorite.update({
        where: { id: existingFavorite.id },
        data: {
          menu: [...existingFavorite.menu, args.menuId],
        },
      });
      return updatedFavorite;
    },
  }),

  /**
   * removeFavorite
   * Removes a menuId from the existing Favorite record for the given userEmail.
   * Must be logged in as that user.
   */
  removeFavorite: t.prismaField({
    type: "Favorite",
    args: {
      menuId: t.arg.string({ required: true }),
      userEmail: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // User can only remove a favorite from their own account
      if (context.user?.email !== args.userEmail) {
        throw new GraphQLError(
          "You cannot alter a favorite for an account that is not yours"
        );
      }

      // Find the Favorite record
      const favorite = await prisma.favorite.findFirst({
        ...query,
        where: { userEmail: args.userEmail },
      });
      if (!favorite) {
        throw new GraphQLError("No favorite found");
      }

      // Remove the specified menuId from the array
      const updatedMenuIds = favorite.menu.filter((item) => item !== args.menuId);

      const updatedFavorite = await prisma.favorite.update({
        where: { id: favorite.id },
        data: { menu: updatedMenuIds },
      });
      return updatedFavorite;
    },
  }),
}));
