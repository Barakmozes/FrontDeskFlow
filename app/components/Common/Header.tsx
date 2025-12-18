"use client";

import React, { useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@urql/next";
import { HiBars3, HiXMark, HiOutlineShoppingCart } from "react-icons/hi2";

import { useCartStore, useLoginModal, useSideBarDrawer } from "@/lib/store";
import { useHotelStore } from "@/lib/AreaStore";
import AccountDropDown from "./AccountDropDown";

import { GetAreasNameDescriptionDocument } from "@/graphql/generated";

import type { User } from "@prisma/client";
import type {
  GetAreasNameDescriptionQuery,
  GetAreasNameDescriptionQueryVariables,
} from "@/graphql/generated";

type HeaderProps = {
  /**
   * Keep compatibility with your old Header API.
   * If you later move user to a Zustand store, you can pass `user={undefined}`.
   */
  user?: User | null;
};

/**
 * Header (Hotel mode)
 * - Hotels are backed by Areas in the DB
 * - Selecting a hotel sets `selectedHotel` in Zustand (useHotelStore)
 * - Adds Cart icon + count (menus) from useCartStore
 */
export default function Header({ user }: HeaderProps) {
  const { onOpen } = useLoginModal();
  const { onSideBarOpen } = useSideBarDrawer();

  // ✅ Cart / menus
  const { menus } = useCartStore();

  useEffect(() => {
    // If your cart store uses `skipHydration: true`, this ensures the badge count is correct on first load.
    // (Matches how other components in the project handle it.)
    useCartStore.persist.rehydrate();
  }, []);

  const cartCount = useMemo(() => {
    if (!menus || menus.length === 0) return 0;
    // Prefer total quantity (more accurate than menus.length)
    return menus.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  }, [menus]);

  const hotels = useHotelStore((s) => s.hotels);
  const setHotels = useHotelStore((s) => s.setHotels);
  const selectedHotel = useHotelStore((s) => s.selectedHotel);
  const setSelectedHotel = useHotelStore((s) => s.setSelectedHotel);
  const clearSelectedHotel = useHotelStore((s) => s.clearSelectedHotel);

  const [{ data, fetching, error }] = useQuery<
    GetAreasNameDescriptionQuery,
    GetAreasNameDescriptionQueryVariables
  >({
    query: GetAreasNameDescriptionDocument,
    variables: {
      orderBy: { createdAt: "asc" as any },
    },
  });

  const fetchedHotels = useMemo(() => {
    const list = data?.getAreasNameDescription ?? [];
    return list.map((h) => ({
      id: h.id,
      name: h.name,
      floorPlanImage: h.floorPlanImage ?? null,
      createdAt: h.createdAt,
    }));
  }, [data]);

  useEffect(() => {
    if (fetchedHotels.length === 0) return;
    setHotels(fetchedHotels);
  }, [fetchedHotels, setHotels]);

  const canSeeHotelSelector = Boolean(user); // internal staff only

  const handleHotelSelect = useCallback(
    (hotelIdOrName: string) => {
      setSelectedHotel(hotelIdOrName);
      requestAnimationFrame(() => {
        document.getElementById("top_header")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
    [setSelectedHotel]
  );

  return (
    <header
      id="top_header"
      className="sticky top-0 z-20 bg-white border-b shadow-sm"
      role="banner"
    >
      <div className="px-4 md:px-12 py-3">
        {/* Row 1 */}
        <div className="flex items-center justify-between gap-3">
          {/* Left cluster: Sidebar + Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="p-2 rounded-full bg-slate-200 text-gray-600 hover:bg-green-200 hover:text-green-700 transition"
              onClick={onSideBarOpen}
              aria-label="Open sidebar"
            >
              <HiBars3 size={22} />
            </button>

            <div className="flex flex-col leading-tight">
              <Link
                href="/"
                className="text-base md:text-lg font-semibold text-gray-900 hover:text-gray-950"
                aria-label="Go to dashboard"
              >
                FrontDeskFlow
              </Link>

              <div className="text-xs text-gray-500">
                {selectedHotel?.name ? (
                  <>
                    Hotel:{" "}
                    <span className="font-medium text-gray-700">
                      {selectedHotel.name}
                    </span>
                  </>
                ) : (
                  "Select a hotel to view rooms"
                )}
              </div>
            </div>
          </div>

          {/* Right cluster: Clear + Cart + Account/Login */}
          <div className="flex items-center gap-2">
            {selectedHotel ? (
              <button
                type="button"
                onClick={clearSelectedHotel}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-800 hover:bg-gray-200 transition"
                aria-label="Clear selected hotel"
                title="Clear selected hotel"
              >
                <HiXMark size={18} />
                Clear
              </button>
            ) : null}

            {/* ✅ Cart */}
            {user ? (
              <Link
                href="/cart"
                className="relative p-2 rounded-full bg-slate-200 text-gray-600 hover:bg-green-200 hover:text-green-700 transition"
                aria-label={`View cart (${cartCount} items)`}
                title="View cart"
              >
                <HiOutlineShoppingCart size={22} />
                <span className="sr-only">{cartCount} items in cart</span>

                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold bg-white text-green-700 border border-green-200 flex items-center justify-center"
                >
                  {cartCount}
                </span>
              </Link>
            ) : (
              // If not logged in, keep UX safe (cart page expects a user in your current codebase)
              <button
                type="button"
                onClick={onOpen}
                className="relative p-2 rounded-full bg-slate-200 text-gray-600 hover:bg-green-200 hover:text-green-700 transition"
                aria-label={`Login to view cart (${cartCount} items)`}
                title="Login to view cart"
              >
                <HiOutlineShoppingCart size={22} />
                <span className="sr-only">{cartCount} items in cart</span>

                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold bg-white text-green-700 border border-green-200 flex items-center justify-center"
                >
                  {cartCount}
                </span>
              </button>
            )}

            {user ? (
              <AccountDropDown user={user} />
            ) : (
              <button
                type="button"
                className="px-4 py-2 rounded-full bg-slate-200 text-gray-700 hover:bg-green-200 hover:text-green-700 transition"
                onClick={onOpen}
                aria-label="Login"
              >
                Login
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Hotel selector */}
        {canSeeHotelSelector ? (
          <div className="mt-3">
            {fetching ? (
              <div className="text-sm text-gray-500">Loading hotels…</div>
            ) : error ? (
              <div className="text-sm text-red-600">
                Failed to load hotels: {error.message}
              </div>
            ) : hotels.length === 0 ? (
              <div className="text-sm text-gray-500">
                No hotels found. Create an Area (Hotel) first.
              </div>
            ) : (
              <>
                {/* Desktop: pill buttons */}
                <div className="hidden md:flex flex-wrap items-center gap-2">
                  {hotels.map((hotel) => {
                    const active = selectedHotel?.id === hotel.id;
                    return (
                      <button
                        key={hotel.id}
                        type="button"
                        onClick={() => handleHotelSelect(hotel.id)}
                        className={[
                          "px-3 py-2 rounded-lg text-sm transition shadow-sm",
                          active
                            ? "bg-green-600 text-white"
                            : "bg-gray-100 text-gray-800 hover:bg-green-100",
                        ].join(" ")}
                        aria-label={`Select hotel: ${hotel.name}`}
                        aria-pressed={active}
                      >
                        {hotel.name}
                      </button>
                    );
                  })}
                </div>

                {/* Mobile: select */}
                <div className="md:hidden">
                  <label className="sr-only" htmlFor="hotelSelect">
                    Select a hotel
                  </label>
                  <select
                    id="hotelSelect"
                    className="w-full p-2 border rounded-lg text-gray-700 bg-white focus:ring focus:ring-green-300"
                    value={selectedHotel?.id ?? ""}
                    onChange={(e) => handleHotelSelect(e.target.value)}
                    aria-label="Select a hotel"
                    style={{
                      backgroundColor: selectedHotel
                        ? "rgba(144, 238, 144, 0.15)"
                        : "white",
                    }}
                  >
                    <option value="" disabled>
                      Select a Hotel
                    </option>
                    {hotels.map((hotel) => (
                      <option key={hotel.id} value={hotel.id}>
                        {hotel.name}
                      </option>
                    ))}
                  </select>

                  {selectedHotel ? (
                    <button
                      type="button"
                      onClick={clearSelectedHotel}
                      className="mt-2 w-full px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-800 hover:bg-gray-200 transition"
                      aria-label="Clear selected hotel"
                    >
                      Clear selection
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
