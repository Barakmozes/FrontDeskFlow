// graphql/schema/Profile/queries.ts

import prisma from "@/lib/prisma";
import { GraphQLError } from "graphql";
import { builder } from "@/graphql/builder";

/**
 * Pothos Prisma Object: Profile
 *
 * Maps to the Prisma Profile model:
 *  - id (String, cuid)
 *  - phone (String?)
 *  - img (String?)
 *  - name (String?)
 *  - email (String, unique, used as foreign key to User.email)
 *
 *  The relation "email: t.relation('user')" means we return
 *  the associated User object for this profile's email.
 */
builder.prismaObject("Profile", {
  fields: (t) => ({
    id: t.exposeID("id"),
    phone: t.exposeString("phone", { nullable: true }),
    img: t.exposeString("img", { nullable: true }),
    name: t.exposeString("name", { nullable: true }),
    email: t.relation("user"), // By design, references the user
  }),
});

/**
 * Query Fields for Profile
 */
builder.queryFields((t) => ({
  /**
   * getProfile
   * Fetch a single profile by the 'email' field.
   * Requires the user to be logged in.
   */
  getProfile: t.prismaField({
    type: "Profile",
    args: {
      email: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, contextPromise) => {
      // Await the context if it's a promise
      const context = await contextPromise;

      // If there is NO logged-in user => throw
      const isLoggedIn = !context.user;
      if (isLoggedIn) {
        throw new GraphQLError("You must be logged in to perform this action");
      }

      // Fetch and return the profile
      const profile = await prisma.profile.findUniqueOrThrow({
        ...query,
        where: { email: args.email },
      });
      return profile;
    },
  }),

  /**
   * getProfiles
   * Fetch all profiles. Requires ADMIN role.
   */
  getProfiles: t.prismaField({
    type: ["Profile"],
    resolve: async (query, _parent, _args, contextPromise) => {
      const context = await contextPromise;

      // Only admins can access all profiles
      if (context.user?.role !== "ADMIN") {
        throw new GraphQLError("You don't have permission to perform this action");
      }

      const adminProfiles = await prisma.profile.findMany({
        ...query,
      });
      return adminProfiles;
    },
  }),
}));
