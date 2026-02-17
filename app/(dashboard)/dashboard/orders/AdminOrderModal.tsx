"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@urql/next";
import { HiOutlineEye } from "react-icons/hi2";

import Modal from "@/app/components/Common/Modal";
import {
  GetOrderDocument,
  type GetOrderQuery,
  type GetOrderQueryVariables,
  ReservationStatus,
} from "@/graphql/generated";

import {
  classifyOrder,
  compactId,
  deriveStayStage,
  formatDateTime,
  formatMoney,
  isOrderPaid,
  orderKindLabel,
  orderKindTone,
  parseRoomChargeNote,
  toDateKey,
  type OrdersLookups,
  type Tone,
} from "./orderLinking";

import { folioReservationIdForDateKey, todayLocalDateKey } from "@/lib/stayGrouping";

type OrderSummary = {
  id: string;
  orderNumber: string;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  deliveryAddress: string | null;
};

type Props = {
  orderSummary: OrderSummary;
  lookups: OrdersLookups;
};

type CartItem = {
  id?: string;
  image?: string | null;
  title?: string | null;
  prepare?: string | null;
  instructions?: string | null;
  price?: number | string | null;
  quantity?: number | string | null;
};

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

export default function AdminOrderModal({ orderSummary, lookups }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const todayKey = useMemo(() => todayLocalDateKey(), []);

  const [{ data, fetching, error }] = useQuery<GetOrderQuery, GetOrderQueryVariables>({
    query: GetOrderDocument,
    variables: { getOrderId: orderSummary.id },
    pause: !isOpen,
    requestPolicy: "network-only",
  });

  const order = data?.getOrder;

  const cartItems = useMemo(() => normalizeCart(order?.cart), [order?.cart]);

  const discount = Number(order?.discount ?? 0);
  const serviceFee = Number(order?.serviceFee ?? 0);
  const total = Number(order?.total ?? 0);

  // Booking linking (room charge meta -> stay -> hotel/room)
  const meta = useMemo(() => parseRoomChargeNote(order?.note ?? null), [order?.note]);

  const kind = useMemo(() => {
    return classifyOrder({
      note: order?.note ?? null,
      orderNumber: order?.orderNumber ?? orderSummary.orderNumber,
      deliveryAddress: order?.deliveryAddress ?? orderSummary.deliveryAddress,
    });
  }, [order?.note, order?.orderNumber, order?.deliveryAddress, orderSummary.orderNumber, orderSummary.deliveryAddress]);

  const paid = useMemo(() => {
    return isOrderPaid({ paid: order?.paid ?? null, paymentToken: order?.paymentToken ?? null });
  }, [order?.paid, order?.paymentToken]);

  const dateKey = useMemo(() => {
    return meta?.dateKey ?? toDateKey(order?.orderDate ?? null);
  }, [meta?.dateKey, order?.orderDate]);

  const roomId = (order as any)?.tableId ?? meta?.roomId ?? null;
  const room = roomId ? lookups.roomById.get(roomId) ?? null : null;

  const hotelId = meta?.hotelId ?? room?.areaId ?? null;
  const hotel = hotelId ? lookups.hotelById.get(hotelId) ?? null : null;

  const roomNumber = meta?.roomNumber ?? room?.tableNumber ?? null;

  const stay = useMemo(() => {
    if (meta?.reservationId) return lookups.stayByReservationId.get(meta.reservationId) ?? null;

    const email = (order?.userEmail ?? orderSummary.userEmail ?? "").toLowerCase();
    if (!roomId || !email || !dateKey) return null;
    return lookups.stayByRoomEmailDateKey.get(`${roomId}|${email}|${dateKey}`) ?? null;
  }, [meta?.reservationId, lookups, roomId, dateKey, order?.userEmail, orderSummary.userEmail]);

  const stage = stay ? deriveStayStage(stay, todayKey) : null;

  const folioId =
    meta?.reservationId ?? (stay && dateKey ? folioReservationIdForDateKey(stay, dateKey) : null);

  const bookingCreatedBy = useMemo(() => {
    if (!stay) return null;

    const targetReservationId = meta?.reservationId ?? folioId ?? null;
    const res =
      targetReservationId && Array.isArray(stay.reservations)
        ? stay.reservations.find((r: any) => r?.id === targetReservationId) ?? stay.reservations[0]
        : (stay as any)?.reservations?.[0];

    const createdByUserEmail = (res as any)?.createdByUserEmail ?? null;
    const createdByRole = (res as any)?.createdBy ?? null;

    if (!createdByUserEmail && !createdByRole) return null;
    return { createdByUserEmail, createdByRole };
  }, [stay, meta?.reservationId, folioId]);

  return (
    <>
      <HiOutlineEye className="cursor-pointer" onClick={() => setIsOpen(true)} />

      <Modal
        isOpen={isOpen}
        title={`Order: ${order?.orderNumber ?? orderSummary.orderNumber}`}
        closeModal={() => setIsOpen(false)}
      >
        {/* Top badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={orderKindLabel(kind)} tone={orderKindTone(kind)} />
          {stage ? <Badge label={stage.label} tone={stage.tone} /> : null}
          <Badge label={paid ? "Paid" : "Unpaid"} tone={paid ? "green" : "red"} />
          {order?.status ? <Badge label={String(order.status)} tone="gray" /> : null}
        </div>

        {/* Booking section */}
        <div className="mt-3 rounded-lg border bg-slate-50 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <div className="text-xs text-slate-600">Booking context</div>

              <div className="text-sm font-semibold text-slate-900">
                {hotel?.name ?? "—"}
                {roomNumber != null ? ` • Room ${roomNumber}` : ""}
              </div>

              {stay ? (
                <div className="text-xs text-slate-600">
                  Stay: <span className="text-slate-800">{stay.startDateKey} → {stay.endDateKey}</span>{" "}
                  • {stay.nights} night{stay.nights === 1 ? "" : "s"} • {stay.guests} guest
                  {stay.guests === 1 ? "" : "s"}
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Not linked to a booking (or booking data not available for this order).
                </div>
              )}

              {bookingCreatedBy ? (
                <div className="text-xs text-slate-600">
                  Created by:{" "}
                  <span className="text-slate-800">
                    {bookingCreatedBy.createdByRole ?? "Staff"}
                    {bookingCreatedBy.createdByUserEmail ? ` • ${bookingCreatedBy.createdByUserEmail}` : ""}
                  </span>
                </div>
              ) : null}

              {meta?.reservationId ? (
                <div className="text-[11px] text-slate-500">
                  Room charge meta: res={compactId(meta.reservationId)}{meta.dateKey ? ` • date=${meta.dateKey}` : ""}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {folioId ? (
                <Link
                  href={`/dashboard/folio/${folioId}`}
                  className="rounded-md bg-blue-700 px-3 py-2 text-xs text-white hover:bg-blue-800"
                >
                  Open folio
                </Link>
              ) : null}

              {(order?.paymentToken || paid) && order?.paymentToken ? (
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-xs hover:bg-white"
                  title={order.paymentToken}
                >
                  Payment token: {compactId(order.paymentToken, 10)}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Guest header */}
        <div className="mt-3 bg-white p-3 rounded-md border text-sm">
          <div className="font-semibold">{order?.userName ?? orderSummary.userName ?? "-"}</div>
          <div className="text-slate-600">{order?.userEmail ?? orderSummary.userEmail ?? "-"}</div>
          <div className="text-slate-600">{order?.userPhone ?? orderSummary.userPhone ?? "-"}</div>
          <div className="text-slate-600">{order?.deliveryAddress ?? orderSummary.deliveryAddress ?? "-"}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Placed: {formatDateTime(order?.orderDate ?? null)}
          </div>
        </div>

        {/* Body */}
        <div className="mt-4">
          {fetching && !order ? <p className="text-sm text-gray-500">Loading order details…</p> : null}
          {error ? <p className="text-sm text-red-600">Failed to load order: {error.message}</p> : null}

          {/* Items */}
          <div className="space-y-3">
            {cartItems.length === 0 && order ? (
              <p className="text-sm text-gray-500">No items in this order.</p>
            ) : null}

            {cartItems.map((cart, idx) => (
              <div className="flex items-start gap-3" key={cart.id ?? `${cart.title ?? "item"}-${idx}`}>
                <div className="relative w-16 h-16 rounded-md overflow-hidden border bg-white">
                  {cart.image ? (
                    <Image
                      src={safeImageSrc(cart.image)}
                      alt={cart.title ?? "Item"}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                      No image
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{cart.title ?? "Item"}</p>
                      {cart.prepare ? (
                        <p className="text-xs text-gray-500">Prep: {cart.prepare}</p>
                      ) : null}
                      {cart.instructions ? (
                        <p className="text-xs text-gray-500">Notes: {cart.instructions}</p>
                      ) : null}
                    </div>

                    <div className="text-right text-sm">
                      <div className="text-gray-900 font-semibold">
                        {formatMoney(cart.price)}
                      </div>
                      <div className="text-xs text-gray-500">× {Number(cart.quantity ?? 1)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          {order ? (
            <div className="mt-4 rounded-md border bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Discount</span>
                <span className="text-slate-900">{formatMoney(discount)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-600">Service fee</span>
                <span className="text-slate-900">{formatMoney(serviceFee)}</span>
              </div>
              <div className="flex justify-between mt-2 font-semibold">
                <span className="text-slate-800">Total</span>
                <span className="text-slate-900">{formatMoney(total)}</span>
              </div>

              {order.note ? (
                <div className="mt-3 text-[11px] text-slate-500 break-words">
                  <span className="font-semibold">Note:</span> {order.note}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

/* ----------------------------- Cart Normalizer ----------------------------- */

function normalizeCart(raw: unknown): CartItem[] {
  if (!raw) return [];

  // If it's already an array
  if (Array.isArray(raw)) return raw as CartItem[];

  // If cart is stringified JSON
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
    } catch {
      return [];
    }
  }

  // If cart is an object that looks like { items: [...] }
  if (typeof raw === "object" && raw !== null) {
    const maybeItems = (raw as any).items;
    if (Array.isArray(maybeItems)) return maybeItems as CartItem[];
  }

  return [];
}

function safeImageSrc(src: string) {
  if (!src) return "/img/banner.jpg";
  if (src.startsWith("http")) return src;
  if (src.startsWith("/")) return src;
  return `/${src}`;
}
