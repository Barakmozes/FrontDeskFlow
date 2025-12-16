// graphql/schema/Profile/mutations.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Mutation Fields for Profile
 */
builder.mutationFields((t) => ({
  /**
   * addProfile
   * Creates a new Profile for the logged-in user, if it doesn't already exist.
   * Enforces that a user can only create a profile matching their own email.
   */
  addProfile: t.prismaField({
    type: "Profile",
    args: {
      email: t.arg.string({ required: true }),
      phone: t.arg.string(),
      img: t.arg.string(),
      name: t.arg.string(),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      // Await the context if it's a promise
      const context = await contextPromise;

      // Must be logged in
      const isLoggedIn = !context.user;
      if (isLoggedIn) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // Can only add a profile that belongs to the current user
      if (context.user?.email !== args.email) {
        throw new GraphQLError("You cannot add a profile that is not yours");
      }

      // Check if a profile for this email already exists
      const existingProfile = await prisma.profile.findFirst({
        ...query,
        where: { email: args.email },
      });

      // If a profile already exists, return it
      if (existingProfile) {
        return existingProfile;
      }

      // Otherwise, create a new profile
      const newProfile = await prisma.profile.create({
        data: {
          email: args.email,
          phone: args.phone ?? undefined,
          img: args.img ?? undefined,
          name: args.name ?? undefined,
        },
      });
      return newProfile;
    },
  }),

  /**
   * editProfile
   * Updates an existing Profile by email.
   * Requires user to be logged in.
   */
  editProfile: t.prismaField({
    type: "Profile",
    args: {
      email: t.arg.string({ required: true }),
      phone: t.arg.string(),
      img: t.arg.string(),
      name: t.arg.string(),
    },
    resolve: async (_query, _parent, args, contextPromise) => {
      const context = await contextPromise;

      // Must be logged in
      const isLoggedIn = context.user;
      if (!isLoggedIn) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // Perform the update
      const updatedProfile = await prisma.profile.update({
        where: { email: args.email },
        data: {
          email: args.email, // Keep the email the same
          phone: args.phone ?? undefined,
          img: args.img ?? undefined,
          name: args.name ?? undefined,
        },
      });

      return updatedProfile;
    },
  }),
}));
