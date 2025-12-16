// graphql/schema/User/queries.ts

import prisma from "@/lib/prisma";
import { builder } from "@/graphql/builder";
import { Role } from "./enum";
import { GraphQLError } from "graphql";

// -------------------------------------
// Pothos Prisma Object: User
// -------------------------------------
builder.prismaObject("User", {
  fields: (t) => ({
    // Basic fields
    id: t.exposeID("id"),
    name: t.exposeString("name", { nullable: true }),
    email: t.exposeString("email", { nullable: true }),
    image: t.exposeString("image", { nullable: true }),
    role: t.expose("role", { type: Role }),

    // Relations
    profile: t.relation("profile", { nullable: true }),
    favorite: t.relation("favorite", { nullable: true }),
    order: t.relation("order"), // referencing the "order" relation from the Prisma schema
    reservations: t.relation("reservations", { nullable: true }),
    notifications: t.relation("notifications", { nullable: true }),
    waitlists: t.relation("waitlists", { nullable: true }),
    createdReservations: t.relation("createdReservations", { nullable: true }),

    // Timestamps
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

// -------------------------------------
// Query Fields
// -------------------------------------
builder.queryFields((t) => ({
  /**
   * getUsers
   * Fetches all users. Requires ADMIN privileges.
   */
  getUsers: t.prismaField({
    type: ["User"],
    resolve: async (query, _parent, _args, contextPromise) => {
      // If "context" is a promise, await it:
      const context = await contextPromise;

      // Check if user is ADMIN
      if (context.user?.role !== "ADMIN") {
        throw new GraphQLError("You don't have permission to perform this action");
      }

      // Fetch all users
      const adminUsers = await prisma.user.findMany({
        ...query,
      });
      return adminUsers;
    },
  }),

  /**
   * getUser
   * Fetches a specific user by email. Must be logged in as USER or ADMIN.
   */
  getUser: t.prismaField({
    type: "User",
    args: {
      email: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      // If "context" is a promise, await it:
      const context = await contextPromise;
      const userRole = context.user?.role;

      // Permission check
      if (userRole !== "USER" && userRole !== "ADMIN" && userRole !== "MANAGER"&& userRole !== "WAITER") {
        throw new GraphQLError("You must be logged in as a user or an admin to perform this action");
      }

      // Fetch the requested user
      const user = await prisma.user.findUniqueOrThrow({
        ...query,
        where: { email: args.email },
      });

      return user;
    },
  }),
}));
