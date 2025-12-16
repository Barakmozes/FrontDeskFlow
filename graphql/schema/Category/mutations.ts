// graphql/schema/Category/mutations.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Mutation Fields for Category
 */
builder.mutationFields((t) => ({
  /**
   * addCategory
   * Creates a new Category if one doesn't already exist with the same title.
   * Requires the user to be logged in and have the ADMIN role.
   */
  addCategory: t.prismaField({
    type: "Category",
    args: {
      title: t.arg.string({ required: true }),
      desc: t.arg.string({ required: true }),
      img: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      // Must be ADMIN
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to perform this action");
      }

      // Check if the category already exists by title
      const existingCategory = await prisma.category.findFirst({
        ...query,
        where: { title: args.title },
      });
      if (existingCategory) {
        throw new GraphQLError("This Category already exists");
      }

      // Create the new category
      const newCategory = await prisma.category.create({
        data: {
          title: args.title,
          desc: args.desc,
          img: args.img,
        },
      });
      return newCategory;
    },
  }),

  /**
   * editCategory
   * Updates an existing Category by ID. Requires a logged-in ADMIN.
   */
  editCategory: t.prismaField({
    type: "Category",
    args: {
      id: t.arg.string({ required: true }),
      title: t.arg.string({ required: true }),
      desc: t.arg.string({ required: true }),
      img: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      // Must be ADMIN
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to perform this action");
      }

      // Update the category
      const updatedCategory = await prisma.category.update({
        where: { id: args.id },
        data: {
          title: args.title,
          desc: args.desc,
          img: args.img,
        },
      });
      return updatedCategory;
    },
  }),

  /**
   * deleteCategory
   * Deletes a Category by ID. Requires a logged-in ADMIN.
   */
  deleteCategory: t.prismaField({
    type: "Category",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      // Must be ADMIN
      if (context.user.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to perform this action");
      }

      // Delete the category
      const deletedCategory = await prisma.category.delete({
        where: { id: args.id },
      });
      return deletedCategory;
    },
  }),
}));
