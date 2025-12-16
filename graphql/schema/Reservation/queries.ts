// graphql/schema/Reservation/queries.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";
import { ReservationStatus } from "./enum";

/**
 * Pothos Prisma Object: Reservation
 *
 * Reflects the Prisma Reservation model now referencing user by email:
 *  - id: String (cuid)
 *  - userEmail: String -> user: User (by email)
 *  - tableId: String -> table: Table
 *  - status: ReservationStatus @default(PENDING)
 *  - reservationTime: DateTime
 *  - numOfDiners: Int
 *  - createdBy: Role
 *  - createdByUserEmail: String? -> createdByUser: User? (by email)
 *  - createdAt, updatedAt: DateTime
 */
builder.prismaObject("Reservation", {
  fields: (t) => ({
    id: t.exposeID("id"),

    // Relations
    user: t.relation("user"),
    table: t.relation("table"),
    createdByUser: t.relation("createdByUser", { nullable: true }),

    // Basic Fields
    userEmail: t.exposeString("userEmail"),
    tableId: t.exposeString("tableId"),
    status: t.expose("status", { type: ReservationStatus }),
    reservationTime: t.expose("reservationTime", { type: "DateTime" }),
    numOfDiners: t.exposeInt("numOfDiners"),

    // Who created the reservation & role at creation
    createdBy: t.exposeString("createdBy"),
    createdByUserEmail: t.exposeString("createdByUserEmail", { nullable: true }),

    // Timestamps
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    updatedAt: t.expose("updatedAt", { type: "DateTime" }),
  }),
});

/**
 * Query Fields for Reservation
 */
builder.queryFields((t) => ({
  /**
   * getReservation
   * Fetch a single Reservation by its "id". Throws if not found.
   */
  getReservation: t.prismaField({
    type: "Reservation",
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args) => {
      const reservation = await prisma.reservation.findUnique({
        ...query,
        where: { id: args.id },
      });
      if (!reservation) {
        throw new GraphQLError("Reservation not found");
      }
      return reservation;
    },
  }),

  /**
   * getReservations
   * Fetch all reservations, optionally filtered by status.
   * Typically limited to ADMIN or MANAGER, but adapt as needed.
   */
  getReservations: t.prismaField({
    type: ["Reservation"],
    args: {
      status: t.arg({ type: ReservationStatus, required: false }), // optional
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Only ADMIN or MANAGER can fetch all
      if (
        context.user?.role !== "ADMIN" &&
        context.user?.role !== "MANAGER"
      ) {
        throw new GraphQLError("You are not authorized to view all reservations");
      }

      const whereClause = args.status
        ? { status: args.status as any }
        : undefined;

      return prisma.reservation.findMany({
        ...query,
        where: whereClause,
      });
    },
  }),

  /**
   * getUserReservations
   * Fetch reservations for a specific userEmail. Must be that user or ADMIN/MANAGER.
   */
  getUserReservations: t.prismaField({
    type: ["Reservation"],
    args: {
      userEmail: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      const context = await contextPromise;
      const currentUser = context.user;
      if (!currentUser) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // If the current user is not ADMIN/MANAGER and doesn't match userEmail => deny
      const isAdminOrManager =
        currentUser.role === "ADMIN" || currentUser.role === "MANAGER";
      if (!isAdminOrManager && currentUser.email !== args.userEmail) {
        throw new GraphQLError("You are not authorized to view these reservations");
      }

      return prisma.reservation.findMany({
        ...query,
        where: { userEmail: args.userEmail },
      });
    },
  }),
}));
