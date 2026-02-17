import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Adapter } from "next-auth/adapters";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NotificationPriority, NotificationStatus } from "@prisma/client";

const WELCOME_NOTIFICATION_TYPE = "WELCOME";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,

  providers: [
    /**
     * 🔐 Username + Password
     */
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

        const user = await prisma.user.findUnique({
          where: { email: username },
          include: { accounts: true },
        });

        if (!user || !user.email) return null;

        const credAccount = user.accounts.find(
          (a) => a.provider === "credentials"
        );

        const passwordHash = credAccount?.refresh_token;
        if (!passwordHash) return null;

        const ok = await bcrypt.compare(password, passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        } as any;
      },
    }),

    /**
     * 🌍 Google
     */
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),

    /**
     * 📘 Facebook
     */
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID as string,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET as string,

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
  },

  jwt: {
    secret: process.env.NEXTAUTH_JWT_SECRET as string,
  },

  /**
   * ✅ יצירת Welcome Notification רק ביצירת משתמש חדש
   */
  events: {
    createUser: async ({ user }) => {
      const email = user.email ?? null;
      if (!email) return;

      try {
        const exists = await prisma.notification.findFirst({
          where: { userEmail: email, type: WELCOME_NOTIFICATION_TYPE },
          select: { id: true },
        });

        if (exists) return;

        await prisma.notification.create({
          data: {
            userEmail: email,
            type: WELCOME_NOTIFICATION_TYPE,
            message:
              "Welcome to StarManag 👋 Start by browsing the menu and placing your first order.",
            priority: NotificationPriority.NORMAL,
            status: NotificationStatus.UNREAD,
          },
        });
      } catch (err) {
        console.error(
          "[NextAuth][createUser] failed to create welcome notification:",
          err
        );
      }
    },
  },

  callbacks: {
    /**
     * מאפשר גם Credentials וגם OAuth
     */
    async signIn() {
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
