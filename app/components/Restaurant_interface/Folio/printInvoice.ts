// app/components/Restaurant_interface/Folio/printInvoice.ts
import type { FolioLine } from "./types";

export function buildInvoiceHtml(args: {
  hotelName: string;
  reservationId: string;
  roomNumber: number;
  guestName: string;
  guestEmail: string;
  lines: FolioLine[];
  totals: { charges: number; payments: number; balance: number };
}) {
  const escape = (s: string) =>
    s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  const money = (n: number) => n.toFixed(2);

  const rows = args.lines
    .map((l) => {
      const dt = new Date(l.date).toLocaleString();
      return `
        <tr>
          <td>${escape(dt)}</td>
          <td>${escape(l.description)}</td>
          <td style="text-align:right;">${l.kind === "CHARGE" ? money(l.amount) : ""}</td>
          <td style="text-align:right;">${l.kind === "PAYMENT" ? money(l.amount) : ""}</td>
        </tr>
      `;
    })
    .join("");

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Invoice - ${escape(args.reservationId)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { margin: 0 0 6px; }
        .muted { color: #555; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
        th { background: #f6f6f6; text-align: left; }
        .totals { margin-top: 12px; width: 300px; float: right; }
        .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
        .bold { font-weight: 700; }
      </style>
    </head>
    <body>
      <h1>${escape(args.hotelName)}</h1>
      <div class="muted">
        Reservation: ${escape(args.reservationId)}<br/>
        Room: ${escape(String(args.roomNumber))}<br/>
        Guest: ${escape(args.guestName)} (${escape(args.guestEmail)})<br/>
        Printed: ${escape(new Date().toLocaleString())}
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th style="text-align:right;">Charge</th>
            <th style="text-align:right;">Payment</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="totals">
        <div><span>Charges</span><span>${money(args.totals.charges)}</span></div>
        <div><span>Payments</span><span>${money(args.totals.payments)}</span></div>
        <div class="bold"><span>Balance</span><span>${money(args.totals.balance)}</span></div>
      </div>
    </body>
  </html>
  `;
}

/**
 * ✅ Printing happens HERE (as requested).
 * Returns false when popup is blocked.
 */
export function printInvoice(args: Parameters<typeof buildInvoiceHtml>[0]): boolean {
  const html = buildInvoiceHtml(args);

  if (typeof window === "undefined") return false;

  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=900");
  if (!win) return false;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();

  // Let the browser render before printing
  setTimeout(() => {
    try {
      win.print();
    } catch {
      // ignore
    }
  }, 250);

  return true;
}
