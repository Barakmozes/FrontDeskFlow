"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@urql/next";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";

import {
  AddOrderToTableDocument,
  AddOrderToTableMutation,
  AddOrderToTableMutationVariables,
  EditOrderDocument,
  EditOrderMutation,
  EditOrderMutationVariables,
  GetAreasNameDescriptionDocument,
  GetAreasNameDescriptionQuery,
  GetAreasNameDescriptionQueryVariables,
  GetMenusDocument,
  GetMenusQuery,
  GetMenusQueryVariables,
  GetTableOrderDocument,
  GetTableOrderQuery,
  GetTableOrderQueryVariables,
  GetTablesDocument,
  GetTablesQuery,
  GetTablesQueryVariables,
  OrderStatus,
} from "@/graphql/generated";

import { useCartStore } from "@/lib/store";
import { useHotelStore, type RoomInStore } from "@/lib/AreaStore";
import { createOrderNumber } from "@/lib/createOrderNumber";
import { getCurrentUser } from "@/lib/session";

/**
 * NOTE ABOUT DOMAIN MAPPING (project convention):
 * - Room = Table (backend)
 * - Hotel = Area (backend)
 *
 * This component does NOT change the backend schema.
 * It "dresses" existing backend logic with hotel vocabulary.
 */

type RoomOption = {
  tableId: string;
  label: string;
  roomNumber: number;
};

function money(value: number): string {
  // Simple formatting (you can replace with Intl.NumberFormat later)
  return value.toFixed(2);
}

function getUnitPrice(item: any): number {
  const selling = typeof item?.sellingPrice === "number" ? item.sellingPrice : null;
  const price = typeof item?.price === "number" ? item.price : 0;
  return selling && selling > 0 ? selling : price;
}

function getQuantity(item: any): number {
  const q = typeof item?.quantity === "number" ? item.quantity : 1;
  return Math.max(1, q);
}

export default function RoomServiceClient() {
  // ---------- Session (staff user) ----------
  const { data: session, status } = useSession();
  const staffEmail = session?.user?.email ?? "";
  const staffName = session?.user?.name ?? session?.user?.email ?? "Front Desk";

  const sessionReady = status === "authenticated";
  
  // ---------- Global stores ----------
  const { hotels, setHotels, rooms, setRooms } = useHotelStore();
  const cartItems = useCartStore((s) => s.menus as any[]);
  const tableId = useCartStore((s) => s.tableId) as string | undefined;
  const tableNumber = useCartStore((s) => s.tableNumber) as number | undefined;

  const startOrderForTable = useCartStore((s) => s.startOrderForTable);
  const deleteFromcart = useCartStore((s) => s.deleteFromcart);
  const increaseCartItem = useCartStore((s) => s.increaseCartItem);
  const decreaseCartItem = useCartStore((s) => s.decreaseCartItem);

  // ---------- Local UI state ----------
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("ALL");

  const [serviceFee, setServiceFee] = useState<number>(3);
  const [discount, setDiscount] = useState<number>(0);
  const [note, setNote] = useState<string>("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [guestEmailOverride, setGuestEmailOverride] = useState("");
  const [guestNameOverride, setGuestNameOverride] = useState("");

  // ---------- Fetch hotels ----------
  const [{ data: hotelsData }] = useQuery<
    GetAreasNameDescriptionQuery,
    GetAreasNameDescriptionQueryVariables
  >({
    query: GetAreasNameDescriptionDocument,
    variables: { orderBy: { createdAt: "asc" as any } },
  });

  useEffect(() => {
    const fetched = hotelsData?.getAreasNameDescription;
    if (!fetched) return;

    setHotels(
      fetched.map((h) => ({
        id: h.id,
        name: h.name,
        floorPlanImage: h.floorPlanImage ?? null,
        createdAt: h.createdAt,
      }))
    );
  }, [hotelsData, setHotels]);

  // ---------- Fetch rooms ----------
  const [{ data: roomsData }, reexecuteRooms] = useQuery<
    GetTablesQuery,
    GetTablesQueryVariables
  >({
    query: GetTablesDocument,
    variables: {},
  });

  useEffect(() => {
    const fetched = roomsData?.getTables;
    if (!fetched) return;

    const mapped: RoomInStore[] = fetched.map((t) => ({
      id: t.id,
      roomNumber: t.tableNumber,
      hotelId: t.areaId,
      position: (t.position as any) ?? { x: 0, y: 0 },
      capacity: t.diners,
      isOccupied: t.reserved,
      notes: t.specialRequests ?? [],
      createdAt: String(t.createdAt),
      updatedAt: String(t.updatedAt),
      dirty: false,
    }));

    setRooms(mapped);
  }, [roomsData, setRooms]);

  // ---------- Fetch menu ----------
  const [{ data: menuData, fetching: menuFetching, error: menuError }] = useQuery<
    GetMenusQuery,
    GetMenusQueryVariables
  >({
    query: GetMenusDocument,
    variables: { first: 200 }, // increase later if needed (pagination)
  });

  const menuItems = useMemo(() => {
    const edges = menuData?.getMenus?.edges ?? [];
    return edges.map((e) => e?.node).filter(Boolean) as any[];
  }, [menuData]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const m of menuItems) set.add(m.category);
    return ["ALL", ...Array.from(set).sort()];
  }, [menuItems]);

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menuItems.filter((m) => {
      const matchCategory = category === "ALL" ? true : m.category === category;
      const matchSearch =
        q.length === 0
          ? true
          : String(m.title).toLowerCase().includes(q) ||
            String(m.shortDescr ?? "").toLowerCase().includes(q);

      return matchCategory && matchSearch;
    });
  }, [menuItems, category, search]);

  // ---------- Room dropdown ----------
  const roomOptions: RoomOption[] = useMemo(() => {
    return rooms
      .slice()
      .sort((a, b) => a.roomNumber - b.roomNumber)
      .map((r) => {
        const hotelName =
          hotels.find((h) => h.id === r.hotelId)?.name ?? "Hotel";
        return {
          tableId: r.id,
          roomNumber: r.roomNumber,
          label: `${hotelName} • Room ${r.roomNumber}`,
        };
      });
  }, [rooms, hotels]);

  const selectedRoomLabel = useMemo(() => {
    if (!tableId) return "No room selected";
    const opt = roomOptions.find((o) => o.tableId === tableId);
    return opt ? opt.label : `Room (tableId=${tableId})`;
  }, [tableId, roomOptions]);

  // ---------- Cart totals ----------
  const subtotal = useMemo(() => {
    if (!Array.isArray(cartItems)) return 0;
    return cartItems.reduce((sum, item) => {
      return sum + getUnitPrice(item) * getQuantity(item);
    }, 0);
  }, [cartItems]);

  const total = useMemo(() => {
    const d = Number.isFinite(discount) ? discount : 0;
    const sf = Number.isFinite(serviceFee) ? serviceFee : 0;
    // total cannot go below 0
    return Math.max(0, subtotal + sf - d);
  }, [subtotal, serviceFee, discount]);

  // ---------- Order history for this room ----------
  const [
    { data: tableOrdersData, fetching: ordersFetching, error: ordersError },
    reexecuteOrders,
  ] = useQuery<GetTableOrderQuery, GetTableOrderQueryVariables>({
    query: GetTableOrderDocument,
    variables: { tableId: tableId ?? "" },
    pause: !tableId,
  });

  const tableOrders = tableOrdersData?.getTableOrder ?? [];

  // ---------- Mutations ----------
  const [{ fetching: placingOrder }, addOrderToTable] = useMutation<
    AddOrderToTableMutation,
    AddOrderToTableMutationVariables
  >(AddOrderToTableDocument);

  const [{ fetching: updatingOrder }, editOrder] = useMutation<
    EditOrderMutation,
    EditOrderMutationVariables
  >(EditOrderDocument);

  // ---------- Actions ----------
  const handleSelectRoom = (nextTableId: string) => {
    const opt = roomOptions.find((o) => o.tableId === nextTableId);
    if (!opt) return;

    // Uses existing global store mechanics (cart + selected table) to keep behavior consistent.
    startOrderForTable(opt.tableId, opt.roomNumber);
    toast.success(`Room selected: ${opt.label}`, { duration: 900 });
    reexecuteOrders({ requestPolicy: "network-only" });
  };

  const addToCartSmart = (menu: any) => {
  // If already in cart -> +1
  const existing = cartItems?.find((it) => it?.id === menu?.id);
  if (existing) {
    increaseCartItem(cartItems, menu.id);
    return;
  }

 useCartStore.getState().addToCart({
    id: String(menu.id),
    title: String(menu.title ?? ""),
    shortDescr: String(menu.shortDescr ?? ""),
    category: String(menu.category ?? ""),
    image: String(menu.image ?? ""),

    price: typeof menu.price === "number" ? menu.price : Number(menu.price ?? 0),
    sellingPrice:
      typeof menu.sellingPrice === "number"
        ? menu.sellingPrice
        : menu.sellingPrice == null
          ? null
          : Number(menu.sellingPrice),

    // Cart fields
    quantity: 1,
    instructions: "",
    prepare: "",

    // Optional extras (אם קיימים אצלך ב-API – ייכנסו; אם לא, זה עדיין תקין)
    longDescr: menu.longDescr ?? null,
    prepType: Array.isArray(menu.prepType) ? menu.prepType : undefined,
    onPromo: typeof menu.onPromo === "boolean" ? menu.onPromo : undefined,
    categoryId: menu.categoryId ?? null,
  });

  toast(`Added: ${menu.title}`, { duration: 700 });
};

  const handleDecrease = (id: string) => {
    const item = cartItems.find((i) => i?.id === id);
    if (!item) return;

    const q = getQuantity(item);
    if (q <= 1) deleteFromcart(id);
    else decreaseCartItem(cartItems, id);
  };

  const handleIncrease = (id: string) => {
    increaseCartItem(cartItems, id);
  };

  const openConfirm = () => {
    if (!tableId) {
      toast.error("Select a room first.");
      return;
    }
    if (!cartItems?.length) {
      toast.error("Cart is empty.");
      return;
    }
    if (!staffEmail) {
      toast.error("You must be logged in to place an order.");
      return;
    }
    setConfirmOpen(true);
  };

  const placeRoomServiceOrder = async () => {
    if (!tableId) return;

    const emailToUse = guestEmailOverride.trim() || staffEmail;
    const nameToUse = guestNameOverride.trim() || staffName;

    const vars: AddOrderToTableMutationVariables = {
      tableId,
      cart: cartItems ?? [],
      orderNumber: createOrderNumber("ROOM-service"),
      serviceFee: Number.isFinite(serviceFee) ? serviceFee : 0,
      total,
      userEmail: emailToUse,
      userName: nameToUse,
      discount: Number.isFinite(discount) && discount > 0 ? discount : null,
      note: note.trim() || null,
      paymentToken: null, // Room service: no online payment in this step
    };

    const res = await addOrderToTable(vars);

    if (res.error) {
      console.error("addOrderToTable error:", res.error);
      toast.error("Failed to place room service order.");
      return;
    }

    toast.success("Room service order created.", { duration: 1200 });
    setConfirmOpen(false);

    // Clear cart items, keep selected room
    const prevTableId = useCartStore.getState().tableId;
    const prevTableNumber = useCartStore.getState().tableNumber;

    useCartStore.getState().resetCart();

    // Restore selection (resetCart clears tableId/tableNumber)
    if (prevTableId && prevTableNumber) {
      useCartStore.getState().startOrderForTable(prevTableId, prevTableNumber);
    }

    // Refresh room + order list
    reexecuteOrders({ requestPolicy: "network-only" });
    reexecuteRooms({ requestPolicy: "network-only" });
  };

  const updateOrderStatus = async (orderId: string, next: OrderStatus) => {
    const res = await editOrder({
      editOrderId: orderId,
      status: next,
      deliveryTime: null,
    });

    if (res.error) {
      console.error("editOrder error:", res.error);
      toast.error("Failed to update order status.");
      return;
    }

    toast.success(`Order updated → ${next}`, { duration: 900 });
    reexecuteOrders({ requestPolicy: "network-only" });
  };

  // ---------- Render ----------
  return (
    <div className="px-6 py-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h1 className="text-xl font-bold text-gray-800">Room Service</h1>
        <p className="text-xs text-gray-500 mt-1">
          Select a room, add items from the menu, and place a room service order.
        </p>

        <div className="mt-4 flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-600">Selected room</label>
            <div className="text-sm font-medium text-gray-800">{selectedRoomLabel}</div>
          </div>

          <div className="w-full md:w-[360px]">
            <label className="text-xs text-gray-600">Choose Room</label>
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={tableId ?? ""}
              onChange={(e) => handleSelectRoom(e.target.value)}
            >
              <option value="">— Select a room —</option>
              {roomOptions.map((o) => (
                <option key={o.tableId} value={o.tableId}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Tip: You can also add a “Room Service” button on each Room card to navigate here pre-selected.
            </p>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* MENU */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
            <div className="flex-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu…"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>

            <div className="w-full md:w-[220px]">
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {menuFetching ? (
            <p className="text-sm text-gray-500">Loading menu…</p>
          ) : menuError ? (
            <p className="text-sm text-red-600">Failed to load menu: {menuError.message}</p>
          ) : filteredMenu.length === 0 ? (
            <p className="text-sm text-gray-500">No menu items match your filters.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredMenu.map((m) => (
                <div key={m.id} className="border rounded-lg p-3 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 truncate">{m.title}</div>
                      <div className="text-xs text-gray-500 line-clamp-2">
                        {m.shortDescr}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-800">
                      {money(getUnitPrice(m))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => addToCartSmart(m)}
                    className="mt-3 text-sm bg-blue-600 text-white rounded-md px-3 py-2 hover:bg-blue-700 transition"
                  >
                    Add to Room Service
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CART */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Cart</h2>
            <span className="text-xs text-gray-500">
              Room {tableNumber ?? "—"}
            </span>
          </div>

          {(!cartItems || cartItems.length === 0) ? (
            <p className="text-sm text-gray-500 mt-3">Cart is empty.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {cartItems.map((it) => (
                <div key={it.id} className="border rounded-md p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        {it.title ?? "Item"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {money(getUnitPrice(it))} × {getQuantity(it)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDecrease(it.id)}
                        className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIncrease(it.id)}
                        className="px-2 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteFromcart(it.id)}
                        className="px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t pt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold">{money(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between text-sm gap-2">
              <span className="text-gray-600">Service fee</span>
              <input
                type="number"
                className="w-28 border rounded px-2 py-1 text-sm"
                value={serviceFee}
                onChange={(e) => setServiceFee(Number(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between text-sm gap-2">
              <span className="text-gray-600">Discount</span>
              <input
                type="number"
                className="w-28 border rounded px-2 py-1 text-sm"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-800 font-semibold">Total</span>
              <span className="text-gray-800 font-bold">{money(total)}</span>
            </div>

            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Order note (optional)…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <button
              type="button"
              onClick={openConfirm}
              disabled={placingOrder || !cartItems?.length}
              className={`w-full mt-2 px-3 py-2 rounded-md text-sm text-white transition ${
                placingOrder
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {placingOrder ? "Placing…" : "Finalize & Place Order"}
            </button>
          </div>
        </div>
      </div>

      {/* Order history */}
      <div className="bg-white rounded-lg shadow p-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-800">Room Orders</h2>

        {!tableId ? (
          <p className="text-sm text-gray-500 mt-2">Select a room to view orders.</p>
        ) : ordersFetching ? (
          <p className="text-sm text-gray-500 mt-2">Loading room orders…</p>
        ) : ordersError ? (
          <p className="text-sm text-red-600 mt-2">
            Failed to load orders: {ordersError.message}
          </p>
        ) : tableOrders.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">No orders for this room yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {tableOrders.map((o) => (
              <div key={o.id} className="border rounded-md p-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-semibold text-gray-800">
                      #{o.orderNumber}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(o.orderDate as any).toLocaleString()} • Total {money(o.total)}
                    </div>
                    {o.note ? (
                      <div className="text-xs text-gray-600 mt-1">Note: {o.note}</div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="border rounded-md px-2 py-1 text-sm bg-white"
                      value={o.status}
                      onChange={(e) => updateOrderStatus(o.id, e.target.value as OrderStatus)}
                      disabled={updatingOrder}
                    >
                      {Object.values(OrderStatus).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>

                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                      {o.paid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      {confirmOpen ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Confirm Room Service Order</h3>
                <p className="text-xs text-gray-500 mt-1">{selectedRoomLabel}</p>
              </div>

              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{money(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Service fee</span>
                <span className="font-semibold">{money(serviceFee)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Discount</span>
                <span className="font-semibold">{money(discount)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-gray-800 font-semibold">Total</span>
                <span className="text-gray-800 font-bold">{money(total)}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <label className="text-xs text-gray-600">
                Optional: charge to guest (override order user fields)
              </label>
              <input
                value={guestNameOverride}
                onChange={(e) => setGuestNameOverride(e.target.value)}
                placeholder="Guest name (optional)"
                className="border rounded-md px-3 py-2 text-sm"
              />
              <input
                value={guestEmailOverride}
                onChange={(e) => setGuestEmailOverride(e.target.value)}
                placeholder="Guest email (optional)"
                className="border rounded-md px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-gray-500">
                If empty, order will be created under the logged-in staff user ({staffEmail || "not logged in"}).
              </p>
            </div>

            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={placeRoomServiceOrder}
                disabled={placingOrder}
                className={`px-4 py-2 text-sm text-white rounded transition ${
                  placingOrder ? "bg-gray-300 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {placingOrder ? "Placing…" : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
