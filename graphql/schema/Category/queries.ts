// graphql/schema/Category/queries.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Pothos Prisma Object: Category
 *
 * Reflects the Prisma Category model:
 *  - id: String (cuid)
 *  - title: String (unique)
 *  - desc: String
 *  - img: String
 */
builder.prismaObject("Category", {
  fields: (t) => ({
    id: t.exposeID("id"),
    title: t.exposeString("title"),
    desc: t.exposeString("desc"),
    img: t.exposeString("img"),
  }),
});

/**
 * Query Fields for Category
 */
builder.queryFields((t) => ({
  /**
   * getCategory
   * Fetches a single Category by ID. Throws error if not found.
   */
  getCategory: t.prismaField({
    type: "Category",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      const category = await prisma.category.findFirst({
        ...query,
        where: { id: args.id },
      });
      if (!category) {
        throw new GraphQLError("Category not found");
      }
      return category;
    },
  }),

  /**
   * getCategories
   * Fetches all Categories as a list.
   */
  getCategories: t.prismaField({
    type: ["Category"],
    resolve: (query) => prisma.category.findMany(query),
  }),
}));
