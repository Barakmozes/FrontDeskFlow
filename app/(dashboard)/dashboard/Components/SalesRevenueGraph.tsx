"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@urql/next";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import {
  GetOrdersDocument,
  GetOrdersQuery,
  GetOrdersQueryVariables,
  OrderStatus,
} from "@/graphql/generated";

import { effectiveOrderDateKey, inferRevenueStream, orderIsPaid } from "@/lib/folioOrders";

type Mode = "DAY" | "WEEK" | "MONTH";

function dateKeyToDate(dk: string) {
  return new Date(`${dk}T00:00:00`);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfWeekMonday(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function weekLabel(d: Date) {
  const monday = startOfWeekMonday(d);
  return `Wk ${pad2(monday.getMonth() + 1)}/${pad2(monday.getDate())}`;
}

export default function SalesRevenueGraph() {
  const [mode, setMode] = useState<Mode>("MONTH");

  const [{ data, fetching, error }] = useQuery<GetOrdersQuery, GetOrdersQueryVariables>({
    query: GetOrdersDocument,
    variables: { first: 800 },
    requestPolicy: "cache-first",
  });

  const orders = useMemo(() => {
const nodes =
  data?.getOrders?.edges
    ?.filter(
      (e): e is NonNullable<typeof e> =>
        Boolean(e && e.node)
    )
    .map((e) => e.node) ?? [];
    return nodes.filter((o) => o.status !== OrderStatus.Cancelled);
  }, [data]);

  const chartData = useMemo(() => {
    // Choose range size
    const now = new Date();
    const points =
      mode === "DAY" ? 14 :
      mode === "WEEK" ? 10 :
      12;

    const buckets = new Map<string, { label: string; room: number; menu: number }>();

    const add = (key: string, label: string, room: number, menu: number) => {
      const existing = buckets.get(key) ?? { label, room: 0, menu: 0 };
      existing.room += room;
      existing.menu += menu;
      buckets.set(key, existing);
    };

    // Pre-seed buckets so the chart doesn’t “jump” on empty days
    if (mode === "DAY") {
      for (let i = points - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const k = dayKey(d);
        buckets.set(k, { label: `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`, room: 0, menu: 0 });
      }
    } else if (mode === "WEEK") {
      for (let i = points - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i * 7);
        const monday = startOfWeekMonday(d);
        const k = dayKey(monday);
        buckets.set(k, { label: weekLabel(monday), room: 0, menu: 0 });
      }
    } else {
      for (let i = points - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(now.getMonth() - i);
        const k = monthKey(d);
        buckets.set(k, { label: k, room: 0, menu: 0 });
      }
    }

    for (const o of orders) {
      if (!orderIsPaid(o)) continue; // revenue reporting from paid items
      const dk = effectiveOrderDateKey(o);
      if (!dk) continue;

      const d = dateKeyToDate(dk);
      const stream = inferRevenueStream(o);

      if (mode === "DAY") {
        const k = dayKey(d);
        const label = `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
        add(k, label, stream === "ROOM" ? Number(o.total) || 0 : 0, stream === "ROOM" ? 0 : Number(o.total) || 0);
      } else if (mode === "WEEK") {
        const monday = startOfWeekMonday(d);
        const k = dayKey(monday);
        const label = weekLabel(monday);
        add(k, label, stream === "ROOM" ? Number(o.total) || 0 : 0, stream === "ROOM" ? 0 : Number(o.total) || 0);
      } else {
        const k = monthKey(d);
        add(k, k, stream === "ROOM" ? Number(o.total) || 0 : 0, stream === "ROOM" ? 0 : Number(o.total) || 0);
      }
    }

    // Sort by key (works for YYYY-MM and YYYY-MM-DD)
    return Array.from(buckets.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([, v]) => ({
        label: v.label,
        room: Number(v.room.toFixed(2)),
        menu: Number(v.menu.toFixed(2)),
      }));
  }, [orders, mode]);

  return (
    <div className="hidden lg:block bg-white shadow-md rounded-xl border">
      <div className="flex flex-col justify-between md:flex-row items-center gap-3 py-5 px-6">
        <div className="flex items-center gap-4">
          <p className="flex items-baseline gap-2 text-sm">
            <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full border border-green-500">
              <span className="block h-2 w-2 rounded-full bg-green-500"></span>
            </span>
            Room Revenue
          </p>

          <p className="flex items-baseline gap-2 text-sm">
            <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full border border-slate-500">
              <span className="block h-2 w-2 rounded-full bg-slate-500"></span>
            </span>
            Menu Revenue
          </p>
        </div>

        <div className="flex space-x-2 bg-slate-100 p-2 rounded-lg text-xs">
          <button
            className={mode === "DAY" ? "bg-white rounded-md py-1 px-3" : "py-1 px-3"}
            onClick={() => setMode("DAY")}
          >
            Day
          </button>
          <button
            className={mode === "WEEK" ? "bg-white rounded-md py-1 px-3" : "py-1 px-3"}
            onClick={() => setMode("WEEK")}
          >
            Week
          </button>
          <button
            className={mode === "MONTH" ? "bg-white rounded-md py-1 px-3" : "py-1 px-3"}
            onClick={() => setMode("MONTH")}
          >
            Month
          </button>
        </div>
      </div>

      <div className="px-6 pb-3 text-xs text-gray-500">
        {fetching ? "Loading revenue…" : error ? `Error: ${error.message}` : "Paid revenue split by order type"}
      </div>

      <div className="w-full h-96">
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
            <defs>
              <linearGradient id="room" x1="0" y1="0" x2="0" y2="1">
                <stop offset="55%" stopColor="#a7f3d0" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#a7f3d0" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="menu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="55%" stopColor="#e2e8f0" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#e2e8f0" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="room" stroke="#22c55e" fill="url(#room)" name="Room revenue" />
            <Area type="monotone" dataKey="menu" stroke="#94a3b8" fill="url(#menu)" name="Menu revenue" />
            <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
