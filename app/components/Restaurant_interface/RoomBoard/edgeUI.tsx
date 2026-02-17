// app/components/Restaurant_interface/RoomBoard/edgeUI.tsx
"use client";

import React from "react";
import { ReservationStatus } from "@/graphql/generated";
import type { HkRoomStatus } from "@/lib/housekeepingTags";

export function Pill({
  label,
  tone = "gray",
}: {
  label: string;
  tone?: "gray" | "green" | "amber" | "blue" | "red";
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : tone === "blue"
      ? "bg-blue-100 text-blue-800"
      : tone === "red"
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-800";

  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] ${cls}`}>{label}</span>;
}

export function reservationTone(status: ReservationStatus): "amber" | "blue" | "gray" | "green" {
  switch (status) {
    case ReservationStatus.Pending:
      return "amber";
    case ReservationStatus.Confirmed:
      return "blue";
    case ReservationStatus.Completed:
      return "green";
    case ReservationStatus.Cancelled:
    default:
      return "gray";
  }
}

export function hkTone(status: HkRoomStatus): "green" | "amber" | "blue" | "red" {
  switch (status) {
    case "CLEAN":
      return "green";
    case "DIRTY":
      return "amber";
    case "MAINTENANCE":
      return "blue";
    case "OUT_OF_ORDER":
    default:
      return "red";
  }
}
