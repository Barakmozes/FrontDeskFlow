"use client";

import React, { useMemo } from "react";
import { useMutation, useQuery } from "@urql/next";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { HiCheck, HiXCircle } from "react-icons/hi2";

import {
  EditOrderDocument,
  type EditOrderMutation,
  type EditOrderMutationVariables,
  GetOrdersDocument,
  type GetOrdersQuery,
  type GetOrdersQueryVariables,
  OrderStatus,
} from "@/graphql/generated";

import AdminOrderModal from "./AdminOrderModal";

import {
  compactId,
  classifyOrder,
  deriveStayStage,
  formatDateTime,
  formatMoney,
  isOrderPaid,
  orderKindLabel,
  orderKindTone,
  parseRoomChargeNote,
  safeLower,
  toDateKey,
  type OrdersLookups,
  type OrderKind,
  type Tone,
} from "./orderLinking";

import { folioReservationIdForDateKey, todayLocalDateKey } from "@/lib/stayGrouping";

/* ------------------------------- UI helpers ------------------------------- */

function Badge({ label, tone = "gray" }: { label: string; tone?: Tone }) {
  const cls =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : tone === "blue"
      ? "bg-blue-100 text-blue-800"
      : tone === "red"
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-800";

  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] ${cls}`}>{label}</span>;
}

/* --------------------------------- Types --------------------------------- */

type Props = {
  variables: GetOrdersQueryVariables;
  isLastPage: boolean;
  onLoadMore: (after: string) => void;
  lookups: OrdersLookups;
  staffEmail: string | null;
};

type OrdersEdge = NonNullable<GetOrdersQuery["getOrders"]["edges"][number]>;
type OrderNode = OrdersEdge["node"];

// Widened type so we can *optionally* use fields that may not be in the list query.
// (Modal always fetches full order details.)
type OrderNodeExt = OrderNode & {
  note?: string | null;
  tableId?: string | null;
  total?: number | null;
  paymentToken?: string | null;
  paid?: boolean | null;
  userEmail?: string | null;
};

export function AdminFetchedOrders({
  variables,
  isLastPage,
  onLoadMore,
  lookups,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayKey = useMemo(() => todayLocalDateKey(), []);

  const [{ data, fetching, error }] = useQuery<GetOrdersQuery, GetOrdersQueryVariables>({
    query: GetOrdersDocument,
    variables,
    requestPolicy: "cache-and-network",
  });

  const orders = (data?.getOrders.edges ?? []).filter(Boolean) as OrdersEdge[];
  const endCursor = data?.getOrders.pageInfo.endCursor ?? null;
  const hasNextPage = Boolean(data?.getOrders.pageInfo.hasNextPage);

  const [{}, editOrder] = useMutation<EditOrderMutation, EditOrderMutationVariables>(EditOrderDocument);

  const changeOrderStatus = async (id: string, newStatus: OrderStatus, successMessage: string) => {
    try {
      const res = await editOrder({ status: newStatus, editOrderId: id });

      if (res.data?.editOrder) {
        toast.success(successMessage, { duration: 2500 });
        router.refresh();
      } else if (res.error) {
        toast.error(res.error.message ?? "Failed to update order.");
      } else {
        toast.error("Failed to update order.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Unexpected error while updating order.");
    }
  };

  const markCollected = (id: string) =>
    changeOrderStatus(id, OrderStatus.Collected, "Order marked as Collected");

  const markDelivered = (id: string) =>
    changeOrderStatus(id, OrderStatus.Delivered, "Order marked as Delivered");

  // Filters from URL (synced with OrdersFilter component)
  const q = safeLower((searchParams.get("q") ?? "").trim());
  const hotelFilter = searchParams.get("hotel") ?? "ALL";
  const kindFilter = (searchParams.get("kind") ?? "ALL") as
    | "ALL"
    | "ROOM_CHARGE"
    | "ROOM_SERVICE"
    | "DELIVERY";
  const paidFilter = (searchParams.get("paid") ?? "ALL") as "ALL" | "PAID" | "UNPAID";
  const bookingFilter = (searchParams.get("booking") ?? "ALL") as "ALL" | "LINKED" | "UNLINKED";
  const fromKey = searchParams.get("from") ?? "";
  const toKey = searchParams.get("to") ?? "";

  const rows = useMemo(() => {
    return orders.map((edge) => {
      const o = edge.node as OrderNodeExt;

      const meta = parseRoomChargeNote(o.note ?? null);
   const kind: OrderKind = classifyOrder({
  note: o.note ?? null,
  orderNumber: o.orderNumber ?? null,
  deliveryAddress: (o as any).deliveryAddress ?? null,
  tableId: o.tableId ?? null, // ✅ חשוב
});

      const dateKey = meta?.dateKey ?? toDateKey((o as any).orderDate) ?? null;

      const stay =
        meta?.reservationId
          ? lookups.stayByReservationId.get(meta.reservationId) ?? null
          : o.tableId && (o.userEmail ?? null) && dateKey
          ? lookups.stayByRoomEmailDateKey.get(`${o.tableId}|${(o.userEmail ?? "").toLowerCase()}|${dateKey}`) ??
            null
          : null;

      const roomId = (o.tableId ?? meta?.roomId ?? stay?.roomId ?? null) as string | null;
      const room = roomId ? lookups.roomById.get(roomId) ?? null : null;

      const hotelId = (meta?.hotelId ?? stay?.hotelId ?? room?.areaId ?? null) as string | null;
      const hotelName = hotelId ? lookups.hotelById.get(hotelId)?.name ?? null : null;

      const roomNumber =
        meta?.roomNumber ?? stay?.roomNumber ?? room?.tableNumber ?? null;

      const stage = stay ? deriveStayStage(stay, todayKey) : null;

      const folioId =
        meta?.reservationId ??
        (stay && dateKey ? folioReservationIdForDateKey(stay, dateKey) : null);

      const paid = isOrderPaid({ paid: o.paid ?? null, paymentToken: o.paymentToken ?? null });

      const total = typeof o.total === "number" ? o.total : o.total != null ? Number(o.total) : null;

      return {
        id: o.id,
        order: o,
        kind,
        meta,
        stay,
        roomId,
        hotelId,
        hotelName,
        roomNumber,
        dateKey,
        stage,
        folioId,
        paid,
        total,
      };
    });
  }, [orders, lookups, todayKey]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      // Search
      if (q) {
        const hay = [
          r.order.orderNumber,
          (r.order as any).userName,
          (r.order as any).userEmail,
          (r.order as any).userPhone,
          (r.order as any).status,
          (r.order as any).deliveryAddress ?? "",
          r.hotelName ?? "",
          r.roomNumber != null ? `room ${r.roomNumber}` : "",
          r.meta?.reservationId ?? "",
          r.folioId ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!hay.includes(q)) return false;
      }

      // Hotel
      if (hotelFilter !== "ALL") {
        if (!r.hotelId) return false;
        if (r.hotelId !== hotelFilter) return false;
      }

      // Kind
      if (kindFilter !== "ALL" && r.kind !== kindFilter) return false;

      // Paid
      if (paidFilter === "PAID" && !r.paid) return false;
      if (paidFilter === "UNPAID" && r.paid) return false;

      // Booking linkage
      if (bookingFilter === "LINKED" && !r.stay) return false;
      if (bookingFilter === "UNLINKED" && r.stay) return false;

      // Date range filter uses dateKey (best-effort)
      if (fromKey && r.dateKey && r.dateKey < fromKey) return false;
      if (toKey && r.dateKey && r.dateKey > toKey) return false;

      return true;
    });
  }, [rows, q, hotelFilter, kindFilter, paidFilter, bookingFilter, fromKey, toKey]);

  return (
    <tbody>
      {/* Loading / error banner (first page only) */}
      {variables.after === null && error ? (
        <tr className="bg-white">
          <td className="px-6 py-4 text-sm text-red-600" colSpan={9}>
            Failed to load orders: {error.message}
          </td>
        </tr>
      ) : null}

      {variables.after === null && fetching && orders.length === 0 ? (
        <tr className="bg-white">
          <td className="px-6 py-4 text-sm text-slate-500" colSpan={9}>
            Loading orders…
          </td>
        </tr>
      ) : null}

      {filtered.map((r) => {
        const o = r.order;

        const statusStr = String((o as any).status ?? "—");
        const kindTone = orderKindTone(r.kind);
        const kindLabel = orderKindLabel(r.kind);

        const guestLabel = (o as any).userName ?? (o as any).userEmail ?? "—";
        const guestEmail = (o as any).userEmail ?? null;

        const placedAt = formatDateTime((o as any).orderDate);

        const isDelivery = r.kind === "DELIVERY";
        const canCollect =
          isDelivery &&
          statusStr !== String(OrderStatus.Collected) &&
          statusStr !== String(OrderStatus.Delivered);

        const canDeliver = isDelivery && statusStr !== String(OrderStatus.Delivered);

        return (
          <tr
            key={o.id}
            className={`whitespace-nowrap bg-white ${
              r.paid ? "" : "bg-rose-50"
            }`}
            title={r.paid ? "" : "Unpaid"}
          >
            {/* Booking / room */}
            <td className="px-6 py-3">
              <div className="flex flex-col gap-1">
                <div className="text-sm font-medium text-slate-800">
                  {r.hotelName ? r.hotelName : "—"}
                  {r.roomNumber != null ? ` • Room ${r.roomNumber}` : ""}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge label={kindLabel} tone={kindTone} />
                  {r.stage ? <Badge label={r.stage.label} tone={r.stage.tone} /> : null}
                  {r.folioId ? <Badge label={`Folio ${compactId(r.folioId)}`} tone="gray" /> : null}
                </div>

                {guestEmail ? (
                  <div className="text-[11px] text-slate-500">{guestEmail}</div>
                ) : null}
              </div>
            </td>

            {/* Order # */}
            <td className="px-6 py-3 font-medium text-slate-800">{o.orderNumber}</td>

            {/* Placed */}
            <td className="px-6 py-3 text-sm">{placedAt}</td>

            {/* Guest */}
            <td className="px-6 py-3 text-sm">{guestLabel}</td>

            {/* Amount */}
            <td className="px-6 py-3 text-sm">{formatMoney(r.total)}</td>

            {/* Paid */}
            <td className="px-6 py-3">
              {r.paid ? (
                <HiCheck className="w-5 h-5 font-bold text-emerald-600" />
              ) : (
                <HiXCircle className="text-rose-600" size={20} />
              )}
            </td>

            {/* Status */}
            <td className="px-6 py-3">
              <Badge label={statusStr} tone={statusStr === "DELIVERED" ? "green" : "gray"} />
            </td>

            {/* Actions */}
            <td className="px-6 py-3">
              {isDelivery ? (
                <div className="flex flex-wrap gap-2">
                  {statusStr === "COLLECTED" || statusStr === "DELIVERED" ? (
                    <Badge label="Collected" tone="green" />
                  ) : (
                    <button
                      className="rounded text-xs font-semibold bg-emerald-100 px-2 py-1 text-emerald-700 hover:bg-emerald-200"
                      onClick={() => markCollected(o.id)}
                      disabled={!canCollect}
                      title="Mark Collected"
                    >
                      Mark Collected
                    </button>
                  )}

                  {statusStr === "DELIVERED" ? (
                    <Badge label="Delivered" tone="green" />
                  ) : (
                    <button
                      className="rounded text-xs font-semibold bg-rose-100 px-2 py-1 text-rose-700 hover:bg-rose-200"
                      onClick={() => markDelivered(o.id)}
                      disabled={!canDeliver}
                      title="Mark Delivered"
                    >
                      Mark Delivered
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </td>

            {/* View */}
            <td className="px-6 py-3">
              <AdminOrderModal
                lookups={lookups}
                orderSummary={{
                  id: o.id,
                  orderNumber: o.orderNumber,
                  userName: (o as any).userName ?? null,
                  userEmail: (o as any).userEmail ?? null,
                  userPhone: (o as any).userPhone ?? null,
                  deliveryAddress: (o as any).deliveryAddress ?? null,
                }}
              />
            </td>
          </tr>
        );
      })}

      {/* Load more */}
      {isLastPage ? (
        <tr className="bg-white">
          <td colSpan={9} className="px-6 py-4">
            {hasNextPage && endCursor ? (
              <button
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={fetching}
                onClick={() => onLoadMore(endCursor)}
              >
                {fetching ? "Loading…" : "Load more"}
              </button>
            ) : (
              <span className="text-xs text-slate-400">No more orders.</span>
            )}
          </td>
        </tr>
      ) : null}
    </tbody>
  );
}
