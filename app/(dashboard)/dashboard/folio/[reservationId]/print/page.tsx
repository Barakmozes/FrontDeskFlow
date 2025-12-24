"use client";

import React, { useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@urql/next";

// תתאים ל-queryים שכבר קיימים אצלך ב-folio.client.tsx
import {
  GetReservationDocument,
  GetReservationQuery,
  GetReservationQueryVariables,
  // אם יש לך query של folio lines / charges, תוסיף גם אותו
} from "@/graphql/generated";

import { buildInvoiceHtml } from "@/app/components/Restaurant_interface/Folio/printInvoice"; 
import { FolioLine } from "@/app/components/Restaurant_interface/Folio/types";
// ^ תעדכן נתיב אמיתי לפי איפה ששמת את buildInvoiceHtml בפועל
// אפשר גם להעביר את buildInvoiceHtml לקובץ ייעודי ב-lib

export default function PrintInvoicePage() {
  const params = useParams<{ reservationId: string }>();
  const reservationId = params.reservationId;

  // 1) להביא reservation + פרטי אורח/חדר/מלון
  const [{ data, fetching, error }] = useQuery<
    GetReservationQuery,
    GetReservationQueryVariables
  >({
    query: GetReservationDocument,
    variables: { getReservationId: reservationId },
    requestPolicy: "network-only",
  });

  // 2) להביא שורות folio (אם יש לך query) – כאן אני שם placeholder
 const lines: FolioLine [] = [];// TODO: להחליף בנתונים אמיתיים
  const totals = { charges: 0, payments: 0, balance: 0 }; // TODO: לחשב לפי lines

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const printedRef = useRef(false);

  const html = useMemo(() => {
    const r = data?.getReservation;
    if (!r) return "";

    const hotelName = r.table?.areaId ?? "Hotel"; // עדיף להביא שם אמיתי (areas)
    const roomNumber = r.table?.tableNumber ?? 0;

    const guestName = r.user?.profile?.name ?? r.userEmail ?? "Guest";
    const guestEmail = r.userEmail ?? "—";

    return buildInvoiceHtml({
      hotelName,
      reservationId: r.id,
      roomNumber,
      guestName,
      guestEmail,
      lines,
      totals,
    });
  }, [data, lines, totals]);

  if (fetching) return <div className="p-6">Preparing invoice…</div>;
  if (error) return <div className="p-6 text-red-600">{error.message}</div>;
  if (!html) return <div className="p-6">No invoice data.</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* כפתור ידני ליתר ביטחון */}
      <div className="p-3 border-b bg-white flex items-center justify-between">
        <div className="text-sm text-gray-600">Invoice preview</div>
        <button
          className="text-sm px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-950"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>

      <iframe
        ref={iframeRef}
        className="w-full h-[calc(100vh-56px)]"
        srcDoc={html}
        onLoad={() => {
          // הדפסה אוטומטית אחרי שה-iframe נטען
          if (printedRef.current) return;
          printedRef.current = true;

          // מדפיסים את תוכן ה-iframe (יותר יציב)
          setTimeout(() => {
            const win = iframeRef.current?.contentWindow;
            if (win) {
              win.focus();
              win.print();
            } else {
              // fallback
              window.print();
            }
          }, 100);
        }}
      />
    </div>
  );
}
