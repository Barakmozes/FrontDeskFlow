"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@urql/next";

import {
  GetReservationDocument,
  type GetReservationQuery,
  type GetReservationQueryVariables,

  GetAreaDocument,
  type GetAreaQuery,
  type GetAreaQueryVariables,

  GetTableOrderDocument,
  type GetTableOrderQuery,
  type GetTableOrderQueryVariables,
} from "@/graphql/generated";

import { buildInvoiceHtml, type InvoiceLine } from "@/app/components/Restaurant_interface/Folio/printInvoice";
import type { FolioLine } from "@/app/components/Restaurant_interface/Folio/types";

type OrderRow = GetTableOrderQuery["getTableOrder"][number];

function toISO(d: unknown): string | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

/**
 * Convert Table Orders -> Folio lines for printing
 * Note: mark payments by note prefix "FD:PAYMENT" (you can adjust to your real convention)
 */
function buildLinesFromOrders(orders: OrderRow[]): InvoiceLine[] {
  return (orders ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
    )
    .map((o) => {
      const note = (o.note ?? "").trim();
      const kind: InvoiceLine["kind"] = note.startsWith("FD:PAYMENT")
        ? "PAYMENT"
        : "CHARGE";

      const description =
        note.length > 0
          ? note
          : `Order ${o.orderNumber}${o.paid ? " (paid)" : ""}`;

      return {
        date: toISO(o.orderDate) ?? new Date().toISOString(),
        description,
        kind,
        amount: Number(o.total ?? 0),
      };
    });
}

function computeTotals(lines: InvoiceLine[]) {
  let charges = 0;
  let payments = 0;

  for (const l of lines) {
    const amt = Number(l.amount ?? 0);
    if (!Number.isFinite(amt)) continue;

    if (l.kind === "PAYMENT") payments += amt;
    else charges += amt;
  }

  return { charges, payments, balance: charges - payments };
}

export default function PrintInvoicePage() {
  const router = useRouter();
  const params = useParams<{ reservationId: string }>();
  const reservationId = params.reservationId;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const printedRef = useRef(false);

  // 1) Reservation
  const [{ data, fetching, error }] = useQuery<
    GetReservationQuery,
    GetReservationQueryVariables
  >({
    query: GetReservationDocument,
    variables: { getReservationId: reservationId } as GetReservationQueryVariables,
    requestPolicy: "network-only",
  });

  const reservation = data?.getReservation ?? null;
  const tableId = reservation?.tableId ?? null;
  const areaId = reservation?.table?.areaId ?? null;

  // 2) Area (for real hotel name)
  const [{ data: areaData }] = useQuery<GetAreaQuery, GetAreaQueryVariables>({
    query: GetAreaDocument,
    variables: areaId ? ({ getAreaId: areaId } as GetAreaQueryVariables) : ({} as any),
    pause: !areaId,
    requestPolicy: "cache-and-network",
  });

  // 3) Orders (folio lines)
  const [{ data: ordersData }] = useQuery<
    GetTableOrderQuery,
    GetTableOrderQueryVariables
  >({
    query: GetTableOrderDocument,
    variables: tableId ? ({ tableId } as GetTableOrderQueryVariables) : ({} as any),
    pause: !tableId,
    requestPolicy: "network-only",
  });

const lines: InvoiceLine[] = useMemo(() => {
  const orders = ordersData?.getTableOrder ?? [];
  return buildLinesFromOrders(orders);
}, [ordersData]);

  const totals = useMemo(() => computeTotals(lines), [lines]);

  const html = useMemo(() => {
    if (!reservation) return "";

    const hotelName =
      areaData?.getArea?.name ?? reservation.table?.areaId ?? "Hotel";

    const roomNumber = reservation.table?.tableNumber ?? 0;

    const guestName =
      reservation.user?.profile?.name ?? reservation.userEmail ?? "Guest";
    const guestEmail = reservation.userEmail ?? "—";

    return buildInvoiceHtml({
      hotelName,
      reservationId: reservation.id,
      roomNumber,
      guestName,
      guestEmail,
      lines,
      totals,

      locale: "he-IL",
      currency: "ILS",
      timeZone: "Asia/Jerusalem",
      invoiceNumber: `INV-${String(reservation.id).slice(-6).toUpperCase()}`,
      issuedAt: new Date(),

      stay: {
        nights: 1, // adjust if you have nights logic
        adults: reservation.numOfDiners ?? undefined,
      },

      payment: {
        status:
          Math.abs(totals.balance) < 0.005
            ? "PAID"
            : totals.payments > 0
            ? "PARTIAL"
            : "UNPAID",
      },

      notes:
        "Checkout policy: balance must be settled unless manager override. תודה שהתארחתם אצלנו.",
    });
  }, [reservation, areaData, lines, totals]);

  const printIframe = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return window.print();
    win.focus();
    win.print();
  };

  // Auto-print once invoice iframe signals ready (from buildInvoiceHtml script)
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev?.data?.type !== "INVOICE_READY") return;
      if (printedRef.current) return;

      printedRef.current = true;
      setTimeout(() => printIframe(), 120);
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  if (fetching) return <div className="p-6">Preparing invoice…</div>;
  if (error) return <div className="p-6 text-red-600">{error.message}</div>;
  if (!html) return <div className="p-6">No invoice data.</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar (not printed) */}
      <div className="p-3 border-b bg-white flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
        >
          ← Back
        </button>

        <div className="text-sm text-gray-600 truncate">
          Invoice preview • {reservationId}
        </div>

        <button
          type="button"
          className="text-sm px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-950"
          onClick={printIframe}
        >
          Print
        </button>
      </div>

      <iframe
        ref={iframeRef}
        className="w-full h-[calc(100vh-56px)] bg-white"
        srcDoc={html}
        title="Invoice"
      />
    </div>
  );
}
