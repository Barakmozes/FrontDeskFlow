'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

type CategoryId = 'all' | string;

/**
 * טיפוס כללי שתומך בשלושת הווריאנטים של שיוך קטגוריה במנה:
 *  - categoryId?: string | null
 *  - category?: { id?: string | null } | string | null
 */
export type MenuWithCategory = {
  categoryId?: string | null;
  category?: { id?: string | null } | string | null;
} & Record<string, unknown>;

/** 
 * פונקציית עזר: מחזירה מזהה קטגוריה מתוך Menu לפי סדר עדיפויות:
 * 1) menu.categoryId
 * 2) menu.category?.id
 * 3) menu.category (אם הוא string)
 *
 * אם תשנו את הסכמה בעתיד — זה המקום היחיד שצריך לעדכן.
 */
export function getMenuCategoryId<T extends MenuWithCategory>(
  menu: T
): string | undefined {
  // 1) categoryId
  if (menu.categoryId) return menu.categoryId || undefined;

  // 2) category?.id
  const cat = menu.category;
  if (cat && typeof cat === 'object' && 'id' in cat) {
    const id = (cat as { id?: string | null }).id;
    if (id) return id;
  }

  // 3) category (string)
  if (typeof cat === 'string' && cat) return cat;

  return undefined;
}

type MenuFilterState = {
  selectedCategoryId: CategoryId;

  // Actions
  setCategory: (id: CategoryId) => void;
  clearCategory: () => void;

  /** 
   * getFiltered: מסנן בצורה טהורה (ללא שינוי קלט) לפי selectedCategoryId.
   * נשאר גנרי כדי לעבוד עם כל טיפוס Menu שמכיל את שדות הקטגוריה.
   */
  getFiltered: <T extends MenuWithCategory>(menus: readonly T[]) => T[];

  /** עוזר לרהידרציה ידנית בגלל skipHydration */
  rehydrate: () => void;
};

export const useMenuFilterStore = create<MenuFilterState>()(
  devtools(
    persist(
      (set, get) => ({
        selectedCategoryId: 'all',

        setCategory: (id) => set({ selectedCategoryId: id }),
        clearCategory: () => set({ selectedCategoryId: 'all' }),

        getFiltered: (menus) => {
          const selected = get().selectedCategoryId;
          if (selected === 'all') {
            // שומר על אי־שינוי הקלט: מחזיר עותק רדוד
            return menus.slice();
          }
          return menus.filter((m) => getMenuCategoryId(m) === selected);
        },

        // רהידרציה ידנית – הכרחי כשמגדירים skipHydration: true
        rehydrate: () => {
      
          (useMenuFilterStore as any).persist?.rehydrate?.();
        },
      }),
      {
        name: 'menu_filter', // מפתח האחסון
        skipHydration: true, // מונע אי־התאמות SSR
        // נשמר רק ה-id שנבחר
        partialize: (state) => ({ selectedCategoryId: state.selectedCategoryId }),
      }
    ),
    { name: 'menu-filter-store' }
  )
);
