import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

import {
  CUSTOMER_SOURCES,
  encodeCustomerRegistrationTracking,
  isProbablyValidPhone,
  normalizePhone,
  type CustomerSource,
  type ConsentMethod,
} from "@/lib/customerTracking";

export const runtime = "nodejs";

type RegisterCustomerBody = {
  email: string;
  name: string;
  phone?: string | null;

  source: CustomerSource;

  consent: {
    smsOperational: boolean;
    emailOperational: boolean;
    marketing: boolean;
    method?: ConsentMethod;
  };

  // Client-measurable context (helps Reports/attribution later)
  context?: {
    page?: string | null;
    referrer?: string | null;
    locale?: string | null;
    timezone?: string | null;
    userAgent?: string | null;
    utm?: {
      utmSource?: string | null;
      utmMedium?: string | null;
      utmCampaign?: string | null;
      utmTerm?: string | null;
      utmContent?: string | null;
    };
  };
};

const isValidEmail = (email: string): boolean => {
  // simple + robust enough for now
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

export async function POST(req: Request) {
  // ---- Auth (staff-only) ----
  const session = await getServerSession(authOptions);
  const actorEmail = session?.user?.email ?? null;

  if (!actorEmail) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const actor = await prisma.user.findUnique({ where: { email: actorEmail } });
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  /**
   * Hotel roles are planned (Reception / Manager / Admin / Housekeeping / Accounting).
   * For now, the existing enum is restaurant-based, so we gate by:
   * - ADMIN / MANAGER / WAITER (WAITER == Reception in current convention)
   */
  const allowedRoles = new Set(["ADMIN", "MANAGER", "WAITER"]);
  if (!allowedRoles.has(actor.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // ---- Body parse ----
  let body: RegisterCustomerBody;
  try {
    body = (await req.json()) as RegisterCustomerBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const source = body.source;

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }
  if (!name || name.length < 2) {
    return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
  }
  if (!CUSTOMER_SOURCES.includes(source)) {
    return NextResponse.json({ ok: false, error: "Invalid source" }, { status: 400 });
  }

  // Phone + consent validation
  const rawPhone = body.phone ? String(body.phone) : "";
  const normalizedPhone = rawPhone ? normalizePhone(rawPhone) : "";

  if (body.consent?.smsOperational && !normalizedPhone) {
    return NextResponse.json(
      { ok: false, error: "SMS consent requires a phone number" },
      { status: 400 }
    );
  }
  if (normalizedPhone && !isProbablyValidPhone(normalizedPhone)) {
    return NextResponse.json({ ok: false, error: "Invalid phone number" }, { status: 400 });
  }

  const capturedAt = new Date().toISOString();
  const consentMethod: ConsentMethod = body.consent?.method ?? "VERBAL";

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Detect whether we created or updated (helps analytics later)
      const existingUser = await tx.user.findUnique({ where: { email } });
      const existingProfile = await tx.profile.findUnique({ where: { email } });

      // 1) Ensure User exists (customer)
      const user = existingUser
        ? await tx.user.update({
            where: { email },
            data: { name },
          })
        : await tx.user.create({
            data: {
              email,
              name,
              role: "USER",
            },
          });

      // 2) Ensure Profile exists (phone lives here)
      const profile = existingProfile
        ? await tx.profile.update({
            where: { email },
            data: {
              name,
              phone: normalizedPhone || null,
            },
          })
        : await tx.profile.create({
            data: {
              email,
              name,
              phone: normalizedPhone || null,
            },
          });

      // 3) Create an audit/tracking notification on the customer (encoded tags)
      const trackingMessage = encodeCustomerRegistrationTracking(
        {
          version: 1,
          event: "CUSTOMER_REGISTERED",
          source,

          actorEmail,
          actorRole: actor.role,

          customerEmail: email,
          customerName: name,
          phone: normalizedPhone || null,

          consent: {
            smsOperational: !!body.consent?.smsOperational,
            emailOperational: !!body.consent?.emailOperational,
            marketing: !!body.consent?.marketing,
            method: consentMethod,
            capturedAt,
          },

          context: {
            page: body.context?.page ?? null,
            referrer: body.context?.referrer ?? null,
            locale: body.context?.locale ?? null,
            timezone: body.context?.timezone ?? null,
            userAgent: body.context?.userAgent ?? null,
            utm: body.context?.utm ?? undefined,
          },
        },
        {
          // this line is visible in Notifications UI; tags remain parseable below it
          summary: `Customer registered (${source}) by ${actorEmail}`,
        }
      );

      const trackingNotification = await tx.notification.create({
        data: {
          userEmail: email,
          type: "CUSTOMER_REGISTRATION",
          priority: "LOW",
          status: "UNREAD",
          message: trackingMessage,
        },
      });

      return {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        profile: { id: profile.id, email: profile.email, name: profile.name, phone: profile.phone },
        created: { user: !existingUser, profile: !existingProfile },
        trackingNotificationId: trackingNotification.id,
      };
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err: any) {
    // Important: don’t leak raw DB errors to the client
    return NextResponse.json(
      { ok: false, error: "Failed to register customer" },
      { status: 500 }
    );
  }
}
