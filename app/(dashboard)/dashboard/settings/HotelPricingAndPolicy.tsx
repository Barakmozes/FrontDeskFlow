"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";

import {
  GetAreasDocument,
  type GetAreasQuery,
  type GetAreasQueryVariables,
  EditAreaDocument,
  type EditAreaMutation,
  type EditAreaMutationVariables,
} from "@/graphql/generated";

import { parseHotelSettings, serializeHotelSettings, summarizeOpeningHours } from "@/lib/hotelSettingsTags";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium text-gray-600 mb-1">{children}</div>;
}
type Props = {
  hotel: any; // או הטיפוס המדויק שלך
  onSaved: () => void;
};
export default function HotelPricingAndPolicy({ hotel, onSaved }: Props) {
  const [{ data, fetching, error }, refetch] = useQuery<GetAreasQuery, GetAreasQueryVariables>({
    query: GetAreasDocument,
    variables: {},
    requestPolicy: "cache-and-network",
  });

  const hotels = useMemo(() => {
    const list = data?.getAreas ?? [];
    return [...list].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }, [data?.getAreas]);

  const [selectedHotelId, setSelectedHotelId] = useState<string>("");

  useEffect(() => {
    if (!selectedHotelId && hotels.length) setSelectedHotelId(hotels[0].id);
  }, [hotels, selectedHotelId]);

  const selectedHotel = useMemo(
    () => hotels.find((h) => h.id === selectedHotelId) ?? null,
    [hotels, selectedHotelId]
  );

  const parsed = useMemo(() => parseHotelSettings(selectedHotel?.description ?? ""), [selectedHotel]);

  const [checkInTime, setCheckInTime] = useState(parsed.settings.checkInTime);
  const [checkOutTime, setCheckOutTime] = useState(parsed.settings.checkOutTime);
  const [checkoutRequiresPaidFolio, setCheckoutRequiresPaidFolio] = useState(
    parsed.settings.checkoutRequiresPaidFolio
  );

  // This is the hotel's "Notes/Policies/Instructions" text (free text)
  const [policyNotes, setPolicyNotes] = useState(parsed.baseText);

  useEffect(() => {
    setCheckInTime(parsed.settings.checkInTime);
    setCheckOutTime(parsed.settings.checkOutTime);
    setCheckoutRequiresPaidFolio(parsed.settings.checkoutRequiresPaidFolio);
    setPolicyNotes(parsed.baseText);
  }, [selectedHotelId]);

  const [{ fetching: saving }, editArea] = useMutation<EditAreaMutation, EditAreaMutationVariables>(
    EditAreaDocument
  );

  const isDirty =
    checkInTime !== parsed.settings.checkInTime ||
    checkOutTime !== parsed.settings.checkOutTime ||
    checkoutRequiresPaidFolio !== parsed.settings.checkoutRequiresPaidFolio ||
    policyNotes.trim() !== parsed.baseText.trim();

  const onSave = async () => {
    if (!selectedHotel) return;

    const nextTags = {
      ...parsed.tags,
      checkInTime: checkInTime.trim(),
      checkOutTime: checkOutTime.trim(),
      checkoutRequiresPaidFolio: String(Boolean(checkoutRequiresPaidFolio)),
    };

    const nextDescription = serializeHotelSettings({
      tags: nextTags,
      description: policyNotes, // update free text here
    });

    const res = await editArea({
      editAreaId: selectedHotel.id,
      name: selectedHotel.name,
      description: nextDescription,
    } as any);

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to save pricing & policy.");
      return;
    }

    toast.success("Pricing & policy saved.");
    refetch({ requestPolicy: "network-only" });
  };

  if (fetching) return <div className="text-sm text-gray-500">Loading hotel policies…</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error.message}</div>;
  if (!hotels.length) return <div className="text-sm text-gray-500">No hotels found.</div>;

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">Hotel Pricing & Policy</div>
        <div className="text-xs text-gray-500">
          Defines operational rules used by Reception (check-in/out times, checkout gating, etc.).
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <FieldLabel>Hotel</FieldLabel>
            <select
              className="rounded-lg border px-3 py-2 text-sm bg-white"
              value={selectedHotelId}
              onChange={(e) => setSelectedHotelId(e.target.value)}
            >
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[240px]" />

          <button
            type="button"
            onClick={() => refetch({ requestPolicy: "network-only" })}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving || !isDirty}
            className={`rounded-lg px-4 py-2 text-sm text-white ${
              saving || !isDirty ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-gray-950"
            }`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <FieldLabel>Check‑in time</FieldLabel>
            <input
              type="time"
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <FieldLabel>Check‑out time</FieldLabel>
            <input
              type="time"
              value={checkOutTime}
              onChange={(e) => setCheckOutTime(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 pt-6">
            <input
              id="checkoutRequiresPaidFolio"
              type="checkbox"
              checked={checkoutRequiresPaidFolio}
              onChange={(e) => setCheckoutRequiresPaidFolio(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="checkoutRequiresPaidFolio" className="text-sm text-gray-800">
              Checkout requires paid folio (Reception)
            </label>
          </div>
        </div>

        <div>
          <FieldLabel>Policy / operational notes (shown to Reception)</FieldLabel>
          <textarea
            value={policyNotes}
            onChange={(e) => setPolicyNotes(e.target.value)}
            rows={6}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Example: Late check-out fee… ID verification… Deposit rules…"
          />
          <div className="text-[11px] text-gray-500 mt-1">
            Reception will display this inside the stay details for this hotel.
          </div>
        </div>

        <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-700">
          <div className="font-semibold text-gray-800 mb-1">Current hotel snapshot</div>
          <div>Check‑in: {parsed.settings.checkInTime}</div>
          <div>Check‑out: {parsed.settings.checkOutTime}</div>
          <div>Requires paid folio: {parsed.settings.checkoutRequiresPaidFolio ? "Yes" : "No"}</div>
          <div>Opening hours: {summarizeOpeningHours(parsed.settings.openingHours)}</div>
        </div>
      </div>
    </div>
  );
}
