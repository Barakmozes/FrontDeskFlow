/**
 * Folio v0 storage strategy (NO backend schema changes):
 * - We store manual charges/payments as Notifications
 * - type = "FOLIO"
 * - message = "FOLIO|<json>"
 *
 * Later we will replace this with real models:
 * Charges, Payments, Invoices (Module 5). :contentReference[oaicite:5]{index=5}
 */

export type FolioKind = "CHARGE" | "PAYMENT";

export type PaymentMethod = "CASH" | "CARD" | "BANK" | "OTHER";

export type FolioPayloadV1 = {
  v: 1;
  kind: FolioKind;
  amount: number; // always positive
  description: string;

  // linking fields
  reservationId: string;
  tableId: string;

  // used for quick filtering/grouping (YYYY-MM-DD local)
  dateKey: string;

  // audit fields
  createdAt: string; // ISO
  createdByEmail?: string | null;

  // payment-only fields
  method?: PaymentMethod;
  reference?: string | null;
};

export const FOLIO_TYPE = "FOLIO";
export const FOLIO_PREFIX = "FOLIO|";

export function encodeFolioMessage(payload: FolioPayloadV1): string {
  return `${FOLIO_PREFIX}${JSON.stringify(payload)}`;
}

export function parseFolioMessage(message: string): FolioPayloadV1 | null {
  if (!message?.startsWith(FOLIO_PREFIX)) return null;
  const raw = message.slice(FOLIO_PREFIX.length);

  try {
    const parsed = JSON.parse(raw) as FolioPayloadV1;
    if (!parsed || parsed.v !== 1) return null;
    if (parsed.kind !== "CHARGE" && parsed.kind !== "PAYMENT") return null;
    if (typeof parsed.amount !== "number" || !(parsed.amount > 0)) return null;
    if (typeof parsed.description !== "string" || parsed.description.trim().length === 0) return null;
    if (typeof parsed.reservationId !== "string" || !parsed.reservationId) return null;
    if (typeof parsed.tableId !== "string" || !parsed.tableId) return null;
    if (typeof parsed.dateKey !== "string" || !parsed.dateKey) return null;
    if (typeof parsed.createdAt !== "string" || !parsed.createdAt) return null;
    return parsed;
  } catch {
    return null;
  }
}
