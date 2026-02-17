"use client";

import { Menu, Transition } from "@headlessui/react";
import Link from "next/link";
import { Fragment, useMemo } from "react";
import { HiOutlineArrowRightOnRectangle, HiOutlineUserPlus } from "react-icons/hi2";
import Image from "next/image";
import { User } from "@prisma/client";
import { signOut } from "next-auth/react";
import { useCartStore } from "@/lib/store";

type AccountDropDownProps = {
  user: User;
};

export default function AccountDropDown({ user }: AccountDropDownProps) {
  const resetCart = useCartStore((state) => state.resetCart);

  const handleSignOut = () => {
    if (["ADMIN", "MANAGER", "WAITER"].includes(user?.role ?? "")) {
      resetCart();
    }
    signOut({ callbackUrl: "/" });
  };

  /**
   * ✅ Mobile/robustness:
   * - Prevents runtime issues when user.image is null/empty by providing a tiny inline SVG fallback.
   * - No new assets or libraries.
   */
  const avatarSrc = useMemo(() => {
    const url = (user?.image ?? "").trim();
    if (url) return url;

    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
        <rect width="100%" height="100%" rx="32" ry="32" fill="#E2E8F0"/>
        <circle cx="32" cy="26" r="12" fill="#94A3B8"/>
        <path d="M12 58c4-12 16-18 20-18s16 6 20 18" fill="#94A3B8"/>
      </svg>`
    );

    return `data:image/svg+xml,${svg}`;
  }, [user?.image]);

  const displayName = (user?.name ?? "").trim() || "Account";

  return (
    <Menu as="div" className="relative inline-block text-left">
      {({ open }) => (
        <>
          <Menu.Button
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-gray-500 hover:bg-green-200 hover:text-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
            aria-label="Open account menu"
          >
            <Image
              src={avatarSrc}
              alt="avatar"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
            />
          </Menu.Button>

          <Transition
            show={open} // ✅ boolean from HeadlessUI Menu
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            {/* ✅ Mobile-safe:
               - max width clamps to viewport
               - max height clamps to viewport with internal scroll
               - safe-area padding so last item never sits behind browser UI
            */}
            <Menu.Items className="absolute right-0 z-50 mt-3 w-56 max-w-[calc(100vw-1rem)] origin-top-right divide-y divide-gray-100 rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none max-h-[calc(100dvh-6rem)] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+4px)]">
              <div className="px-1 py-1">
                {/* Header row (not an actionable menu item) */}
                <div className="flex items-center gap-3 rounded-lg px-3 py-3 min-h-[44px] text-gray-700">
                  <Image
                    src={avatarSrc}
                    alt="avatar"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{displayName}</span>
                </div>

                <Menu.Item>
                  {({ active }) => (
                    <Link
                      href="/user"
                      className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-gray-500 transition-all ${
                        active
                          ? "bg-green-200 text-green-600"
                          : "hover:bg-green-200 hover:text-green-600"
                      }`}
                    >
                      <HiOutlineUserPlus className="h-6 w-6 shrink-0" />
                      <span className="text-sm font-medium">Profile</span>
                    </Link>
                  )}
                </Menu.Item>

                <Menu.Item>
                  {({ active }) => (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className={`flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-gray-500 transition-all ${
                        active
                          ? "bg-green-200 text-green-600"
                          : "hover:bg-green-200 hover:text-green-600"
                      }`}
                    >
                      <HiOutlineArrowRightOnRectangle className="h-6 w-6 shrink-0" />
                      <span className="text-sm font-medium">Sign Out</span>
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </>
      )}
    </Menu>
  );
}
