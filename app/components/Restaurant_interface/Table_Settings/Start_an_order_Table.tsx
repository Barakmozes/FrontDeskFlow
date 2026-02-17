"use client";

import React from "react";
import { useRouter } from "next/navigation";

import type { RoomInStore } from "@/lib/AreaStore";

interface OpenRoomProps {
  room: RoomInStore;
  /**
   * Optional route template.
   * Example: "/dashboard/rooms/:id" will become "/dashboard/rooms/<roomId>".
   */
  routeTemplate?: string;
}

/**
 * OpenRoom
 * Replaces the old "Start order" action from the restaurant UI.
 *
 * NOTE: This is purely client-side. You can point it to any future
 * room/booking/guest page you implement.
 */
const OpenRoom: React.FC<OpenRoomProps> = ({ room, routeTemplate }) => {
  const router = useRouter();

  const href = (routeTemplate ?? "/dashboard/rooms/:id").replace(":id", room.id);

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="text-sm bg-gray-200 text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-300 transition"
      aria-label="Open room profile"
    >
      Open Room Profile
    </button>
  );
};

export default OpenRoom;
