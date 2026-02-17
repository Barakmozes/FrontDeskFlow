// app/(dashboard)/dashboard/settings/SettingsControlCenter.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useQuery } from "@urql/next";

import { GetAreasDocument, type GetAreasQuery } from "@/graphql/generated";

import HotelPricingSettings from "./HotelPricingSettings";
import HotelPricingAndPolicy from "./HotelPricingAndPolicy";
import RestaurantDetails from "./RestaurantDetails";
import OpeningHours from "./OpeningHours";
import AdminCategories from "./AdminCategories";

type SectionKey = "PRICING" | "POLICY" | "PROPERTY" | "HOURS" | "CATEGORIES";

const SECTIONS: Array<{
  key: SectionKey;
  title: string;
  subtitle: string;
}> = [
  {
    key: "PRICING",
    title: "Pricing",
    subtitle: "Base nightly rate per hotel + per-room override rates",
  },
  {
    key: "POLICY",
    title: "Check-in & Checkout Policy",
    subtitle: "Times, enforcement rules, and auto-post room charges",
  },
  {
    key: "PROPERTY",
    title: "Property Details",
    subtitle: "Contact details & address (stored as tags, schema-safe)",
  },
  {
    key: "HOURS",
    title: "Opening Hours",
    subtitle: "Restaurant / Breakfast / Room service hours per hotel",
  },
  {
    key: "CATEGORIES",
    title: "Menu Categories",
    subtitle: "Existing category controls (kept for restaurant module)",
  },
];

export default function SettingsControlCenter({
  currentUserEmail,
  currentUserRole,
}: {
  currentUserEmail: string | null;
  currentUserRole: string | null;
}) {
  const [activeSection, setActiveSection] = useState<SectionKey>("PRICING");
  const [selectedHotelId, setSelectedHotelId] = useState<string>("");

  const [{ data, fetching, error }, reexecuteQuery] = useQuery<GetAreasQuery>({
    query: GetAreasDocument,
    requestPolicy: "cache-and-network",
  });

  // Client-side sort (because the query has no variables like orderBy)
  const hotels = useMemo(() => {
    const list = data?.getAreas ?? [];
    return [...list].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [data?.getAreas]);

  // Ensure we always have a selected hotel if hotels exist
  useEffect(() => {
    if (hotels.length === 0) return;

    // If none selected OR selected id no longer exists, pick first.
    const exists = selectedHotelId
      ? hotels.some((h) => h.id === selectedHotelId)
      : false;

    if (!selectedHotelId || !exists) {
      setSelectedHotelId(hotels[0].id);
    }
  }, [selectedHotelId, hotels]);

  const selectedHotel = useMemo(() => {
    return hotels.find((h) => h.id === selectedHotelId) ?? null;
  }, [hotels, selectedHotelId]);

  const refresh = () => {
    reexecuteQuery({ requestPolicy: "network-only" });
    toast.success("Settings refreshed.");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Left “control” rail */}
      <aside className="lg:col-span-3">
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b px-4 py-4">
            <div className="text-sm font-semibold text-slate-900">
              Control Center
            </div>
            <div className="text-xs text-slate-500">
              Logged in:{" "}
              <span className="font-medium">{currentUserEmail ?? "—"}</span>
              {" · "}
              Role: <span className="font-medium">{currentUserRole ?? "—"}</span>
            </div>
          </div>

          <div className="p-4">
            <label className="block text-xs text-slate-600 mb-1">Hotel</label>
            <select
              value={selectedHotelId}
              onChange={(e) => setSelectedHotelId(e.target.value)}
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              disabled={fetching}
            >
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>

            <button
              onClick={refresh}
              className="mt-3 w-full rounded-lg bg-black px-3 py-2 text-sm text-white hover:opacity-90 disabled:bg-gray-300"
              disabled={fetching}
              type="button"
            >
              Refresh data
            </button>
          </div>

          <div className="border-t">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveSection(s.key)}
                className={[
                  "w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-slate-50",
                  activeSection === s.key
                    ? "bg-slate-900 text-white hover:bg-slate-900"
                    : "bg-white",
                ].join(" ")}
              >
                <div className="text-sm font-semibold">{s.title}</div>
                <div
                  className={`text-xs ${
                    activeSection === s.key
                      ? "text-slate-200"
                      : "text-slate-500"
                  }`}
                >
                  {s.subtitle}
                </div>
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border bg-red-50 p-3 text-sm text-red-700">
            Failed to load hotels: {error.message}
          </div>
        ) : null}
      </aside>

      {/* Main content */}
      <section className="lg:col-span-9 space-y-4">
        {!selectedHotel ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            {fetching ? (
              <div className="text-sm text-slate-500">Loading hotels…</div>
            ) : (
              <div className="text-sm text-slate-600">
                No hotel found. Create an Area (hotel) first.
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Top info bar */}
            <div className="rounded-2xl border bg-white shadow-sm p-5">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">Selected hotel</div>
                  <div className="text-xl font-bold text-slate-900">
                    {selectedHotel.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Rooms in this hotel:{" "}
                    <span className="font-semibold">
                      {selectedHotel.tables?.length ?? 0}
                    </span>
                  </div>
                </div>

             
              </div>
            </div>

            {/* Sections */}
            {activeSection === "PRICING" ? (
              <HotelPricingSettings hotel={selectedHotel} onSaved={refresh} />
            ) : null}

            {activeSection === "POLICY" ? (
              <HotelPricingAndPolicy hotel={selectedHotel} onSaved={refresh} />
            ) : null}

            {activeSection === "PROPERTY" ? (
              <RestaurantDetails hotel={selectedHotel} onSaved={refresh} />
            ) : null}

            {activeSection === "HOURS" ? (
              <OpeningHours hotel={selectedHotel} onSaved={refresh} />
            ) : null}

            {activeSection === "CATEGORIES" ? (
              <div className="rounded-2xl border bg-white shadow-sm p-5">
                <div className="text-lg font-semibold text-slate-900">
                  Menu Categories
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  This section remains for your restaurant module. (Hotel modules
                  do not depend on it.)
                </div>
                <div className="mt-6">
                  <AdminCategories />
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
