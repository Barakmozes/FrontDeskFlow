// graphql/schema/Table/queries.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Pothos Prisma Object: Table
 *
 * Reflects the Prisma Table model:
 *  - id: String (cuid)
 *  - tableNumber: Int (unique)
 *  - diners: Int
 *  - reserved: Boolean (default: false)
 *  - specialRequests: String[] (default: [])
 *  - position: Json
 *  - areaId: String
 *  - area: Area (relation)
 *  - reservations: Reservation[] (relation)
 *  - orders: Order[] (relation)
 *  - usageStats: TableUsage? (relation)
 *  - createdAt: DateTime
 *  - updatedAt: DateTime
 *
 * We do not define the related objects (Area, Reservation, etc.) here.
 */
builder.prismaObject("Table", {
  fields: (t) => ({
    id: t.exposeID("id"),
    tableNumber: t.exposeInt("tableNumber"),
    diners: t.exposeInt("diners"),
    reserved: t.exposeBoolean("reserved"),
    specialRequests: t.exposeStringList("specialRequests"),
    position: t.expose("position", { type: "JSON" }),
    areaId: t.exposeString("areaId"),

    // Relations (not defining the objects themselves here)
    area: t.relation("area"),
    reservations: t.relation("reservations"),
    orders: t.relation("orders"),
    usageStats: t.relation("usageStats", { nullable: true }),

    // Timestamps
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

/**
 * Query Fields for Table
 */
builder.queryFields((t) => ({
  /**
   * getTable
   * Fetch a single table by ID. Throws an error if not found.
   */
  getTable: t.prismaField({
    type: "Table",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      const table = await prisma.table.findUnique({
        ...query,
        where: { id: args.id },
      });
      if (!table) {
        throw new GraphQLError("Table not found");
      }
      return table;
    },
  }),

  /**
   * getTables
   * Fetch all tables. Optionally, you could add pagination or filters.
   */
  getTables: t.prismaField({
    type: ["Table"],
    resolve: async (query) => {
      return prisma.table.findMany({ ...query });
    },
  }),

  /**
   * getAvailableTables
   * Fetch all tables where 'reserved' = false.
   */
  getAvailableTables: t.prismaField({
    type: ["Table"],
    resolve: async (query) => {
      return prisma.table.findMany({
        ...query,
        where: { reserved: false },
      });
    },
  }),



  /**
   * getTableOrder
   * Returns a list of "active" orders for the specified table,
   * along with all order details. 
   * 
   * "Active" typically excludes COMPLETED and CANCELLED orders,
   * but includes PENDING, PREPARING, etc.
   */
  getTableOrder: t.prismaField({
    // We return an array of Order objects
    type: ["Order"],
    args: {
      tableId: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      // Define which statuses you consider "active"
      // (Add or remove as needed for your business logic)
      const activeStatuses ="PREPARING";

      // Fetch all orders for the table that match these statuses
      const orders = await prisma.order.findMany({
        ...query, // includes any selected fields from the Order object type
        where: {
          tableId: args.tableId,
          status: activeStatuses,
        },
        // Example: Sort by most recent orders first
        orderBy: { createdAt: "desc" },
      });

      // If no orders found, you could optionally throw an error or return empty array
      if (!orders.length) {
        // Optionally:
        // throw new GraphQLError("No active orders found for this table");
      }

      return orders;
    },
  }),
  /**
   * getTableReservations
   * Returns reservations for a specific table that fall on the given *calendar date*.
   * Expects a date string like "2024-06-01". The code calculates start/end of that day.
   */
  getTableReservations: t.prismaField({
    type: ["Reservation"], // Return a list of Reservation objects
    args: {
      tableId: t.arg.string({ required: true }),
      date: t.arg.string({ required: true }), // or use a Date scalar if available
    },
    resolve: async (query, _parent, args) => {
      // Convert the date argument to a JS Date (midnight on that date)
      const startOfDay = new Date(args.date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(args.date);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch reservations where reservationTime is within [startOfDay, endOfDay]
      const reservations = await prisma.reservation.findMany({
        ...query,
        where: {
          tableId: args.tableId,
          reservationTime: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: {
          reservationTime: "asc",
        },
      });

      return reservations;
    },
  }),


}));

