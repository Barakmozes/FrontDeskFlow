"use client";

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation } from "@urql/next";

import {
  EditAreaDocument,
  type EditAreaMutation,
  type EditAreaMutationVariables,
  UpdateManyTablesDocument,
  type UpdateManyTablesMutation,
  type UpdateManyTablesMutationVariables,
  type GetAreasQuery,
} from "@/graphql/generated";

import { parseHotelSettings, applyHotelSettingsPatch } from "@/lib/hotelSettingsTags";
import { parseRoomRateTags, applyRoomRatePatch, getEffectiveNightlyRate } from "@/lib/roomRateTags";

type Hotel = GetAreasQuery["getAreas"][number];

function parseMoneyInput(v: string): number | null {
  const trimmed = v.trim();
  if (!trimmed) return null;

  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

export default function HotelPricingSettings({
  hotel,
  onSaved,
}: {
  hotel: Hotel;
  onSaved: () => void;
}) {
  const parsed = useMemo(() => parseHotelSettings(hotel.description ?? ""), [hotel.description, hotel.id]);

  const [baseRateInput, setBaseRateInput] = useState<string>(String(parsed.settings.baseNightlyRate ?? 0));
  const [currency, setCurrency] = useState<string>((parsed.settings.currency ?? "USD").toUpperCase());

  const [roomSearch, setRoomSearch] = useState("");

  useEffect(() => {
    setBaseRateInput(String(parsed.settings.baseNightlyRate ?? 0));
    setCurrency((parsed.settings.currency ?? "USD").toUpperCase());
    setRoomSearch("");
  }, [hotel.id]); // reset when switching hotel

  const [{ fetching: savingHotel }, editArea] = useMutation<EditAreaMutation, EditAreaMutationVariables>(EditAreaDocument);

  const [{ fetching: savingRooms }, updateManyTables] = useMutation<
    UpdateManyTablesMutation,
    UpdateManyTablesMutationVariables
  >(UpdateManyTablesDocument);

  const rooms = useMemo(() => {
    return (hotel.tables ?? []).slice().sort((a, b) => a.tableNumber - b.tableNumber);
  }, [hotel.tables]);

  const initialOverrides = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of rooms) {
      const rate = parseRoomRateTags(r.specialRequests).rate.overrideNightlyRate;
      map[r.id] = rate == null ? "" : String(rate);
    }
    return map;
  }, [rooms]);

  const [overrideDraft, setOverrideDraft] = useState<Record<string, string>>(initialOverrides);

  useEffect(() => {
    setOverrideDraft(initialOverrides);
  }, [hotel.id, initialOverrides]);

  const baseNightlyRate = parseMoneyInput(baseRateInput) ?? 0;

  const filteredRooms = useMemo(() => {
    const q = roomSearch.trim();
    if (!q) return rooms;
    return rooms.filter((r) => String(r.tableNumber).includes(q));
  }, [rooms, roomSearch]);

  const isHotelDirty = useMemo(() => {
    const p = parseHotelSettings(hotel.description ?? "");
    const prevBase = Number(p.settings.baseNightlyRate ?? 0);
    const prevCur = String(p.settings.currency ?? "USD").toUpperCase();
    return prevBase !== baseNightlyRate || prevCur !== currency.trim().toUpperCase();
  }, [hotel.description, baseNightlyRate, currency]);

  async function saveHotelBasePricing() {
    if (baseNightlyRate <= 0) {
      toast.error("Base nightly rate must be greater than 0.");
      return;
    }

    const nextCurrency = currency.trim().toUpperCase() || "USD";

    if (!isHotelDirty) {
      toast.success("No pricing changes to save.");
      return;
    }

    const nextDescription = applyHotelSettingsPatch(hotel.description ?? "", {
      baseNightlyRate,
      currency: nextCurrency,
    });

    const res = await editArea({
      editAreaId: hotel.id,
      description: nextDescription,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to save hotel pricing.");
      return;
    }

    toast.success("Hotel pricing saved.");
    onSaved();
  }

  async function saveRoomOverrides() {
    const updates: UpdateManyTablesMutationVariables["updates"] = [];

    for (const r of rooms) {
      const prev = parseRoomRateTags(r.specialRequests).rate.overrideNightlyRate;

      const nextStr = (overrideDraft[r.id] ?? "").trim();
      const nextVal = nextStr === "" ? null : parseMoneyInput(nextStr);

      if (nextStr !== "" && (nextVal == null || nextVal <= 0)) {
        toast.error(`Invalid override for Room ${r.tableNumber}. Use a positive number or clear it.`);
        return;
      }

      const prevNorm = prev == null ? null : Number(prev);
      const nextNorm = nextVal == null ? null : Number(nextVal);

      if (prevNorm === nextNorm) continue;

      const nextSpecialRequests = applyRoomRatePatch(r.specialRequests, {
        overrideNightlyRate: nextNorm,
      });

      updates.push({
        id: r.id,
        specialRequests: nextSpecialRequests,
      });
    }

    if (updates.length === 0) {
      toast.success("No override changes to save.");
      return;
    }

    const res = await updateManyTables({ updates });
    if (res.error) {
      console.error(res.error);
      toast.error("Failed to save room overrides.");
      return;
    }

    toast.success(`Saved ${updates.length} room override(s).`);
    onSaved();
  }

  function resetOverrides() {
    setOverrideDraft(initialOverrides);
  }

  function clearAllOverrides() {
    const next: Record<string, string> = {};
    for (const r of rooms) next[r.id] = "";
    setOverrideDraft(next);
  }

  const effectivePreviewCurrency = (currency.trim().toUpperCase() || "USD") as string;

  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <div className="text-lg font-semibold text-slate-900">Hotel Pricing</div>
        <div className="text-sm text-slate-600">
          Base rate is stored in <span className="font-mono">Area.description</span>. Room overrides are stored in{" "}
          <span className="font-mono">Table.specialRequests</span>.
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Base rate */}
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="block text-xs text-slate-600">Base nightly rate</label>
            <input
              value={baseRateInput}
              onChange={(e) => setBaseRateInput(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="150"
              inputMode="decimal"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Applies to all rooms unless overridden.
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600">Currency</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="USD"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Used by Reception (auto-post) and Folio room charges.
            </div>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={saveHotelBasePricing}
              disabled={savingHotel || !isHotelDirty}
              className="w-full rounded-lg bg-black px-3 py-2 text-sm text-white hover:opacity-90 disabled:bg-gray-300"
            >
              {savingHotel ? "Saving…" : "Save base pricing"}
            </button>
          </div>
        </div>

        {/* Room overrides */}
        <div className="rounded-xl border bg-slate-50">
          <div className="border-b px-4 py-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Room Overrides</div>
              <div className="text-xs text-slate-600">
                Override rate per room (leave empty to use the hotel base rate).
              </div>

              <div className="mt-3">
                <label className="block text-xs text-slate-600">Search room</label>
                <input
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Type room number…"
                />
              </div>
            </div>

            <div className="flex gap-2 md:pt-6">
              <button
                type="button"
                onClick={resetOverrides}
                className="rounded-lg border bg-white px-3 py-2 text-xs hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={clearAllOverrides}
                className="rounded-lg border bg-white px-3 py-2 text-xs hover:bg-slate-50"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={saveRoomOverrides}
                disabled={savingRooms}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs text-white hover:bg-emerald-700 disabled:bg-gray-300"
              >
                {savingRooms ? "Saving…" : "Save overrides"}
              </button>
            </div>
          </div>

          <div className="p-4 overflow-auto">
            {rooms.length === 0 ? (
              <div className="text-sm text-slate-500">No rooms found for this hotel.</div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-sm text-slate-500">No rooms match that search.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-600">
                    <th className="py-2 pr-3">Room</th>
                    <th className="py-2 pr-3">Override</th>
                    <th className="py-2 pr-3">Effective rate</th>
                    <th className="py-2 pr-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRooms.map((r) => {
                    const override = (overrideDraft[r.id] ?? "").trim();
                    const overrideNum = override === "" ? null : parseMoneyInput(override);

                    const effective = getEffectiveNightlyRate(baseNightlyRate, overrideNum);

                    return (
                      <tr key={r.id} className="bg-white">
                        <td className="py-3 pr-3 font-semibold text-slate-900">{r.tableNumber}</td>

                        <td className="py-3 pr-3">
                          <input
                            value={overrideDraft[r.id] ?? ""}
                            onChange={(e) =>
                              setOverrideDraft((s) => ({
                                ...s,
                                [r.id]: e.target.value,
                              }))
                            }
                            className="w-40 rounded-lg border px-3 py-2 text-sm"
                            placeholder="(inherit)"
                            inputMode="decimal"
                          />
                        </td>

                        <td className="py-3 pr-3">
                          <span className="font-semibold text-slate-900">
                            {Number.isFinite(effective) ? effective.toFixed(2) : "0.00"} {effectivePreviewCurrency}
                          </span>
                        </td>

                        <td className="py-3 pr-3 text-xs text-slate-500">
                          Capacity: {r.diners ?? "—"} · Reserved:{" "}
                          <span className="font-medium">{r.reserved ? "Yes" : "No"}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <div className="mt-3 text-[11px] text-slate-500">
              These overrides are read by Reception (auto-post charges) and Folio pricing logic.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
