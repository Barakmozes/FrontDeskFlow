import type { Role } from "@prisma/client";

export type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: string | null; // אם אתה מסריאלייז ללקוח
  image: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
};