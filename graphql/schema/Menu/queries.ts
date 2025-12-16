// graphql/schema/Menu/queries.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Pothos Prisma Object: Menu
 *
 * Reflects the Prisma Menu model:
 *  - id: String (cuid)
 *  - title: String
 *  - shortDescr: String
 *  - longDescr: String?
 *  - price: Float
 *  - sellingPrice: Float?
 *  - image: String
 *  - prepType: String[]
 *  - onPromo: Boolean (default: false)
 *  - category: String (legacy field for backward compatibility)
 *
 * We do not define any Category object here, as requested.
 */
builder.prismaObject("Menu", {
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    shortDescr: t.exposeString("shortDescr"),
    longDescr: t.exposeString("longDescr", { nullable: true }),
    price: t.exposeFloat("price"),
    sellingPrice: t.exposeFloat("sellingPrice", { nullable: true }),
    image: t.exposeString("image"),
    prepType: t.exposeStringList("prepType"),
    onPromo: t.exposeBoolean("onPromo"),
    category: t.exposeString("category"),
  }),
});

/**
 * Query Fields for Menu
 */
builder.queryFields((t) => ({
  /**
   * getMenu
   * Fetches a single Menu item by ID. Throws an error if not found.
   */
  getMenu: t.prismaField({
    type: "Menu",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      const menu = await prisma.menu.findFirst({
        ...query,
        where: { id: args.id },
      });
      if (!menu) {
        throw new GraphQLError("Menu not found");
      }
      return menu;
    },
  }),

  /**
   * getMenus
   * Fetches a paginated list of Menu items, using 'id' as a cursor.
   */
  getMenus: t.prismaConnection({
    type: "Menu",
    cursor: "id",
    resolve: async (query, _parent, _args, _context) => {
      const menus = await prisma.menu.findMany({
        ...query,
      });
      return menus;
    },
  }),

  /**
   * getMenuUserFavorites
   * Fetches a list of Menu items whose IDs match the user's favorite menuIds.
   * Requires the user to be logged in and to match the 'userEmail' argument.
   */
  getMenuUserFavorites: t.prismaField({
    type: ["Menu"],
    args: {
      userEmail: t.arg.string({ required: true }),
      menuIds: t.arg.stringList({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Check if user is logged in
      const isLoggedIn = !context.user;
      if (isLoggedIn) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // Check if the user matches the provided userEmail
      if (context.user?.email !== args.userEmail) {
        throw new GraphQLError(
          "You cannot retrieve favorites for an account that is not yours"
        );
      }

      // Find all matching menu items
      const menus = await prisma.menu.findMany({
        ...query,
        where: {
          id: { in: args.menuIds },
        },
      });

      return menus;
    },
  }),
}));
