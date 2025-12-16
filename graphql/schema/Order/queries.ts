// graphql/schema/Order/queries.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";
import { OrderStatus } from "./enum";

/**
 * Pothos Prisma Object: Order
 * 
 * Maps the Prisma "Order" model fields to GraphQL, including:
 *  - Basic fields: id, orderNumber, cart, orderDate, deliveryTime, ...
 *  - Relations: user (relation to the User model)
 *  - Additional fields: note, discount, total, etc.
 */
builder.prismaObject("Order", {
  fields: (t) => ({
    id: t.exposeString("id"),
    orderNumber: t.exposeString("orderNumber"),
    cart: t.expose("cart", { type: "JSON" }),
    orderDate: t.expose("orderDate", { type: "DateTime" }),
    deliveryTime: t.expose("deliveryTime", { type: "DateTime", nullable: true }),
    userName: t.exposeString("userName"),
    user: t.relation("user"),
    userEmail: t.exposeString("userEmail"),
    userPhone: t.exposeString("userPhone"),
    paymentToken: t.exposeString("paymentToken", { nullable: true }),
    paid: t.exposeBoolean("paid"),
    deliveryAddress: t.exposeString("deliveryAddress"),
    deliveryFee: t.exposeFloat("deliveryFee"),
    serviceFee: t.exposeFloat("serviceFee"),
    status: t.expose("status", { type: OrderStatus }),
    note: t.exposeString("note", { nullable: true }),
    discount: t.exposeFloat("discount", { nullable: true }),
    total: t.exposeFloat("total"),
    // NEW fields for the table relationship
    tableId: t.exposeString("tableId", { nullable: true }),
    table: t.relation("table", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

/**
 * Query Fields for Order
 */
builder.queryFields((t) => ({
  /**
   * getOrder
   * Fetch a single order by its "id".
   * Requires a user to be logged in (any role).
   */
  getOrder: t.prismaField({
    type: "Order",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Check if user is logged in
      const isLoggedIn = !context.user;
      if (isLoggedIn) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // Find the order by ID
      const order = await prisma.order.findFirst({
        ...query,
        where: { id: args.id },
      });
      if (!order) {
        throw new GraphQLError("Order not found");
      }
      return order;
    },
  }),

  /**
   * getOrders
   * Fetch all orders (with pagination/cursor support).
   * Requires ADMIN role to view.
   */
  getOrders: t.prismaConnection({
    type: "Order",
    cursor: "id",
    resolve: async (query, _parent, _args, contextPromise) => {
      const context = await contextPromise;

      // Must be ADMIN
      if (context.user?.role !== "ADMIN") {
        throw new GraphQLError("You don't have permission to perform this action");
      }

      // Return all orders
      const adminOrders = await prisma.order.findMany({ ...query });
      return adminOrders;
    },
  }),
}));
