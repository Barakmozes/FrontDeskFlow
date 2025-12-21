"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";

import {
  // queries
  GetUserNotificationsDocument,
  GetUserNotificationsQuery,
  GetUserNotificationsQueryVariables,

  GetTableOrderDocument,
  GetTableOrderQuery,
  GetTableOrderQueryVariables,

  // mutations
  AddNotificationDocument,
  AddNotificationMutation,
  AddNotificationMutationVariables,

  DeleteNotificationDocument,
  DeleteNotificationMutation,
  DeleteNotificationMutationVariables,

  CompleteReservationDocument,
  CompleteReservationMutation,
  CompleteReservationMutationVariables,

  ToggleTableReservationDocument,
  ToggleTableReservationMutation,
  ToggleTableReservationMutationVariables,

  UpdateManyTablesDocument,
  UpdateManyTablesMutation,
  UpdateManyTablesMutationVariables,

  NotificationPriority,
  NotificationStatus,
  Role,
} from "@/graphql/generated";

import { toLocalDateKey } from "@/app/components/Restaurant_interface/Operations/opsDate";
import { applyHousekeepingPatch } from "@/lib/housekeepingTags";

import AddFolioEntryModal from "./AddFolioEntryModal";
import { buildInvoiceHtml } from "./printInvoice";
import type { FolioLine } from "./types";
import {
  FOLIO_TYPE,
  encodeFolioMessage,
  parseFolioMessage,
  type FolioKind,
  type FolioPayloadV1,
} from "@/lib/folioEncoding";

type ReservationShape = {
  id: string;
  userEmail: string;
  reservationTime: any;
  status: any;
  tableId: string;
  table: {
    id: string;
    tableNumber: number;
    areaId: string;
    reserved: boolean;
    specialRequests: string[];
  };
  user?: { profile?: { name?: string | null; phone?: string | null } | null } | null;
};

const money = (n: number) => n.toFixed(2);

export default function FolioPanel({
  reservation,
  hotelName,
  staffEmail,
  staffRole,
}: {
  reservation: ReservationShape;
  hotelName: string;
  staffEmail: string | null;
  staffRole: Role | null;
}) {
  const dateKey = useMemo(
    () => toLocalDateKey(reservation.reservationTime),
    [reservation.reservationTime]
  );

  const guestName =
    reservation.user?.profile?.name?.trim() || reservation.userEmail;

  const canOverrideCheckout = staffRole === Role.Admin || staffRole === Role.Manager;

  // --- Fetch room service orders for this room ---
  const [{ data: ordersData, fetching: ordersFetching, error: ordersError }, refetchOrders] =
    useQuery<GetTableOrderQuery, GetTableOrderQueryVariables>({
      query: GetTableOrderDocument,
      variables: { tableId: reservation.tableId },
    });

  const allOrders = ordersData?.getTableOrder ?? [];

  // We only include room-service orders that happened on this reservation's date (v0 stay model)
  const ordersForStayDay = useMemo(() => {
    return allOrders.filter((o) => toLocalDateKey(o.orderDate) === dateKey);
  }, [allOrders, dateKey]);

  // --- Fetch manual charges/payments stored as Notifications under guest user ---
  const [
    { data: notifData, fetching: notifsFetching, error: notifsError },
    refetchNotifs,
  ] = useQuery<GetUserNotificationsQuery, GetUserNotificationsQueryVariables>({
    query: GetUserNotificationsDocument,
    variables: { userEmail: reservation.userEmail },
  });

  const notifications = notifData?.getUserNotifications ?? [];

  const manualLines = useMemo<FolioLine[]>(() => {
    const lines: FolioLine[] = [];

    for (const n of notifications) {
      if (n.type !== FOLIO_TYPE) continue;

      const payload = parseFolioMessage(n.message);
      if (!payload) continue;

      // Strict link to reservation; fallback link by (tableId + dateKey)
      const linked =
        payload.reservationId === reservation.id ||
        (payload.tableId === reservation.tableId && payload.dateKey === dateKey);

      if (!linked) continue;

      lines.push({
        id: n.id,
        kind: payload.kind,
        source: "MANUAL",
        date: payload.createdAt,
        description:
          payload.kind === "PAYMENT" && payload.method
            ? `${payload.description} (${payload.method})`
            : payload.description,
        amount: payload.amount,
        deletable: true,
      });
    }

    // newest first
    return lines.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [notifications, reservation.id, reservation.tableId, dateKey]);

  const roomServiceLines = useMemo<FolioLine[]>(() => {
    return ordersForStayDay
      .filter((o) => o.status !== "CANCELLED")
      .map((o) => ({
        id: `order:${o.id}`,
        kind: "CHARGE" as const,
        source: "ROOM_SERVICE" as const,
        date: new Date(o.orderDate).toISOString(),
        description: `Room service #${o.orderNumber}${o.paid ? " (paid)" : ""}`,
        amount: o.total,
        deletable: false,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [ordersForStayDay]);

  const allLines = useMemo(() => {
    const combined = [...roomServiceLines, ...manualLines];
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [roomServiceLines, manualLines]);

  const totals = useMemo(() => {
    const charges = allLines
      .filter((l) => l.kind === "CHARGE")
      .reduce((s, l) => s + l.amount, 0);

    // payments are:
    // - manual payment lines
    // - + paid room service orders (represented as charge lines; we credit them here)
    const manualPayments = allLines
      .filter((l) => l.kind === "PAYMENT")
      .reduce((s, l) => s + l.amount, 0);

    const paidRoomService = ordersForStayDay
      .filter((o) => o.paid)
      .reduce((s, o) => s + o.total, 0);

    const payments = manualPayments + paidRoomService;
    const balance = charges - payments;

    return { charges, payments, balance };
  }, [allLines, ordersForStayDay]);

  // --- Mutations ---
  const [{ fetching: creating }, addNotification] = useMutation<
    AddNotificationMutation,
    AddNotificationMutationVariables
  >(AddNotificationDocument);

  const [{ fetching: deleting }, deleteNotification] = useMutation<
    DeleteNotificationMutation,
    DeleteNotificationMutationVariables
  >(DeleteNotificationDocument);

  const [{ fetching: completing }, completeReservation] = useMutation<
    CompleteReservationMutation,
    CompleteReservationMutationVariables
  >(CompleteReservationDocument);

  const [{ fetching: toggling }, toggleRoomOccupied] = useMutation<
    ToggleTableReservationMutation,
    ToggleTableReservationMutationVariables
  >(ToggleTableReservationDocument);

  const [{ fetching: updatingTables }, updateManyTables] = useMutation<
    UpdateManyTablesMutation,
    UpdateManyTablesMutationVariables
  >(UpdateManyTablesDocument);

  // --- Modal UI state ---
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<FolioKind>("CHARGE");

  const openModal = (k: FolioKind) => {
    setModalKind(k);
    setModalOpen(true);
  };

  const addManualEntry = async (data: {
    amount: number;
    description: string;
    method?: any;
    reference?: string | null;
  }) => {
    if (!staffEmail) {
      toast.error("Login required.");
      return;
    }

    const payload: FolioPayloadV1 = {
      v: 1,
      kind: modalKind,
      amount: data.amount,
      description: data.description,
      reservationId: reservation.id,
      tableId: reservation.tableId,
      dateKey,
      createdAt: new Date().toISOString(),
      createdByEmail: staffEmail,
      method: modalKind === "PAYMENT" ? data.method : undefined,
      reference: modalKind === "PAYMENT" ? (data.reference ?? null) : undefined,
    };

    const res = await addNotification({
      userEmail: reservation.userEmail,
      type: FOLIO_TYPE,
      message: encodeFolioMessage(payload),
      // IMPORTANT: keep status=READ so we don't pollute the user “unread notifications” flow.
      status: NotificationStatus.Read,
      priority: NotificationPriority.Normal,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to save folio entry.");
      return;
    }

    toast.success(modalKind === "CHARGE" ? "Charge added." : "Payment recorded.");
    setModalOpen(false);
    refetchNotifs({ requestPolicy: "network-only" });
  };

  const removeManualEntry = async (id: string) => {
    const res = await deleteNotification({ deleteNotificationId: id });
    if (res.error) {
      console.error(res.error);
      toast.error("Failed to remove entry.");
      return;
    }
    toast.success("Entry removed.");
    refetchNotifs({ requestPolicy: "network-only" });
  };

  const printInvoice = () => {
    const html = buildInvoiceHtml({
      hotelName,
      reservationId: reservation.id,
      roomNumber: reservation.table.tableNumber,
      guestName,
      guestEmail: reservation.userEmail,
      lines: allLines,
      totals,
    });

    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) {
      toast.error("Pop-up blocked. Allow pop-ups to print.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  /**
   * SAFE CHECK-OUT:
   * - If balance isn't closed, block for reception.
   * - Allow override for MANAGER/ADMIN (policy requirement). :contentReference[oaicite:6]{index=6}
   * - Perform: completeReservation -> room reserved=false -> room marked DIRTY + inCleaningList.
   */
  const doSafeCheckout = async () => {
    const abs = Math.abs(totals.balance);
    const hasOpenBalance = abs > 0.01;

    if (hasOpenBalance && !canOverrideCheckout) {
      toast.error("Open balance: manager/admin override required to check-out.");
      return;
    }

    const ok = window.confirm(
      `Confirm check-out?\n\nBalance: ${money(totals.balance)}\nRoom will be released and marked DIRTY for housekeeping.`
    );
    if (!ok) return;

    // 1) Complete reservation
    const c = await completeReservation({ completeReservationId: reservation.id });
    if (c.error) {
      console.error(c.error);
      toast.error("Failed to complete reservation.");
      return;
    }

    // 2) Release room
    const t = await toggleRoomOccupied({
      toggleTableReservationId: reservation.tableId,
      reserved: false,
    });
    if (t.error) {
      console.error(t.error);
      toast.error("Reservation completed but failed to release room.");
      return;
    }

    // 3) Mark room dirty + add to cleaning list (hotel logic over Table.specialRequests)
    const nextSpecialRequests = applyHousekeepingPatch(reservation.table.specialRequests, {
      status: "DIRTY",
      inCleaningList: true,
    });

    const u = await updateManyTables({
      updates: [{ id: reservation.tableId, specialRequests: nextSpecialRequests }],
    });

    if (u.error) {
      console.error(u.error);
      toast.error("Room released but failed to mark DIRTY.");
      return;
    }

    toast.success("Checked-out. Room marked DIRTY and added to cleaning list.");
    refetchOrders({ requestPolicy: "network-only" });
    refetchNotifs({ requestPolicy: "network-only" });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Folio</h2>
          <p className="text-xs text-gray-500">
            Charges/payments for Reservation {reservation.id} • Room {reservation.table.tableNumber}
          </p>
          <p className="text-xs text-gray-500">
            Day: {dateKey} • Guest: {guestName}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openModal("CHARGE")}
            className="text-xs px-3 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-950"
          >
            Add Charge
          </button>

          <button
            onClick={() => openModal("PAYMENT")}
            className="text-xs px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Record Payment
          </button>

          <button
            onClick={printInvoice}
            className="text-xs px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Print Invoice
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded bg-gray-50 border p-2">
          <div className="text-gray-500">Charges</div>
          <div className="font-semibold text-gray-900">{money(totals.charges)}</div>
        </div>
        <div className="rounded bg-gray-50 border p-2">
          <div className="text-gray-500">Payments</div>
          <div className="font-semibold text-gray-900">{money(totals.payments)}</div>
        </div>
        <div className="rounded bg-gray-50 border p-2">
          <div className="text-gray-500">Balance</div>
          <div className={`font-bold ${totals.balance > 0.01 ? "text-red-700" : "text-emerald-700"}`}>
            {money(totals.balance)}
          </div>
        </div>
      </div>

      {/* Data loading/errors */}
      {(ordersFetching || notifsFetching) ? (
        <p className="mt-3 text-xs text-gray-500">Loading folio data…</p>
      ) : null}
      {ordersError || notifsError ? (
        <p className="mt-2 text-xs text-red-600">
          Failed to load: {(ordersError || notifsError)?.message}
        </p>
      ) : null}

      {/* Lines table */}
      <div className="mt-4 overflow-auto border rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-2 border-b">Date</th>
              <th className="text-left p-2 border-b">Description</th>
              <th className="text-right p-2 border-b">Charge</th>
              <th className="text-right p-2 border-b">Payment</th>
              <th className="text-right p-2 border-b">Action</th>
            </tr>
          </thead>
          <tbody>
            {allLines.length === 0 ? (
              <tr>
                <td className="p-3 text-gray-500" colSpan={5}>
                  No folio lines yet.
                </td>
              </tr>
            ) : (
              allLines.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="p-2 border-b text-gray-600 whitespace-nowrap">
                    {new Date(l.date).toLocaleString()}
                  </td>
                  <td className="p-2 border-b text-gray-800">
                    {l.description}
                    <span className="ml-2 text-[10px] text-gray-400">({l.source})</span>
                  </td>
                  <td className="p-2 border-b text-right">
                    {l.kind === "CHARGE" ? money(l.amount) : ""}
                  </td>
                  <td className="p-2 border-b text-right">
                    {l.kind === "PAYMENT" ? money(l.amount) : ""}
                  </td>
                  <td className="p-2 border-b text-right">
                    {l.deletable ? (
                      <button
                        onClick={() => removeManualEntry(l.id)}
                        disabled={deleting}
                        className="text-[11px] px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-[10px] text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Checkout */}
      <div className="mt-4 flex items-center justify-between">
   <div className="text-[11px] text-gray-500">
  Policy: do not allow check-out with open balance (manager/admin override allowed).
  {/* contentReference: oaicite:7 index=7 */}
</div>


        <button
          onClick={doSafeCheckout}
          disabled={completing || toggling || updatingTables}
          className="text-xs px-3 py-2 rounded-lg bg-blue-900 text-white hover:bg-blue-950 disabled:bg-gray-300"
        >
          {completing || toggling || updatingTables ? "Checking-out…" : "Finalize Check-out"}
        </button>
      </div>

      {/* Modal */}
      <AddFolioEntryModal
        open={modalOpen}
        kind={modalKind}
        onClose={() => setModalOpen(false)}
        onSave={addManualEntry}
      />

      {/* tiny hint */}
      {(creating || deleting) ? (
        <p className="mt-2 text-[11px] text-gray-500">Saving…</p>
      ) : null}
    </div>
  );
}
