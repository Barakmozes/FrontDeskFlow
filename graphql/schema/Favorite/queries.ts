// graphql/schema/Favorite/queries.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Pothos Prisma Object: Favorite
 *
 * Reflects the Prisma Favorite model:
 *  - id: String (cuid)
 *  - menu: String[]
 *  - userEmail: String (unique)
 *  - user: Relation to User (by userEmail)
 */
builder.prismaObject("Favorite", {
  fields: (t) => ({
    id: t.exposeString("id"),
    menu: t.exposeStringList("menu"),
    user: t.relation("user"),
    userEmail: t.exposeString("userEmail"),
  }),
});

/**
 * Query Fields for Favorite
 */
builder.queryFields((t) => ({
  /**
   * getFavorites
   * Fetches a list of all favorites. ADMIN-only.
   */
  getFavorites: t.prismaField({
    type: ["Favorite"],
    resolve: async (query, _parent, _args, contextPromise) => {
      const context = await contextPromise;

      // Check if the user is ADMIN
      if (context.user?.role !== "ADMIN") {
        throw new GraphQLError("You don't have permission to perform this action");
      }

      // Fetch all favorite records
      const adminFavorites = await prisma.favorite.findMany({ ...query });
      return adminFavorites;
    },
  }),

  /**
   * getUserFavorites
   * Fetches the Favorite record for a specific userEmail.
   * Requires user to be logged in and to own that email.
   */
  getUserFavorites: t.prismaField({
    type: "Favorite",
    args: {
      userEmail: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Check if context is present (user is logged in)
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // Retrieve the existing Favorite record by userEmail
      const favorite = await prisma.favorite.findUnique({
        ...query,
        where: { userEmail: args.userEmail },
      });
      if (!favorite) {
        throw new GraphQLError("No favorite found");
      }
      return favorite;
    },
  }),
}));
