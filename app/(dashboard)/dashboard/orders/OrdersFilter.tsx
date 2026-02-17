"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HiXMark } from "react-icons/hi2";

type Props = {
  hotels?: Array<{ id: string; name: string }>;
  disabled?: boolean;
};

type PaidFilter = "ALL" | "PAID" | "UNPAID";
type KindFilter = "ALL" | "ROOM_CHARGE" | "ROOM_SERVICE" | "DELIVERY";
type BookingFilter = "ALL" | "LINKED" | "UNLINKED";

function buildParams(
  current: { toString(): string },
  patch: Partial<Record<string, string | null | undefined>>
) {
  const p = new URLSearchParams(current.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (!v || v === "ALL") p.delete(k);
    else p.set(k, v);
  }
  return p;
}

export default function OrdersFilter({ hotels, disabled }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const spStr = sp.toString();

  // Read current params
  const current = useMemo(() => {
    const q = sp.get("q") ?? "";
    const hotel = sp.get("hotel") ?? "ALL";
    const paid = (sp.get("paid") ?? "ALL") as PaidFilter;
    const kind = (sp.get("kind") ?? "ALL") as KindFilter;
    const booking = (sp.get("booking") ?? "ALL") as BookingFilter;
    const from = sp.get("from") ?? "";
    const to = sp.get("to") ?? "";
    
    return { q, hotel, paid, kind, booking, from, to };
  }, [spStr]); // sync when URL changes

  const [qInput, setQInput] = useState(current.q);

  useEffect(() => setQInput(current.q), [current.q]);

  const apply = (patch: Partial<Record<string, string | null | undefined>>) => {
    const next = buildParams(sp, patch);
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : `?`);
  };

  const clearAll = () => {
    router.replace(`?`);
  };

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-end">
      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: qInput.trim() || null });
        }}
        className="flex gap-2"
      >
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          disabled={disabled}
          placeholder="Search: order #, guest, email, phone, status…"
          className="w-full md:w-[320px] rounded-md border px-3 py-2 text-sm bg-white"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-md bg-black text-white px-3 py-2 text-sm hover:opacity-90 disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {/* Hotel */}
      <select
        value={current.hotel}
        disabled={disabled}
        onChange={(e) => apply({ hotel: e.target.value })}
        className="rounded-md border px-3 py-2 text-sm bg-white"
        title="Filter by hotel"
      >
        <option value="ALL">All hotels</option>
        {(hotels ?? []).map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>

      {/* Kind */}
      <select
        value={current.kind}
        disabled={disabled}
        onChange={(e) => apply({ kind: e.target.value })}
        className="rounded-md border px-3 py-2 text-sm bg-white"
        title="Filter by kind"
      >
        <option value="ALL">All kinds</option>
        <option value="ROOM_CHARGE">Room charges</option>
        <option value="ROOM_SERVICE">Room service / In-house</option>
      
      </select>

      {/* Paid */}
      <select
        value={current.paid}
        disabled={disabled}
        onChange={(e) => apply({ paid: e.target.value })}
        className="rounded-md border px-3 py-2 text-sm bg-white"
        title="Filter by payment"
      >
        <option value="ALL">All payments</option>
        <option value="PAID">Paid</option>
        <option value="UNPAID">Unpaid</option>
      </select>

      {/* Booking link */}
      <select
        value={current.booking}
        disabled={disabled}
        onChange={(e) => apply({ booking: e.target.value })}
        className="rounded-md border px-3 py-2 text-sm bg-white"
        title="Filter by booking linkage"
      >
        <option value="ALL">All bookings</option>
        <option value="LINKED">Linked to booking</option>
        <option value="UNLINKED">Unlinked</option>
      </select>

      {/* Date range */}
      <div className="flex gap-2">
        <input
          type="date"
          value={current.from}
          disabled={disabled}
          onChange={(e) => apply({ from: e.target.value || null })}
          className="rounded-md border px-3 py-2 text-sm bg-white"
          title="From date"
        />
        <input
          type="date"
          value={current.to}
          disabled={disabled}
          onChange={(e) => apply({ to: e.target.value || null })}
          className="rounded-md border px-3 py-2 text-sm bg-white"
          title="To date"
        />
      </div>

      {/* Clear */}
      <button
        type="button"
        onClick={clearAll}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
        title="Clear all filters"
      >
        <HiXMark className="h-4 w-4" />
        Clear
      </button>
    </div>
  );
}
