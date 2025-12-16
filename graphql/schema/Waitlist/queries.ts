// graphql/schema/Waitlist/queries.ts

import prisma from "@/lib/prisma";
import { builder } from "@/graphql/builder";
import { GraphQLError } from "graphql";
import { WaitlistStatus } from "./enum";

/**
 * Pothos Prisma Object: Waitlist
 *
 * Reflects the Prisma Waitlist model referencing user by email:
 *  - id: String (cuid)
 *  - userEmail: String -> user: User
 *  - areaId: String -> area: Area
 *  - numOfDiners: Int
 *  - status: WaitlistStatus @default(WAITING)
 *  - calledAt: DateTime?
 *  - seatedAt: DateTime?
 *  - priority: Int?
 *  - createdAt, updatedAt: DateTime
 */
builder.prismaObject("Waitlist", {
  fields: (t) => ({
    id: t.exposeID("id"),
    userEmail: t.exposeString("userEmail"),
    areaId: t.exposeString("areaId"),
    numOfDiners: t.exposeInt("numOfDiners"),
    status: t.expose("status", { type: WaitlistStatus }),
    calledAt: t.expose("calledAt", { type: "DateTime", nullable: true }),
    seatedAt: t.expose("seatedAt", { type: "DateTime", nullable: true }),
    priority: t.exposeInt("priority", { nullable: true }),

    // Relations
    user: t.relation("user"),
    area: t.relation("area"),

    // Timestamps
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

/**
 * Query Fields for Waitlist
 */
builder.queryFields((t) => ({
  /**
   * getWaitlist
   * Fetches a single waitlist entry by ID. Throws if not found.
   */
  getWaitlist: t.prismaField({
    type: "Waitlist",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      const entry = await prisma.waitlist.findUnique({
        ...query,
        where: { id: args.id },
      });
      if (!entry) {
        throw new GraphQLError("Waitlist entry not found");
      }
      return entry;
    },
  }),

  /**
   * getWaitlists
   * Fetch all waitlist entries. Typically ADMIN or MANAGER might have permission.
   */
  getWaitlists: t.prismaField({
    type: ["Waitlist"],
    resolve: async (query, _parent, _args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to view the waitlist");
      }

      // Example: Only ADMIN or MANAGER can list the entire waitlist
      if (
        context.user.role !== "ADMIN" &&
        context.user.role !== "MANAGER"
      ) {
        throw new GraphQLError("You are not authorized to view the entire waitlist");
      }

      return prisma.waitlist.findMany({ ...query });
    },
  }),

  /**
   * getUserWaitlistEntries
   * Fetch all waitlist entries for a specific userEmail.
   * The user can view their own entries, or an ADMIN/MANAGER can view any user's.
   */
  getUserWaitlistEntries: t.prismaField({
    type: ["Waitlist"],
    args: {
      userEmail: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      if (!context.user) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // If not admin/manager and not the same user => reject
      const isAdminOrManager =
        context.user.role === "ADMIN" || context.user.role === "MANAGER";
      if (!isAdminOrManager && context.user.email !== args.userEmail) {
        throw new GraphQLError("You are not authorized to view these waitlist entries");
      }

      return prisma.waitlist.findMany({
        ...query,
        where: { userEmail: args.userEmail },
      });
    },
  }),
}));
