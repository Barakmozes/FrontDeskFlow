// graphql/schema/Restaurant/queries.ts

import prisma from "@/lib/prisma";
import { builder } from "@/graphql/builder";
import { GraphQLError } from "graphql";

/**
 * Pothos Prisma Object: Restaurant
 *
 * Reflects the Prisma Restaurant model:
 *  - id (String, cuid)
 *  - name (String)
 *  - address (String?, default: "27 DrickField, Darwin, Australia")
 *  - openTimes (Json[])
 *  - deliveryFee (Float, default: 4)
 *  - serviceFee (Float, default: 3)
 *  - bannerImg (String)
 *  - rating (Float, default: 4.5)
 *  - areas (Area[]) => we do NOT define the Area object here
 *  - createdAt, updatedAt (DateTime)
 */
builder.prismaObject("Restaurant", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    address: t.exposeString("address", { nullable: true }),
    openTimes: t.expose("openTimes", { type: "JSON" }),
    deliveryFee: t.exposeFloat("deliveryFee"),
    serviceFee: t.exposeFloat("serviceFee"),
    bannerImg: t.exposeString("bannerImg",{ nullable: true }),
    rating: t.exposeFloat("rating"),

    // Relation to areas (not defining the Area object here)
    areas: t.relation("areas"),

    // Timestamps
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

/**
 * Query Fields for Restaurant
 */
builder.queryFields((t) => ({
  /**
   * getRestaurant
   * Fetch a single Restaurant by ID. Throws if not found.
   */
  getRestaurant: t.prismaField({
    type: "Restaurant",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      const restaurant = await prisma.restaurant.findUnique({
        ...query,
        where: { id: args.id },
      });
      if (!restaurant) {
        throw new GraphQLError("Restaurant not found");
      }
      return restaurant;
    },
  }),

  /**
   * getRestaurants
   * Fetch all restaurants (optionally with pagination, but not shown here).
   */
  getRestaurants: t.prismaField({
    type: ["Restaurant"],
    resolve: async (query) => {
      return prisma.restaurant.findMany({ ...query });
    },
  }),

  /**
   * searchRestaurants
   * Example: Fetch restaurants by name substring. If you need a search feature.
   */
  searchRestaurants: t.prismaField({
    type: ["Restaurant"],
    args: {
      keyword: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      return prisma.restaurant.findMany({
        ...query,
        where: {
          name: {
            contains: args.keyword,
            mode: "insensitive",
          },
        },
      });
    },
  }),
}));
