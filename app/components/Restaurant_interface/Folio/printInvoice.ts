import type { FolioLine } from "./types";

/**
 * Premium printable invoice HTML (A4) for FrontDeskFlow / Folio.
 * - Print-first CSS (A4), clean typography, zebra table, totals card, badges
 * - Optional "stay" + hotel/company/customer meta (without breaking existing calls)
 * - Safe escaping for HTML
 */


// 👇 שורת הדפסה מינימלית (לא דורשת id/source)
export type InvoiceLine = Pick<FolioLine, "date" | "description" | "kind" | "amount">;

export function buildInvoiceHtml(args: {
  hotelName: string;
  reservationId: string;
  roomNumber: number;
  guestName: string;
  guestEmail: string;

  // ⬇️ במקום FolioLine[]
  lines: InvoiceLine[];

  totals?: { charges: number; payments: number; balance: number };

  // ... כל השדות האופציונליים שהוספנו
  locale?: string;
  currency?: string;
  timeZone?: string;
  invoiceNumber?: string;
  issuedAt?: string | Date;
  dueAt?: string | Date | null;
  hotel?: {
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    taxId?: string;
    logoUrl?: string;
  };
  guest?: {
    phone?: string;
    address?: string;
    companyName?: string;
    taxId?: string;
  };
  stay?: {
    checkIn?: string | Date;
    checkOut?: string | Date;
    nights?: number;
    adults?: number;
    children?: number;
    ratePlan?: string;
  };
  payment?: {
    status?: "PAID" | "UNPAID" | "PARTIAL";
    methodSummary?: string;
    reference?: string;
  };
  notes?: string;
}) {
  const esc = (v: unknown) =>
    String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const locale = args.locale ?? "he-IL";
  const currency = args.currency ?? "ILS";
  const timeZone = args.timeZone ?? "Asia/Jerusalem";

  const fmtMoney = (n: number) => {
    const safe = Number.isFinite(n) ? n : 0;
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(safe);
    } catch {
      return safe.toFixed(2);
    }
  };

  const fmtDate = (d: string | Date | undefined | null) => {
    if (!d) return "—";
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dt);
  };

  const fmtDateTime = (d: string | Date | undefined | null) => {
    if (!d) return "—";
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dt);
  };

  const computedTotals = (() => {
    const fromArgs = args.totals;
    const hasMeaningful =
      fromArgs &&
      [fromArgs.charges, fromArgs.payments, fromArgs.balance].every((x) =>
        Number.isFinite(x)
      );

    if (hasMeaningful) return fromArgs!;

    let charges = 0;
    let payments = 0;
    for (const l of args.lines ?? []) {
      const amt = Number((l as any)?.amount ?? 0);
      if (!Number.isFinite(amt)) continue;
      if ((l as any)?.kind === "PAYMENT") payments += amt;
      else charges += amt; // default CHARGE
    }
    const balance = charges - payments;
    return { charges, payments, balance };
  })();

  const balance = computedTotals.balance ?? 0;
  const paidByBalance = Math.abs(balance) < 0.005 || balance < 0;
  const paymentStatus: "PAID" | "UNPAID" | "PARTIAL" =
    args.payment?.status ??
    (paidByBalance ? "PAID" : computedTotals.payments > 0 ? "PARTIAL" : "UNPAID");

  const statusBadge = (() => {
    const map = {
      PAID: { bg: "#ECFDF5", fg: "#065F46", border: "#A7F3D0", label: "PAID / שולם" },
      PARTIAL: {
        bg: "#FFFBEB",
        fg: "#92400E",
        border: "#FDE68A",
        label: "PARTIAL / חלקי",
      },
      UNPAID: { bg: "#FEF2F2", fg: "#991B1B", border: "#FECACA", label: "UNPAID / לא שולם" },
    } as const;
    return map[paymentStatus];
  })();

  const invoiceNumber =
    args.invoiceNumber ?? `INV-${String(args.reservationId).slice(-6).toUpperCase()}`;

  const issuedAt = args.issuedAt ?? new Date();

  const rows = (args.lines ?? [])
    .map((l) => {
      const dateRaw = (l as any)?.date ?? (l as any)?.createdAt ?? (l as any)?.at;
      const dt = fmtDateTime(dateRaw ? new Date(dateRaw) : null);

      const kind = (l as any)?.kind === "PAYMENT" ? "PAYMENT" : "CHARGE";
      const kindLabel = kind === "PAYMENT" ? "Payment" : "Charge";
      const desc = esc((l as any)?.description ?? "");

      const amt = Number((l as any)?.amount ?? 0);
      const chargeCol = kind === "CHARGE" ? fmtMoney(amt) : "";
      const payCol = kind === "PAYMENT" ? fmtMoney(amt) : "";

      return `
        <tr>
          <td class="mono">${esc(dt)}</td>
          <td>
            <div class="desc">${desc || "—"}</div>
            <div class="subline">
              <span class="pill ${kind === "PAYMENT" ? "pill-pay" : "pill-charge"}">
                ${kindLabel}
              </span>
            </div>
          </td>
          <td class="num">${chargeCol}</td>
          <td class="num">${payCol}</td>
        </tr>
      `;
    })
    .join("");

  const stayLine = (() => {
    const s = args.stay;
    if (!s?.checkIn && !s?.checkOut && !s?.nights && !s?.adults && !s?.children && !s?.ratePlan)
      return "";

    const guests =
      s?.adults || s?.children
        ? `${s?.adults ?? 0} Adults${s?.children ? `, ${s.children} Children` : ""}`
        : "—";

    return `
      <div class="card">
        <div class="card-title">Stay Details <span class="he">/ פרטי שהייה</span></div>
        <div class="kv-grid">
          <div class="kv"><div class="k">Check-in</div><div class="v">${esc(fmtDate(s?.checkIn))}</div></div>
          <div class="kv"><div class="k">Check-out</div><div class="v">${esc(fmtDate(s?.checkOut))}</div></div>
          <div class="kv"><div class="k">Nights</div><div class="v">${esc(String(s?.nights ?? "—"))}</div></div>
          <div class="kv"><div class="k">Guests</div><div class="v">${esc(guests)}</div></div>
          <div class="kv span-2"><div class="k">Rate Plan</div><div class="v">${esc(s?.ratePlan ?? "—")}</div></div>
        </div>
      </div>
    `;
  })();

  const hotelMeta = args.hotel ?? {};
  const guestMeta = args.guest ?? {};

  const notes = args.notes?.trim();

  return `
<!doctype html>
<html lang="he">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Invoice ${esc(invoiceNumber)} - ${esc(args.reservationId)}</title>
    <style>
      :root{
        --ink:#0f172a;
        --muted:#64748b;
        --line:#e2e8f0;
        --soft:#f8fafc;
        --soft2:#f1f5f9;
        --card:#ffffff;
        --shadow:0 10px 30px rgba(2,6,23,.08);
      }

      *{ box-sizing:border-box; }
      html,body{ height:100%; }
      body{
        margin:0;
        color:var(--ink);
        background:#eef2ff;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* A4 print */
      @page { size: A4; margin: 12mm; }

      .sheet{
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 0;
      }
      .paper{
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
        box-shadow: var(--shadow);
        padding: 18mm 16mm;
        margin: 16px auto;
      }

      /* Header */
      .top{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:16px;
        padding-bottom: 14px;
        border-bottom: 1px solid var(--line);
      }
      .brand{
        display:flex;
        align-items:flex-start;
        gap:12px;
        min-width: 0;
      }
      .logo{
        width: 46px;
        height: 46px;
        border-radius: 12px;
        overflow:hidden;
        border:1px solid var(--line);
        background: var(--soft);
        display:flex;
        align-items:center;
        justify-content:center;
        flex:0 0 auto;
      }
      .logo img{ width:100%; height:100%; object-fit:cover; }
      .brand h1{
        margin:0;
        font-size: 18px;
        line-height: 1.15;
        letter-spacing: .2px;
        word-break: break-word;
      }
      .brand .meta{
        margin-top:6px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.45;
      }

      .doc{
        text-align:right;
        min-width: 240px;
      }
      .doc-title{
        display:flex;
        justify-content:flex-end;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
      }
      .doc h2{
        margin:0;
        font-size: 16px;
        letter-spacing: .2px;
      }
      .badge{
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding: 6px 10px;
        border-radius: 999px;
        border:1px solid ${statusBadge.border};
        background: ${statusBadge.bg};
        color: ${statusBadge.fg};
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }
      .doc .small{
        margin-top:10px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }
      .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; }

      /* Cards grid */
      .grid{
        display:grid;
        grid-template-columns: 1.2fr .8fr;
        gap: 12px;
        margin-top: 14px;
      }
      .card{
        background: var(--soft);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 12px 12px;
      }
      .card-title{
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .2px;
        margin-bottom: 10px;
      }
      .he{ color: var(--muted); font-weight: 700; }

      .kv-grid{
        display:grid;
        grid-template-columns: repeat(2, minmax(0,1fr));
        gap: 10px 12px;
      }
      .kv{ min-width:0; }
      .kv .k{
        font-size: 11px;
        color: var(--muted);
        margin-bottom: 3px;
      }
      .kv .v{
        font-size: 12px;
        font-weight: 700;
        word-break: break-word;
      }
      .span-2{ grid-column: span 2; }

      /* Table */
      table{
        width:100%;
        border-collapse: separate;
        border-spacing: 0;
        margin-top: 14px;
        border: 1px solid var(--line);
        border-radius: 14px;
        overflow:hidden;
        background: #fff;
      }
      thead th{
        background: var(--soft2);
        color: var(--ink);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .08em;
        padding: 10px 10px;
        border-bottom: 1px solid var(--line);
        text-align:left;
      }
      tbody td{
        font-size: 12px;
        padding: 10px 10px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      tbody tr:nth-child(2n){ background: #fcfcff; }
      tbody tr:last-child td{ border-bottom: none; }

      .num{ text-align:right; white-space:nowrap; }
      .desc{ font-weight: 700; }
      .subline{ margin-top: 6px; }
      .pill{
        display:inline-flex;
        align-items:center;
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 800;
        border: 1px solid var(--line);
        background: var(--soft);
        color: var(--muted);
      }
      .pill-charge{ background:#eff6ff; border-color:#bfdbfe; color:#1d4ed8; }
      .pill-pay{ background:#ecfdf5; border-color:#a7f3d0; color:#065f46; }

      /* Totals */
      .bottom{
        margin-top: 14px;
        display:grid;
        grid-template-columns: 1fr 340px;
        gap: 12px;
        align-items:start;
      }
      .totals{
        border: 1px solid var(--line);
        border-radius: 14px;
        background: #fff;
        padding: 12px 12px;
      }
      .row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding: 7px 0;
        font-size: 12px;
        border-bottom: 1px dashed var(--line);
      }
      .row:last-child{ border-bottom:none; }
      .row strong{ font-size: 13px; }
      .due{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        padding-top: 10px;
        margin-top: 10px;
        border-top: 1px solid var(--line);
        font-weight: 900;
        font-size: 14px;
      }
      .due .value{
        padding: 6px 10px;
        border-radius: 12px;
        border: 1px solid var(--line);
        background: ${paymentStatus === "PAID" ? "#ECFDF5" : paymentStatus === "PARTIAL" ? "#FFFBEB" : "#FEF2F2"};
        color: ${paymentStatus === "PAID" ? "#065F46" : paymentStatus === "PARTIAL" ? "#92400E" : "#991B1B"};
        white-space:nowrap;
      }

      /* Footer */
      .footer{
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--line);
        display:flex;
        justify-content:space-between;
        gap:12px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.5;
      }
      .footer .right{ text-align:right; }

      /* Print tweaks */
      @media print{
        body{ background:#fff; }
        .paper{
          margin:0;
          box-shadow:none;
          border:none;
          border-radius: 0;
          padding: 0;
        }
        .sheet{ width:auto; min-height:auto; }
        table{ page-break-inside:auto; }
        tr{ page-break-inside:avoid; break-inside:avoid; }
        thead{ display: table-header-group; }
        .footer{ position: fixed; bottom: 10mm; left: 12mm; right: 12mm; }
      }
    </style>
  </head>

  <body>
    <div class="sheet">
      <div class="paper">
        <div class="top">
          <div class="brand">
            <div class="logo">
              ${
                hotelMeta.logoUrl
                  ? `<img src="${esc(hotelMeta.logoUrl)}" alt="Logo" />`
                  : `<span class="mono" style="font-weight:900;color:#334155;">FD</span>`
              }
            </div>
            <div class="brand-text">
              <h1>${esc(args.hotelName)}</h1>
              <div class="meta">
                ${hotelMeta.address ? `${esc(hotelMeta.address)}<br/>` : ""}
                ${hotelMeta.phone ? `Tel: ${esc(hotelMeta.phone)} · ` : ""}
                ${hotelMeta.email ? `Email: ${esc(hotelMeta.email)}<br/>` : ""}
                ${hotelMeta.website ? `${esc(hotelMeta.website)}<br/>` : ""}
                ${hotelMeta.taxId ? `Tax ID: ${esc(hotelMeta.taxId)}` : ""}
              </div>
            </div>
          </div>

          <div class="doc">
            <div class="doc-title">
              <div class="badge">${statusBadge.label}</div>
              <h2>Invoice <span class="he">/ חשבונית</span></h2>
            </div>
            <div class="small">
              <div><span class="mono">${esc(invoiceNumber)}</span></div>
              <div>Issued: <span class="mono">${esc(fmtDateTime(issuedAt))}</span></div>
              <div>Due: <span class="mono">${esc(fmtDate(args.dueAt ?? null))}</span></div>
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Customer <span class="he">/ לקוח</span></div>
            <div class="kv-grid">
              <div class="kv">
                <div class="k">Name</div>
                <div class="v">${esc(args.guestName || "—")}</div>
              </div>
              <div class="kv">
                <div class="k">Email</div>
                <div class="v">${esc(args.guestEmail || "—")}</div>
              </div>
              <div class="kv">
                <div class="k">Phone</div>
                <div class="v">${esc(guestMeta.phone ?? "—")}</div>
              </div>
              <div class="kv">
                <div class="k">Company / Tax ID</div>
                <div class="v">${esc(
                  guestMeta.companyName
                    ? `${guestMeta.companyName}${guestMeta.taxId ? ` · ${guestMeta.taxId}` : ""}`
                    : guestMeta.taxId ?? "—"
                )}</div>
              </div>
              <div class="kv span-2">
                <div class="k">Address</div>
                <div class="v">${esc(guestMeta.address ?? "—")}</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Reservation <span class="he">/ הזמנה</span></div>
            <div class="kv-grid">
              <div class="kv">
                <div class="k">Reservation ID</div>
                <div class="v mono">${esc(args.reservationId)}</div>
              </div>
              <div class="kv">
                <div class="k">Room</div>
                <div class="v">#${esc(String(args.roomNumber))}</div>
              </div>
              <div class="kv span-2">
                <div class="k">Payment</div>
                <div class="v">${esc(
                  args.payment?.methodSummary
                    ? `${args.payment.methodSummary}${args.payment.reference ? ` · ${args.payment.reference}` : ""}`
                    : "—"
                )}</div>
              </div>
            </div>
          </div>
        </div>

        ${stayLine}

        <table>
          <thead>
            <tr>
              <th style="width: 26%;">Date</th>
              <th>Description</th>
              <th style="width: 16%; text-align:right;">Charge</th>
              <th style="width: 16%; text-align:right;">Payment</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows ||
              `<tr>
                <td class="mono">—</td>
                <td><div class="desc">No line items</div><div class="subline">Nothing was posted to folio yet.</div></td>
                <td class="num"></td>
                <td class="num"></td>
              </tr>`
            }
          </tbody>
        </table>

        <div class="bottom">
          <div class="card">
            <div class="card-title">Summary <span class="he">/ סיכום</span></div>
            <div class="kv-grid">
              <div class="kv">
                <div class="k">Total Charges</div>
                <div class="v">${esc(fmtMoney(computedTotals.charges))}</div>
              </div>
              <div class="kv">
                <div class="k">Total Payments</div>
                <div class="v">${esc(fmtMoney(computedTotals.payments))}</div>
              </div>
              <div class="kv span-2">
                <div class="k">Notes</div>
                <div class="v" style="font-weight:600;color:var(--muted);">
                  ${esc(
                    notes ??
                      "Thank you for your stay. For questions, contact the front desk."
                  )}
                </div>
              </div>
            </div>
          </div>

          <div class="totals">
            <div class="row"><span>Charges</span><span class="mono">${esc(fmtMoney(computedTotals.charges))}</span></div>
            <div class="row"><span>Payments</span><span class="mono">${esc(fmtMoney(computedTotals.payments))}</span></div>
            <div class="due">
              <span>Balance Due</span>
              <span class="value mono">${esc(fmtMoney(computedTotals.balance))}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <div>
            Generated by <strong>FrontDeskFlow</strong><br/>
            Printed: <span class="mono">${esc(fmtDateTime(new Date()))}</span>
          </div>
          <div class="right">
            Invoice: <span class="mono">${esc(invoiceNumber)}</span><br/>
            Reservation: <span class="mono">${esc(args.reservationId)}</span>
          </div>
        </div>

        <script>
          // Tell parent (iframe host) that invoice is ready for printing.
          (function(){
            try{
              var send = function(){ parent && parent.postMessage({ type: "INVOICE_READY" }, "*"); };
              if (document.readyState === "complete") send();
              else window.addEventListener("load", send);
            } catch(e) {}
          })();
        </script>
      </div>
    </div>
  </body>
</html>
`;
}
