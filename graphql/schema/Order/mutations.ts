// graphql/schema/Order/mutations.ts

import { GraphQLError } from "graphql";
import prisma from "@/lib/prisma";
import { builder } from "@/graphql/builder";
import { OrderStatus } from "./enum";

/**
 * Mutation Fields for Order
 */
builder.mutationFields((t) => ({
  /**
   * addOrder
   * Creates a new order if one does not already exist with the given orderNumber.
   * Requires a user to be logged in.
   */
  addOrder: t.prismaField({
    type: "Order",
    args: {
      orderNumber: t.arg.string({ required: true }),
      cart: t.arg({ type: "JSON", required: true }),
      userName: t.arg.string({ required: true }),
      userEmail: t.arg.string({ required: true }),
      userPhone: t.arg.string({ required: true }),
      paymentToken: t.arg.string(),
      deliveryAddress: t.arg.string({ required: true }),
      deliveryFee: t.arg.float({ required: true }),
      serviceFee: t.arg.float({ required: true }),
      note: t.arg.string(),
      discount: t.arg.float(),
      total: t.arg.float({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      const isLoggedIn = !context.user;
      if (isLoggedIn) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // Check if an order with the same orderNumber already exists
      const existingOrder = await prisma.order.findFirst({
        ...query,
        where: { orderNumber: args.orderNumber },
      });
      if (existingOrder) {
        // If it exists, return it instead of creating a new one
        return existingOrder;
      }

      // Otherwise, create a new order
      const newOrder = await prisma.order.create({
        data: {
          orderNumber: args.orderNumber,
          cart: args.cart,
          userName: args.userName,
          userEmail: args.userEmail,
          userPhone: args.userPhone,
          paymentToken: args.paymentToken ?? undefined,
          deliveryAddress: args.deliveryAddress,
          deliveryFee: args.deliveryFee,
          serviceFee: args.serviceFee,
          note: args.note ?? undefined,
          discount: args.discount ?? undefined,
          total: args.total,
        },
      });
      return newOrder;
    },
  }),

  /**
   * editOrder
   * Updates the status (and optional deliveryTime) of an existing order by "id".
   * Requires a user to be logged in.
   */
  editOrder: t.prismaField({
    type: "Order",
    args: {
      id: t.arg.string({ required: true }),
      status: t.arg({ type: OrderStatus, required: true }),
      deliveryTime: t.arg({ type: "DateTime" }),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // Update order
      const updatedOrder = await prisma.order.update({
        where: { id: args.id },
        data: {
          status: args.status,
          deliveryTime: args.deliveryTime ?? undefined,
        },
      });
      return updatedOrder;
    },
  }),

  /**
   * editOrderOnPayment
   * Updates the payment information of an existing order by "id",
   * setting it as paid and optionally updating the paymentToken.
   * Requires a user to be logged in.
   */
  editOrderOnPayment: t.prismaField({
    type: "Order",
    args: {
      id: t.arg.string({ required: true }),
      paymentToken: t.arg.string(),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // Mark order as paid, and optionally update paymentToken
      const updatedOrder = await prisma.order.update({
        where: { id: args.id },
        data: {
          paymentToken: args.paymentToken ?? undefined,
          paid: true,
        },
      });
      return updatedOrder;
    },
  }),
}));
