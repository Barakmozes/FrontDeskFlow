/**
 * types.ts
 * 
 * קובץ מרכזי המגדיר טיפוסים (Types) נפוצים בפרויקט לצורך אחידות, תחזוקה נוחה והשלמה אוטומטית (IntelliSense).
 * כולל טיפוסים ל:
 * - פריטי שיווק וקטגוריות תצוגה
 * - ניהול מצבים של מודלים ותפריטים צדדיים (UI State)
 * - עגלת קניות ופעולות עליה
 * - תמיכה בריבוי שפות
 * 
 * טיפוסים אלו משמשים את ממשק המשתמש, ניהול מצב (Store), ואינטראקציה עם מודלים מ-Prisma.
 * graphql\generated.ts שהוגדרו כאן בקובץ או בפריזמה לקוח או ב (Types)כמו כן אפשר לבחור להשתמש 
 */

import { Menu } from "@prisma/client";

// Promo and Category Types
export type PromoTypes = {
  title: string;
  img: string;
  salesQ: number;
  likesN: number;
  PercentOff: number;
  price: number;
};

export type CustomCategory = {
  desc: string;
  id: string;
  category: string;
  imageSrc: string;
};

// Modal and Sidebar State Types
export type LoginModalStore = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export type SideBarDrawerStore = {
  isSideBarOpen: boolean;
  onSideBarOpen: () => void;
  onSideBarClose: () => void;
};

// Cart Types
type CartOptions = {
  quantity: number;
  instructions: string;
  prepare: string;
};
export type CartItemType = Menu & CartOptions;

/**
 * CartType
 * - `menus`: the array of items in the cart
 * - `tableId` (optional): tracks which table is being served if it's a dine-in order
 */
export type CartType = {
  menus: CartItemType[];
  tableId?: string;
  tableNumber?: number; 
};
/**
 * CartActionTypes
 * - Existing actions remain unchanged
 * - New actions for table logic (setTableId, clearTableId, startOrderForTable)
 */
export type CartActionTypes = {
  addToCart: (item: CartItemType) => void;
  deleteFromcart: (id: string) => void;
  increaseCartItem: (data: CartItemType[], id: string) => void;
  decreaseCartItem: (data: CartItemType[], id: string) => void;
  resetCart: () => void;
  setTableId: (tableId: string) => void;
  clearTableId: () => void;
  setTableNumber: (tableNumber: number) => void;
  clearTableNumber: () => void;
  startOrderForTable: (tableId: string, tableNumber: number) => void;
};

/**
 * LangCode
 *יוניון
 * • Two-letter codes for supported locales.
 * • Extend as needed (e.g. 'es', 'fr').
 */
export type LangCode = 'en' | 'he'