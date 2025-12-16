// graphql/schema/GridConfig/queries.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Pothos Prisma Object: GridConfig
 *
 * Reflects the Prisma GridConfig model:
 *  - id: String (cuid)
 *  - areaId: String (unique)
 *  - area: Area (relation)
 *  - gridSize: Int (default: 20)
 *  - createdAt: DateTime
 *  - updatedAt: DateTime
 *
 * We do not define the "Area" object here, we only reference it.
 */
builder.prismaObject("GridConfig", {
  fields: (t) => ({
    id: t.exposeID("id"),
    areaId: t.exposeString("areaId"),
    // Relation to Area, not defining the Area object here
    area: t.relation("area"),
    gridSize: t.exposeInt("gridSize"),

    // Timestamps
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

/**
 * Query Fields for GridConfig
 */
builder.queryFields((t) => ({
  /**
   * getGridConfig
   * Fetch a single GridConfig by "id". Throws error if not found.
   */
  getGridConfig: t.prismaField({
    type: "GridConfig",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      const gridConfig = await prisma.gridConfig.findUnique({
        ...query,
        where: { id: args.id },
      });
      if (!gridConfig) {
        throw new GraphQLError("GridConfig not found");
      }
      return gridConfig;
    },
  }),

  /**
   * getGridConfigByArea
   * Fetch a single GridConfig by "areaId".
   * Because areaId is unique, at most one config will match.
   */
  getGridConfigByArea: t.prismaField({
    type: "GridConfig",
    nullable: true,
    args: {
      areaId: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      return prisma.gridConfig.findUnique({
        ...query,
        where: { areaId: args.areaId },
      });
    },
  }),

  /**
   * getGridConfigs
   * Fetch all GridConfig records. Typically ADMIN-only, but adapt as needed.
   */
  getGridConfigs: t.prismaField({
    type: ["GridConfig"],
    resolve: async (query, _parent, _args, contextPromise) => {
      const context = await contextPromise;

      // Optional check: only ADMIN can view all configs
      if (context.user?.role !== "ADMIN") {
        throw new GraphQLError("You are not authorized to view all grid configs");
      }

      return prisma.gridConfig.findMany({ ...query });
    },
  }),
}));
