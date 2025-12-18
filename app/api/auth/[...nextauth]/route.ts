import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Adapter } from "next-auth/adapters";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,

  // ✅ Username + Password only
  providers: [
    CredentialsProvider({
      name: "Username & Password",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        const username = credentials?.username?.trim();
        const password = credentials?.password;

        if (!username || !password) return null;

        // username == User.email
        const user = await prisma.user.findUnique({
          where: { email: username },
          include: { accounts: true },
        });

        if (!user || !user.email) return null;

        // Find our "credentials" account that stores the password hash
        const credAccount = user.accounts.find(
          (a) => a.provider === "credentials"
        );

        const passwordHash = credAccount?.refresh_token; // <- we store hash here
        if (!passwordHash) return null;

        const ok = await bcrypt.compare(password, passwordHash);
        if (!ok) return null;

        // Must return an object with "id"
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role, // you already use this in jwt callback
        } as any;
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET as string,
  pages: { signIn: "/login" },

  session: { strategy: "jwt" },

  callbacks: {
    // Optional safety: since you want ONLY credentials
    async signIn({ account }) {
      return account?.provider === "credentials";
    },

    jwt: async ({ token, user }) => {
      if (user) token.role = (user as any).role;
      return token;
    },

    async session({ session, token }) {
      if (session.user) (session.user as any).role = token.role;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
