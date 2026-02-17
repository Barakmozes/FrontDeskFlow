// app/(dashboard)/dashboard/Components/routes.tsx

import type { ElementType } from "react";

import {
  HiOutlineHome,
  HiOutlineUserGroup,
  HiOutlineCog6Tooth,
  HiOutlineTruck,
  HiOutlineClipboardDocumentList,
} from "react-icons/hi2";

import { AiOutlineDashboard, AiOutlineMessage } from "react-icons/ai";
import { CiReceipt } from "react-icons/ci";
import { VscLayoutMenubar } from "react-icons/vsc";

import {
  MdOutlineCleaningServices,
  MdOutlineRoomService,
  MdOutlineMeetingRoom,
  MdOutlineFrontHand,
  MdOutlineWorkOutline,
  MdOutlinePersonAddAlt,
  MdOutlineReceiptLong,
} from "react-icons/md";

/**
 * AppRole
 *
 * IMPORTANT:
 * We include both:
 * - Hotel roles: RECEPTION / HOUSEKEEPING / ACCOUNTING
 * - Legacy restaurant roles: WAITER / CHEF / DELIVERY
 *
 * This keeps sidebar routing stable during the migration phase.
 */
export type AppRole =
  | "USER"
  | "RECEPTION"
  | "HOUSEKEEPING"
  | "ACCOUNTING"
  | "MANAGER"
  | "ADMIN"
  | "WAITER"
  | "CHEF"
  | "DELIVERY";

export type DashboardRoute = {
  title: string;
  icon: ElementType;
  url: string;

  /**
   * roles:
   * If current user's role is included => show in sidebar.
   * Keep this field on EVERY route so RenderRoutes can filter easily.
   */
  roles: AppRole[];
};

/** Role groups (kept small + readable) */
const ALL_ROLES: AppRole[] = [
  "USER",
  "RECEPTION",
  "HOUSEKEEPING",
  "ACCOUNTING",
  "MANAGER",
  "ADMIN",
  "WAITER",
  "CHEF",
  "DELIVERY",
];

const HOTEL_STAFF_ROLES: AppRole[] = [
  "RECEPTION",
  "HOUSEKEEPING",
  "ACCOUNTING",
  "MANAGER",
  "ADMIN",
  // legacy staff (during migration)
  "WAITER",
  "CHEF",
  "DELIVERY",
];

const FRONT_DESK_ROLES: AppRole[] = [
  "RECEPTION",
  "MANAGER",
  "ADMIN",
  // legacy mapping
  "WAITER",
  "DELIVERY",
];

const RESERVATIONS_VIEW_ROLES: AppRole[] = [
  "RECEPTION",
  "ACCOUNTING",
  "MANAGER",
  "ADMIN",
  // legacy mapping
  "WAITER",
];

const HOUSEKEEPING_ROLES: AppRole[] = [
  "HOUSEKEEPING",
  "RECEPTION",
  "MANAGER",
  "ADMIN",
  // legacy mapping
  "CHEF",
];

const MANAGERISH_ROLES: AppRole[] = ["MANAGER", "ADMIN"];
const ACCOUNTING_ROLES: AppRole[] = ["ACCOUNTING", "MANAGER", "ADMIN"];

const RESTAURANT_LEGACY_ROLES: AppRole[] = [
  "WAITER",
  "CHEF",
  "DELIVERY",
  "MANAGER",
  "ADMIN",
];

/**
 * Small helper for RenderRoutes (optional, but makes filtering trivial).
 * Usage in RenderRoutes:
 *   const visible = AdminRoutes.filter(r => isRouteAllowed(r, user?.role));
 */
export function isRouteAllowed(route: DashboardRoute, role?: string | null): boolean {
  if (!role) return false;
  return route.roles.includes(role as AppRole);
}

/**
 * Sidebar routes ordered by natural hotel/front-desk workflow:
 * Dashboard → Room Board → Reception → Reservations → Register → Housekeeping → Tasks → Room Service
 * → Notifications → Operations → Admin → (Legacy restaurant modules)
 */
export const AdminRoutes: DashboardRoute[] = [
  // ---- General ----
  { title: "Home", icon: HiOutlineHome, url: "/", roles: ALL_ROLES },

  // ---- Front Desk (natural flow) ----
  { title: "Dashboard", icon: AiOutlineDashboard, url: "/dashboard", roles: HOTEL_STAFF_ROLES },

  { title: "Room Board", icon: MdOutlineMeetingRoom, url: "/dashboard/room-board", roles: FRONT_DESK_ROLES },

  { title: "Reception", icon: MdOutlineFrontHand, url: "/dashboard/reception", roles: FRONT_DESK_ROLES },

  { title: "Reservations", icon: MdOutlineReceiptLong, url: "/dashboard/reservations", roles: RESERVATIONS_VIEW_ROLES },

  { title: "Register Customer", icon: MdOutlinePersonAddAlt, url: "/dashboard/customers/register", roles: FRONT_DESK_ROLES },

  { title: "Housekeeping", icon: MdOutlineCleaningServices, url: "/dashboard/housekeeping", roles: HOUSEKEEPING_ROLES },

  { title: "Tasks", icon: HiOutlineClipboardDocumentList, url: "/dashboard/tasks", roles: HOTEL_STAFF_ROLES },

  { title: "Room Service", icon: MdOutlineRoomService, url: "/dashboard/room-service", roles: FRONT_DESK_ROLES },

  { title: "Notifications", icon: AiOutlineMessage, url: "/dashboard/notifications", roles: HOTEL_STAFF_ROLES },

  // { title: "Operations", icon: MdOutlineWorkOutline, url: "/dashboard/operations", roles: MANAGERISH_ROLES },

  // ---- Admin / Management ----
  { title: "Users", icon: HiOutlineUserGroup, url: "/dashboard/users", roles: MANAGERISH_ROLES },


  // ---- Accounting / reporting (current system uses Orders as money source) ----
  { title: "Orders", icon: CiReceipt, url: "/dashboard/orders", roles: ACCOUNTING_ROLES },

  // ---- Legacy restaurant modules (optional) ----
  { title: "Menu", icon: VscLayoutMenubar, url: "/dashboard/menu", roles: MANAGERISH_ROLES },
  
  { title: "Settings", icon: HiOutlineCog6Tooth, url: "/dashboard/settings", roles: MANAGERISH_ROLES },


];
