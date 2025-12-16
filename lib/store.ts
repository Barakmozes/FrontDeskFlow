import {
  CartActionTypes,
  CartType,
  LoginModalStore,
  SideBarDrawerStore,
} from "@/types";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// Sidebar & Login Modal logic (unchanged)
export const useSideBarDrawer = create<SideBarDrawerStore>()((set) => ({
  isSideBarOpen: false,
  onSideBarOpen: () => set({ isSideBarOpen: true }),
  onSideBarClose: () => set({ isSideBarOpen: false }),
}));

export const useLoginModal = create<LoginModalStore>()((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));

// Extend INITIAL_STATE with 'tableId' and 'tableNumber'
const INITIAL_STATE = {
  menus: [],            // Existing cart items
  tableId: undefined,   // ID in your database for the table
  tableNumber: undefined, // e.g., Table #5 in the restaurant
};

export const useCartStore = create<CartType & CartActionTypes>()(
  devtools(
    persist(
      (set, get) => ({
        // ----- State -----
        menus: INITIAL_STATE.menus,
        tableId: INITIAL_STATE.tableId,
        tableNumber: INITIAL_STATE.tableNumber,

        // ----- Actions -----
        /**
         * addToCart
         * Always add new item to cart (allow duplicates).
         */
        addToCart(item) {
          const { menus } = get();
          set({ menus: [...menus, item] });
        },

        /**
         * deleteFromcart
         * Removes an item by its ID.
         */
        deleteFromcart(itemId) {
          const { menus } = get();
          const updatedMenus = menus.filter((menu) => menu.id !== itemId);
          set({ menus: updatedMenus });
        },

        /**
         * increaseCartItem
         * Increments quantity of a specific cart item.
         */
        increaseCartItem(data, id) {
          const newData = [...data];
          newData.forEach((item) => {
            if (item.id === id) item.quantity += 1;
          });
          set({ menus: newData });
        },

        /**
         * decreaseCartItem
         * Decrements quantity of a specific cart item.
         */
        decreaseCartItem(data, id) {
          const newData = [...data];
          newData.forEach((item) => {
            if (item.id === id) item.quantity -= 1;
          });
          set({ menus: newData });
        },

        /**
         * resetCart
         * Clears the entire cart (menus)
         * and resets table-related fields to initial state.
         */
        resetCart() {
          set(INITIAL_STATE);
        },

        /**
         * setTableId
         * Updates tableId to identify which table is ordering.
         */
        setTableId(tableId) {
          set({ tableId });
        },

        /**
         * setTableNumber
         * Updates the restaurant's visible table number.
         */
        setTableNumber(tableNumber) {
          set({ tableNumber });
        },

        /**
         * clearTableId
         * Clears tableId but keeps cart items if you want.
         */
        clearTableId() {
          set({ tableId: undefined });
        },

        /**
         * clearTableNumber
         * Clears tableNumber but keeps the cart items.
         */
        clearTableNumber() {
          set({ tableNumber: undefined });
        },

        /**
         * startOrderForTable
         * Clears existing cart items, sets tableId and tableNumber.
         */
        startOrderForTable(tableId, tableNumber) {
          set({
            menus: [],
            tableId,
            tableNumber,
          });
        },
      }),
      {
        name: "You&i_cart", // Key in storage
        skipHydration: true,
      }
    )
  )
);
