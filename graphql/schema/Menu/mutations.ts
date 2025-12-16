// graphql/schema/Menu/mutations.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Mutation Fields for Menu
 */
builder.mutationFields((t) => ({
  /**
   * addMenu
   * Creates a new menu entry if one does not already exist with the same title.
   * Requires an ADMIN user.
   */
  addMenu: t.prismaField({
    type: "Menu",
    args: {
      title: t.arg.string({ required: true }),
      shortDescr: t.arg.string({ required: true }),
      longDescr: t.arg.string({ required: true }),
      price: t.arg.float({ required: true }),
      sellingPrice: t.arg.float(),
      image: t.arg.string({ required: true }),
      category: t.arg.string({ required: true }),
      prepType: t.arg.stringList({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Only an ADMIN can add a menu item
      if (context.user?.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to perform this action");
      }

      // Check if a menu with this title already exists
      const existingMenu = await prisma.menu.findFirst({
        ...query,
        where: { title: args.title },
      });
      if (existingMenu) {
        throw new GraphQLError("Menu already exists");
      }

      // Create a new menu item
      const newMenu = await prisma.menu.create({
        data: {
          title: args.title,
          shortDescr: args.shortDescr,
          longDescr: args.longDescr,
          price: args.price,
          sellingPrice: args.sellingPrice ?? undefined,
          image: args.image,
          category: args.category,
          prepType: args.prepType,
        },
      });
      return newMenu;
    },
  }),

  /**
   * editMenu
   * Updates an existing menu entry by ID. Requires an ADMIN user.
   */
  editMenu: t.prismaField({
    type: "Menu",
    args: {
      id: t.arg.string({ required: true }),
      title: t.arg.string({ required: true }),
      shortDescr: t.arg.string({ required: true }),
      longDescr: t.arg.string({ required: true }),
      price: t.arg.float({ required: true }),
      sellingPrice: t.arg.float(),
      image: t.arg.string({ required: true }),
      category: t.arg.string({ required: true }),
      prepType: t.arg.stringList({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Only an ADMIN can edit a menu
      if (context.user?.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to perform this action");
      }

      // Update the menu item
      const updatedMenu = await prisma.menu.update({
        where: { id: args.id },
        data: {
          title: args.title,
          shortDescr: args.shortDescr,
          longDescr: args.longDescr,
          price: args.price,
          sellingPrice: args.sellingPrice ?? undefined,
          image: args.image,
          category: args.category,
          prepType: args.prepType,
        },
      });
      return updatedMenu;
    },
  }),

  /**
   * deleteMenu
   * Deletes an existing menu entry by ID. Requires an ADMIN user.
   */
  deleteMenu: t.prismaField({
    type: "Menu",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Only an ADMIN can delete a menu
      if (context.user?.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to perform this action");
      }

      // Delete the menu item
      const deletedMenu = await prisma.menu.delete({
        where: { id: args.id },
      });
      return deletedMenu;
    },
  }),
}));
