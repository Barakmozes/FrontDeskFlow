import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import Footer from "./components/Common/Footer";
import Header from "./components/Common/Header";
import SideBar from "./components/Common/SideBar";

import Categories from "./components/Home/Categories";
import HeroSection from "./components/Home/HeroSection";
import MenuSection from "./components/Home/MenuSection";
import Promos from "./components/Home/Promos";

import ZoneRestaurant from "./components/Restaurant_interface/zone_restaurant";
import RoomBoard from "./components/Restaurant_interface/RoomBoard/RoomBoard";
import HousekeepingBoard from "./components/Restaurant_interface/Housekeeping/HousekeepingBoard";
import OperationsBoard from "./components/Restaurant_interface/Operations/OperationsBoard";

import ReceptionClient from "./(dashboard)/dashboard/reception/reception.client";
import RoomServiceClient from "./(dashboard)/dashboard/room-service/room-service.client";

import { User } from "@prisma/client";

const isStaffRole = (role: unknown): boolean =>
  role === "WAITER" || role === "MANAGER" || role === "ADMIN";

function StaffSection({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="px-6 pt-6">
        <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle ? (
              <p className="text-xs text-gray-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pt-3">{children}</div>
    </section>
  );
}

export default async function Home() {
  const user = (await getCurrentUser()) as unknown as (User & { role?: string }) | null;
  const isStaff = isStaffRole(user?.role);

  return (
    <main className="min-h-screen">
      <Header user={user as User} />
      <SideBar user={user as User} />

      {/* ---------------- PUBLIC CUSTOMER HOME ---------------- */}
      {!isStaff ? (
        <>
          <HeroSection />
          <Promos />
          <Categories />
          <MenuSection user={user as User} />
          <Footer />
        </>
      ) : (
        <>
          {/* ---------------- STAFF HOME / HOTEL OPS HUB ---------------- */}
          <div className="px-6 pt-6">
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Hotel Operations
                  </h1>
                  <p className="text-sm text-gray-600">
                    Ordered by the hotel workflow: Room Board → Daily Ops → Housekeeping → Operations → Room Service.
                  </p>
                </div>

                {/* Quick links to full dashboard pages (tasks / customer registration etc.) */}
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/dashboard/room-board"
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    Open Room Board
                  </Link>

                  <Link
                    href="/dashboard/reception"
                    className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
                  >
                    Open Daily Ops
                  </Link>

                  <Link
                    href="/dashboard/customers/register"
                    className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white hover:bg-black"
                  >
                    Register Customer
                  </Link>

                  <Link
                    href="/dashboard/tasks"
                    className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    Tasks
                  </Link>
                </div>
              </div>

              {/* In-page navigation (because we render the boards below) */}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
                <a className="hover:underline" href="#room-board">Room Board</a>
                <a className="hover:underline" href="#daily-ops">Daily Ops</a>
                <a className="hover:underline" href="#housekeeping">Housekeeping</a>
                <a className="hover:underline" href="#operations">Operations</a>
                <a className="hover:underline" href="#room-service">Room Service</a>
                <a className="hover:underline" href="#restaurant-zone">Zone hotel</a>
              </div>
            </div>
          </div>

          {/* 1) Room Board (module #1) */}
          <StaffSection
            id="room-board"
            title="1) Room Board"
            subtitle="Main board after login: rooms × dates, reservation blocks, availability and collision prevention."
          >
            <RoomBoard staffEmail={user?.email ?? null} />
          </StaffSection>

          {/* 2) Reception Daily Ops (Arrivals/Departures/In-house) */}
          <StaffSection
            id="daily-ops"
            title="2) Reception — Daily Ops"
            subtitle="Arrivals today / Departures today / In‑house guests with quick actions."
          >
            <ReceptionClient staffEmail={user?.email ?? null} />
          </StaffSection>

          {/* 3) Housekeeping (cleaning workflow + list) */}
          <StaffSection
            id="housekeeping"
            title="3) Housekeeping Board"
            subtitle="Cleaning list + room readiness workflow (driven by HK tags in specialRequests)."
          >
            <HousekeepingBoard />
          </StaffSection>

          {/* 4) Operations */}
          <StaffSection
            id="operations"
            title="4) Operations Board"
            subtitle="Operational overview (manager-style actions/monitoring)."
          >
            <OperationsBoard currentUserEmail={user?.email ?? null} />
          </StaffSection>

          {/* 5) Room Service */}
          <StaffSection
            id="room-service"
            title="5) Room Service"
            subtitle="Create room-service orders using the existing menu/order mechanics."
          >
            <RoomServiceClient />
          </StaffSection>

          {/* 6) Legacy restaurant/table UI (optional) */}
          <StaffSection
            id="restaurant-zone"
            title="6) Zone Restaurant (Legacy)"
            subtitle="Existing restaurant/table interface (kept last so Hotel Ops stays primary)."
          >
            <ZoneRestaurant />
          </StaffSection>

          <Footer />
        </>
      )}
    </main>
  );
}
