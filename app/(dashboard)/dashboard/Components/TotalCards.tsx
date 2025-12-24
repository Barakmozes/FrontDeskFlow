"use client";

import React, { useMemo } from "react";
import { useQuery } from "@urql/next";

import { HiArrowSmDown, HiArrowSmUp } from "react-icons/hi";
import { HiOutlineCurrencyDollar } from "react-icons/hi2";
import { VscLayoutMenubar } from "react-icons/vsc";
import { MdOutlineHotel } from "react-icons/md";
import { BiReceipt } from "react-icons/bi";

import {
  GetOrdersDocument,
  GetOrdersQuery,
  GetOrdersQueryVariables,
  OrderStatus,
} from "@/graphql/generated";

import { effectiveOrderDateKey, formatMoney, inferRevenueStream, orderIsPaid } from "@/lib/folioOrders";

function pctChange(curr: number, prev: number) {
  if (!Number.isFinite(prev) || prev <= 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function dateKeyToTs(dk: string) {
  // dk is "YYYY-MM-DD"
  return new Date(`${dk}T00:00:00`).getTime();
}

export default function TotalCards() {
  const [{ data, fetching, error }] = useQuery<GetOrdersQuery, GetOrdersQueryVariables>({
    query: GetOrdersDocument,
    variables: { first: 500 },
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

  const metrics = useMemo(() => {
    const now = Date.now();
    const days = 30;
    const ms = days * 24 * 60 * 60 * 1000;

    const currStart = now - ms;
    const prevStart = currStart - ms;

    const inRange = (o: any, start: number, end: number) => {
      const dk = effectiveOrderDateKey(o);
      const ts = dateKeyToTs(dk);
      return ts >= start && ts < end;
    };

    const curr = orders.filter((o) => inRange(o, currStart, now));
    const prev = orders.filter((o) => inRange(o, prevStart, currStart));

    const sum = (list: any[], pred: (o: any) => boolean) =>
      list.reduce((s, o) => (pred(o) ? s + (Number(o.total) || 0) : s), 0);

    const roomRev = (list: any[]) =>
      sum(list, (o) => orderIsPaid(o) && inferRevenueStream(o) === "ROOM");
    const menuRev = (list: any[]) =>
      sum(list, (o) => orderIsPaid(o) && inferRevenueStream(o) !== "ROOM");
    const totalRev = (list: any[]) => sum(list, (o) => orderIsPaid(o));
    const balanceDue = (list: any[]) => sum(list, (o) => !orderIsPaid(o));
    const orderCount = (list: any[]) => list.length;

    const currTotal = totalRev(curr);
    const prevTotal = totalRev(prev);

    const currRoom = roomRev(curr);
    const prevRoom = roomRev(prev);

    const currMenu = menuRev(curr);
    const prevMenu = menuRev(prev);

    const currDue = balanceDue(curr);
    const prevDue = balanceDue(prev);

    return {
      currTotal,
      prevTotal,
      currRoom,
      prevRoom,
      currMenu,
      prevMenu,
      currDue,
      prevDue,
      currCount: orderCount(curr),
      prevCount: orderCount(prev),
    };
  }, [orders]);

  const cards = [
    {
      title: "Total Revenue (30d)",
      value: formatMoney(metrics.currTotal),
      pct: pctChange(metrics.currTotal, metrics.prevTotal),
      icon: HiOutlineCurrencyDollar,
    },
    {
      title: "Room Revenue (30d)",
      value: formatMoney(metrics.currRoom),
      pct: pctChange(metrics.currRoom, metrics.prevRoom),
      icon: MdOutlineHotel,
    },
    {
      title: "Menu Revenue (30d)",
      value: formatMoney(metrics.currMenu),
      pct: pctChange(metrics.currMenu, metrics.prevMenu),
      icon: VscLayoutMenubar,
    },
    {
      title: "Balance Due (30d)",
      value: formatMoney(metrics.currDue),
      pct: pctChange(metrics.currDue, metrics.prevDue),
      icon: BiReceipt,
    },
  ];

  return (
    <section className="py-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
      {fetching ? (
        <div className="col-span-full text-sm text-gray-500">Loading metrics…</div>
      ) : null}
      {error ? (
        <div className="col-span-full text-sm text-red-600">Failed loading metrics: {error.message}</div>
      ) : null}

      {cards.map((c) => {
        const UpDown = c.pct >= 0 ? HiArrowSmUp : HiArrowSmDown;
        const tone = c.pct >= 0 ? "text-green-600" : "text-red-600";

        return (
          <div className="p-4 shadow-md bg-white rounded-xl border" key={c.title}>
            <button className="p-2 bg-slate-200 rounded-full hover:bg-green-200 text-green-700">
              {React.createElement(c.icon, { size: 22 })}
            </button>

            <h2 className="font-semibold text-2xl pt-3">{c.value}</h2>

            <div className="flex justify-between items-center pt-2">
              <p className="text-slate-500 text-sm">{c.title}</p>

              <p className={`flex items-center text-sm ${tone}`}>
                <span>{Math.abs(c.pct).toFixed(1)}%</span>
                <UpDown className="mb-1" size={22} />
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
