import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function validateRole(input: unknown): Role | null {
  const r = String(input ?? "") as Role;
  const allowed: Role[] = ["USER", "ADMIN", "DELIVERY", "WAITER", "CHEF", "MANAGER"];
  return allowed.includes(r) ? r : null;
}

export async function PATCH(req: Request, ctx: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const role = validateRole(body.role);
  if (!role) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: ctx.params.userId },
    data: { role },
    select: { id: true, email: true, name: true, role: true, image: true, createdAt: true },
  });

  return NextResponse.json({ user: updated }, { status: 200 });
}
