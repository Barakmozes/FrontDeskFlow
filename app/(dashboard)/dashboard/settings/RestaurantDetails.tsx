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

import { parseHotelSettings, serializeHotelSettings } from "@/lib/hotelSettingsTags";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium text-gray-600 mb-1">{children}</div>;
}
type Props = {
  hotel: any; // עדיף לשים טיפוס מדויק
  onSaved: () => void;
};

export default function RestaurantDetails({ hotel, onSaved }: Props) {
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

  const [hotelAddress, setHotelAddress] = useState(parsed.settings.hotelAddress);
  const [hotelPhone, setHotelPhone] = useState(parsed.settings.hotelPhone);
  const [hotelEmail, setHotelEmail] = useState(parsed.settings.hotelEmail);
  const [hotelWebsite, setHotelWebsite] = useState(parsed.settings.hotelWebsite);
  const [vatNumber, setVatNumber] = useState(parsed.settings.vatNumber);

  useEffect(() => {
    setHotelAddress(parsed.settings.hotelAddress);
    setHotelPhone(parsed.settings.hotelPhone);
    setHotelEmail(parsed.settings.hotelEmail);
    setHotelWebsite(parsed.settings.hotelWebsite);
    setVatNumber(parsed.settings.vatNumber);
  }, [selectedHotelId]);

  const [{ fetching: saving }, editArea] = useMutation<EditAreaMutation, EditAreaMutationVariables>(
    EditAreaDocument
  );

  const isDirty =
    hotelAddress !== parsed.settings.hotelAddress ||
    hotelPhone !== parsed.settings.hotelPhone ||
    hotelEmail !== parsed.settings.hotelEmail ||
    hotelWebsite !== parsed.settings.hotelWebsite ||
    vatNumber !== parsed.settings.vatNumber;

  const onSave = async () => {
    if (!selectedHotel) return;

    const nextTags = {
      ...parsed.tags,
      hotelAddress: hotelAddress.trim(),
      hotelPhone: hotelPhone.trim(),
      hotelEmail: hotelEmail.trim(),
      hotelWebsite: hotelWebsite.trim(),
      vatNumber: vatNumber.trim(),
    };

    const nextDescription = serializeHotelSettings({
      tags: nextTags,
      description: parsed.baseText, // preserve policy notes
    });

    const res = await editArea({
      editAreaId: selectedHotel.id,
      name: selectedHotel.name,
      description: nextDescription,
    } as any);

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to save hotel details.");
      return;
    }

    toast.success("Hotel details saved.");
    refetch({ requestPolicy: "network-only" });
  };

  if (fetching) return <div className="text-sm text-gray-500">Loading hotel details…</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error.message}</div>;
  if (!hotels.length) return <div className="text-sm text-gray-500">No hotels found.</div>;

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">Hotel Details (per hotel)</div>
        <div className="text-xs text-gray-500">
          Contact/address details used by Reception and receipts/folios.
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

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <FieldLabel>Address</FieldLabel>
            <input
              value={hotelAddress}
              onChange={(e) => setHotelAddress(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Street, City, Country"
            />
          </div>

          <div>
            <FieldLabel>Phone</FieldLabel>
            <input
              value={hotelPhone}
              onChange={(e) => setHotelPhone(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="+1 555 123 456"
            />
          </div>

          <div>
            <FieldLabel>Email</FieldLabel>
            <input
              value={hotelEmail}
              onChange={(e) => setHotelEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="frontdesk@hotel.com"
            />
          </div>

          <div>
            <FieldLabel>Website</FieldLabel>
            <input
              value={hotelWebsite}
              onChange={(e) => setHotelWebsite(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="https://hotel.com"
            />
          </div>

          <div>
            <FieldLabel>VAT / Tax number</FieldLabel>
            <input
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-700">
          <div className="font-semibold text-gray-800 mb-1">Stored values</div>
          <div>Address: {parsed.settings.hotelAddress || "—"}</div>
          <div>Phone: {parsed.settings.hotelPhone || "—"}</div>
          <div>Email: {parsed.settings.hotelEmail || "—"}</div>
          <div>Website: {parsed.settings.hotelWebsite || "—"}</div>
          <div>VAT: {parsed.settings.vatNumber || "—"}</div>
        </div>
      </div>
    </div>
  );
}
