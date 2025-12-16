// graphql/schema/Table/mutations.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Mutation Fields for Table
 */
// In your builder config or an appropriate file:

export const UpdateManyTablesInput = builder.inputType("UpdateManyTablesInput", {
  fields: (t) => ({
    id: t.string({ required: true }),
    // The fields you want to allow updating in bulk:
    position: t.field({ type: "JSON" }),  // optional
    areaId: t.string(),                   // optional
    reserved: t.boolean(),                // optional
    diners: t.int(),                      // optional
    specialRequests: t.stringList(),      // optional
    // etc...
  }),
});
builder.mutationFields((t) => ({
  /**
   * addTable
   * Creates a new table. Requires an ADMIN user (or staff) to manage table creation.
   */
  addTable: t.prismaField({
    type: "Table",
    args: {
      tableNumber: t.arg.int({ required: true }),
      diners: t.arg.int({ required: true }),
      position: t.arg({ type: "JSON"}),
      areaId: t.arg.string({ required: true }),
      reserved: t.arg.boolean(), // optional
      specialRequests: t.arg.stringList(), // optional
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Check user authentication
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      // Check user authorization (ADMIN recommended for table creation)
      if (!["ADMIN", "MANAGER"].includes(context.user?.role ?? ""))  {
        throw new GraphQLError("You are not authorized to add tables");
      }

      // Check if the tableNumber is already taken
      const existing = await prisma.table.findFirst({
        where: { tableNumber: args.tableNumber },
      });
      if (existing) {
        throw new GraphQLError("A table with this tableNumber already exists");
      }

      // Create a new table
      const newTable = await prisma.table.create({
        ...query,
        data: {
          tableNumber: args.tableNumber,
          diners: args.diners,
          position: args.position,
          areaId: args.areaId,
          reserved: args.reserved ?? false,
          specialRequests: args.specialRequests ?? [],
        },
      });
      return newTable;
    },
  }),

  /**
   * editTable
   * Updates a table's fields by ID. Requires ADMIN permissions for full edits.
   */
  editTable: t.prismaField({
    type: "Table",
    args: {
      id: t.arg.string({ required: true }),
      tableNumber: t.arg.int(),
      diners: t.arg.int(),
      reserved: t.arg.boolean(),
      position: t.arg({ type: "JSON" }),
      specialRequests: t.arg.stringList(),
      areaId: t.arg.string(),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      if (!["ADMIN", "MANAGER"].includes(context.user?.role ?? "")) {
        throw new GraphQLError("You are not authorized to edit tables");
      }

      // Attempt to update
      const updatedTable = await prisma.table.update({
        where: { id: args.id },
        data: {
          tableNumber: args.tableNumber ?? undefined,
          diners: args.diners ?? undefined,
          reserved: args.reserved ?? undefined,
          position: args.position ?? undefined,
          specialRequests: args.specialRequests ?? undefined,
          areaId: args.areaId ?? undefined,
        },
      });
      return updatedTable;
    },
  }),

  /**
   * deleteTable
   * Deletes a table by ID. Usually, only ADMIN can delete a table.
   */
  deleteTable: t.prismaField({
    type: "Table",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      if (!["ADMIN", "MANAGER"].includes(context.user?.role ?? "")){
        throw new GraphQLError("You are not authorized to delete tables");
      }

      const deletedTable = await prisma.table.delete({
        where: { id: args.id },
      });
      return deletedTable;
    },
  }),

  /**
   * toggleTableReservation
   * Allows toggling the 'reserved' status of a table. Depending on your app,
   * you might let staff or admins do this. If you want only Admin, keep the check.
   */
  toggleTableReservation: t.prismaField({
    type: "Table",
    args: {
      id: t.arg.string({ required: true }),
      reserved: t.arg.boolean({ required: true }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      if  (!["ADMIN", "MANAGER", "WAITER"].includes(context.user?.role ?? "")) {
        throw new GraphQLError("You are not authorized to modify reservation status");
      }

      const table = await prisma.table.findUnique({ where: { id: args.id } });
      if (!table) {
        throw new GraphQLError("Table not found");
      }

      // Update the reserved field
      const updatedTable = await prisma.table.update({
        where: { id: args.id },
        data: { reserved: args.reserved },
      });
      return updatedTable;
    },
  }),


  /**
   * addOrderToTable
   * Creates a new Order linked to a specific table inside the restaurant.
   * Only staff roles (e.g. WAITER, MANAGER, ADMIN) should typically create orders.
   */
  addOrderToTable: t.prismaField({
    type: "Order", // Return a newly created Order object
    args: {
      tableId: t.arg.string({ required: true }),
      orderNumber: t.arg.string({ required: true }),  // or generate automatically
      cart: t.arg({ type: "JSON", required: true }),  // items, e.g. [{menuId: X, qty: Y}, ...]
      userName: t.arg.string({ required: true }),     // e.g. name of the customer or "Guest"
      userEmail: t.arg.string({ required: true }),    // store user email for tracking (can be "guest@local" if unknown)
      serviceFee: t.arg.float({ required: true }),
      note: t.arg.string(),
      discount: t.arg.float(),
      total: t.arg.float({ required: true }),
      paymentToken: t.arg.string(),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // 1. Authorization checks
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }
      // Example: limit to staff roles
      if  (!["ADMIN", "MANAGER", "WAITER"].includes(context.user?.role ?? "")) {
        throw new GraphQLError("You are not authorized to add an order to a table");
      }

      // 2. Verify the table actually exists
      const table = await prisma.table.findUnique({ where: { id: args.tableId } });
      if (!table) {
        throw new GraphQLError("Table not found");
      }

      // 3. Create the new Order
      //    Typically set an initial status (e.g. PENDING, PREPARING) for a new in-restaurant order
      const newOrder = await prisma.order.create({
        ...query,
        data: {
          orderNumber: args.orderNumber,
          cart: args.cart, // Ensure it's an array if needed
          userName: args.userName,
          userEmail: args.userEmail,
          tableId: args.tableId, // Link to the table
          status: "PREPARING",   // or "PENDING" or whichever status you use
          serviceFee: args.serviceFee,
          note: args.note ?? undefined,
          discount: args.discount ?? undefined,
          total: args.total,
          paymentToken: args.paymentToken ?? undefined,
        },
      });

      return newOrder;
    },
  }),


/**
 * movePositionTable
 * Updates only the "position" field of a specific table by "id" (String/UUID).
 * Use this if your Table model has an 'id' field as the unique primary key.
 */
movePositionTable: t.prismaField({
  type: "Table",
  // Now expect an 'id' argument, which is stable even if tableNumber changes
  args: {
    id: t.arg.string({ required: true }), // or t.arg.id({ required: true }) if you prefer
    position: t.arg({ type: "JSON", required: true }),
  },
  resolve: async (query, _parent, args, contextPromise) => {
    const context = await contextPromise;

    // 1) Authorization checks
    if (!context.user) {
      throw new GraphQLError("You must be logged in to perform this action");
    }
    if (!["ADMIN", "MANAGER"].includes(context.user?.role ?? "")) {
      throw new GraphQLError("You are not authorized to move the table");
    }

    // 2) Verify the table exists by id
    const table = await prisma.table.findUnique({
      ...query,
      where: { id: args.id },
    });
    if (!table) {
      throw new GraphQLError(`Table with id=${args.id} not found`);
    }

    // 3) Update only the 'position' field
    const updatedTable = await prisma.table.update({
      ...query,
      where: { id: args.id },
      data: {
        position: args.position,
      },
    });

    return updatedTable;
  },
}),


updateManyTables: t.prismaField({
  // Return an array of updated Table records
  type: ["Table"],

  // Single argument = array of table updates
  args: {
    updates: t.arg({
      type: [UpdateManyTablesInput],
      required: true,
    }),
  },

  // The resolver function
  resolve: async (query, _parent, args, contextPromise) => {
    const context = await contextPromise;

    // 1) Authorization checks
    if (!context.user) {
      throw new GraphQLError("You must be logged in to perform this action");
    }
    // e.g., only MANAGER or ADMIN can do bulk updates
    if (!["ADMIN", "MANAGER"].includes(context.user?.role??"")) {
      throw new GraphQLError("You are not authorized to update tables in bulk");
    }

    // 2) For concurrency and correctness, we use a transaction
    //    We'll store the updated records so we can return them
    const updatedTables = await prisma.$transaction(
      args.updates.map((tableInput) => {
        // Each item MUST have `id`. All other fields are optional.
        const { id, position, areaId, reserved, diners, specialRequests } = tableInput;

        return prisma.table.update({
          ...query,  // optional if you want to use Prisma 'select' from builder
          where: { id },
          data: {
            // Only update each field if passed in
            position: position ?? undefined,
            areaId: areaId ?? undefined,
            reserved: reserved ?? undefined,
            diners: diners ?? undefined,
            specialRequests: specialRequests ?? undefined,
          },
        });
      })
    );

    // 3) Return the updated Table records to the client
    return updatedTables;
  },
}),


}));

