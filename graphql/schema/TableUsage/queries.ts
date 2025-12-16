// graphql/schema/TableUsage/queries.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Pothos Prisma Object: TableUsage
 *
 * Reflects the Prisma TableUsage model:
 *  - id: String (cuid)
 *  - tableId: String (unique)
 *  - table: Table (relation)
 *  - usageCount: Int (default: 0)
 *  - lastUsed: DateTime?
 *  - createdAt: DateTime
 *  - updatedAt: DateTime
 *
 * We do not define the "Table" object here; we only reference it.
 */
builder.prismaObject("TableUsage", {
  fields: (t) => ({
    id: t.exposeID("id"),
    tableId: t.exposeString("tableId"),
    table: t.relation("table"), // relation to Table
    usageCount: t.exposeInt("usageCount"),
    lastUsed: t.expose("lastUsed", { type: "DateTime", nullable: true }),

    // Timestamps
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

/**
 * Query Fields for TableUsage
 */
builder.queryFields((t) => ({
  /**
   * getTableUsage
   * Fetches a TableUsage by its "id". Throws if not found.
   */
  getTableUsage: t.prismaField({
    type: "TableUsage",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      const usage = await prisma.tableUsage.findUnique({
        ...query,
        where: { id: args.id },
      });
      if (!usage) {
        throw new GraphQLError("TableUsage not found");
      }
      return usage;
    },
  }),

  /**
   * getTableUsageByTable
   * Fetches a TableUsage by "tableId". Each table has at most one usage record.
   */
  getTableUsageByTable: t.prismaField({
    type: "TableUsage",
    nullable: true,
    args: {
      tableId: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      return prisma.tableUsage.findUnique({
        ...query,
        where: { tableId: args.tableId },
      });
    },
  }),

  /**
   * getAllTableUsages
   * Fetches all TableUsage records. Typically restricted to ADMIN or Manager.
   */
  getAllTableUsages: t.prismaField({
    type: ["TableUsage"],
    resolve: async (query, _parent, _args, contextPromise) => {
      const context = await contextPromise;

      // Optional role check: only ADMIN or MANAGER can see all usage stats
      if (
        context.user?.role !== "ADMIN" &&
        context.user?.role !== "MANAGER"
      ) {
        throw new GraphQLError(
          "You are not authorized to view all table usage records"
        );
      }

      return prisma.tableUsage.findMany({ ...query });
    },
  }),
}));
