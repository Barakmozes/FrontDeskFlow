import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function isAdmin(role: unknown) {
  return role === "ADMIN";
}

function normalizeUsername(input: unknown) {
  return String(input ?? "").trim();
}

function validateRole(input: unknown): Role {
  const r = String(input ?? "USER") as Role;
  const allowed: Role[] = ["USER", "ADMIN", "DELIVERY", "WAITER", "CHEF", "MANAGER"];
  if (!allowed.includes(r)) return "USER";
  return r;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // "username" will be stored in User.email (no schema change)
  const username = normalizeUsername(body.username);
  const name = body.name ? String(body.name).trim() : null;
  const role = validateRole(body.role);

  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (username.length < 2) {
    return NextResponse.json(
      { error: "Username must be at least 2 characters." },
      { status: 400 }
    );
  }

  if (password.length < 4) {
    return NextResponse.json(
      { error: "Password must be at least 4 characters." },
      { status: 400 }
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { email: username },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ error: "Username already exists." }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 12);

  // Transaction ensures we don't create User without Account
  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: username,
        name,
        role,
      },
      select: { id: true, email: true, name: true, role: true, image: true, createdAt: true },
    });

    await tx.account.create({
      data: {
        userId: user.id,
        type: "credentials",
        provider: "credentials",
        providerAccountId: user.id,
        refresh_token: hash, // <- password bcrypt hash stored here (no schema change)
      },
    });

    return user;
  });

  return NextResponse.json({ user: created }, { status: 201 });
}
