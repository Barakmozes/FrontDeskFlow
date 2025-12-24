"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation } from "@urql/next";

import {
  EditAreaDocument,
  type EditAreaMutation,
  type EditAreaMutationVariables,
  type GetAreasQuery,
} from "@/graphql/generated";

import { parseHotelSettings, applyHotelSettingsPatch } from "@/lib/hotelSettingsTags";

type Hotel = GetAreasQuery["getAreas"][number];

const TAG_BREAKFAST = "HOURS_BREAKFAST";
const TAG_RESTAURANT = "HOURS_RESTAURANT";
const TAG_ROOM_SERVICE = "HOURS_ROOM_SERVICE";

function isValidHoursValue(v: string) {
  const s = v.trim();
  if (!s) return true;
  if (/^(24\/7|24h)$/i.test(s)) return true;

  // Allow "HH:MM-HH:MM" OR multiple ranges "HH:MM-HH:MM, HH:MM-HH:MM"
  const ranges = s.split(",").map((x) => x.trim()).filter(Boolean);
  if (ranges.length === 0) return true;

  const re = /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/;
  return ranges.every((r) => re.test(r));
}

export default function OpeningHours({
  hotel,
  onSaved,
}: {
  hotel: Hotel;
  onSaved: () => void;
}) {
  const parsed = useMemo(() => parseHotelSettings(hotel.description ?? ""), [hotel.description, hotel.id]);

  const [breakfast, setBreakfast] = useState(parsed.tags[TAG_BREAKFAST] ?? "");
  const [restaurant, setRestaurant] = useState(parsed.tags[TAG_RESTAURANT] ?? "");
  const [roomService, setRoomService] = useState(parsed.tags[TAG_ROOM_SERVICE] ?? "");

  useEffect(() => {
    const p = parseHotelSettings(hotel.description ?? "");
    setBreakfast(p.tags[TAG_BREAKFAST] ?? "");
    setRestaurant(p.tags[TAG_RESTAURANT] ?? "");
    setRoomService(p.tags[TAG_ROOM_SERVICE] ?? "");
  }, [hotel.id, hotel.description]);

  const [{ fetching }, editArea] = useMutation<EditAreaMutation, EditAreaMutationVariables>(EditAreaDocument);

  const dirty = useMemo(() => {
    const p = parseHotelSettings(hotel.description ?? "");
    return (
      (breakfast.trim() || "") !== (p.tags[TAG_BREAKFAST] ?? "").trim() ||
      (restaurant.trim() || "") !== (p.tags[TAG_RESTAURANT] ?? "").trim() ||
      (roomService.trim() || "") !== (p.tags[TAG_ROOM_SERVICE] ?? "").trim()
    );
  }, [hotel.description, breakfast, restaurant, roomService]);

  async function save() {
    if (!isValidHoursValue(breakfast) || !isValidHoursValue(restaurant) || !isValidHoursValue(roomService)) {
      toast.error("Invalid hours format. Use 07:00-10:30, multiple ranges with commas, or 24/7.");
      return;
    }

    if (!dirty) {
      toast.success("No changes to save.");
      return;
    }

    const nextDescription = applyHotelSettingsPatch(hotel.description ?? "", {
      tags: {
        [TAG_BREAKFAST]: breakfast.trim() || null,
        [TAG_RESTAURANT]: restaurant.trim() || null,
        [TAG_ROOM_SERVICE]: roomService.trim() || null,
      },
    });

    const res = await editArea({
      editAreaId: hotel.id,
      description: nextDescription,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to save hours.");
      return;
    }

    toast.success("Opening hours saved.");
    onSaved();
  }

  function resetToSaved() {
    const p = parseHotelSettings(hotel.description ?? "");
    setBreakfast(p.tags[TAG_BREAKFAST] ?? "");
    setRestaurant(p.tags[TAG_RESTAURANT] ?? "");
    setRoomService(p.tags[TAG_ROOM_SERVICE] ?? "");
  }

  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <div className="text-lg font-semibold text-slate-900">Opening Hours</div>
        <div className="text-sm text-slate-600">
          Stored as tags in <span className="font-mono">Area.description</span> (per hotel).
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-xs text-slate-600">Breakfast</label>
            <input
              value={breakfast}
              onChange={(e) => setBreakfast(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="07:00-10:30"
            />
            {!isValidHoursValue(breakfast) ? (
              <div className="text-[11px] text-red-600 mt-1">Format: 07:00-10:30, commas for multiple ranges, or 24/7.</div>
            ) : (
              <div className="text-[11px] text-slate-500 mt-1">Example: 07:00-10:30 or 07:00-10:30, 18:00-20:00</div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-600">Restaurant</label>
            <input
              value={restaurant}
              onChange={(e) => setRestaurant(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="12:00-22:00"
            />
            {!isValidHoursValue(restaurant) ? (
              <div className="text-[11px] text-red-600 mt-1">Format: 12:00-22:00 or 24/7.</div>
            ) : (
              <div className="text-[11px] text-slate-500 mt-1">Leave empty if not applicable.</div>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-600">Room service</label>
            <input
              value={roomService}
              onChange={(e) => setRoomService(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="24/7 or 18:00-02:00"
            />
            {!isValidHoursValue(roomService) ? (
              <div className="text-[11px] text-red-600 mt-1">Format: 24/7 or 18:00-02:00</div>
            ) : (
              <div className="text-[11px] text-slate-500 mt-1">Displayed in Reception “Hotel settings summary”.</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={resetToSaved}
            disabled={fetching || !dirty}
            className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Reset
          </button>

          <button
            onClick={save}
            disabled={fetching || !dirty}
            className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:bg-gray-300"
          >
            {fetching ? "Saving…" : "Save hours"}
          </button>
        </div>
      </div>
    </div>
  );
}
