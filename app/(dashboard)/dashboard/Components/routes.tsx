// app/(dashboard)/dashboard/Components/routes.tsx

import { HiOutlineHome, HiOutlineUserGroup, HiOutlineCog6Tooth, HiOutlineTruck } from "react-icons/hi2";
import { AiOutlineDashboard, AiOutlineMessage } from "react-icons/ai";
import { CiReceipt } from "react-icons/ci";
import { VscLayoutMenubar } from "react-icons/vsc";

// New icons
import { HiOutlineClipboardDocumentList } from "react-icons/hi2"; // tasks
import { MdOutlineCleaningServices } from "react-icons/md"; // housekeeping
import { MdOutlineRoomService } from "react-icons/md"; // room-service
import { MdOutlineMeetingRoom } from "react-icons/md"; // room-board
import { MdOutlineFrontHand } from "react-icons/md"; // reception
import { MdOutlineWorkOutline } from "react-icons/md"; // operations
import { MdOutlinePersonAddAlt } from "react-icons/md"; // customers/register
import { MdOutlineReceiptLong } from "react-icons/md"; // folio

export const AdminRoutes = [
  { title: "Home", icon: HiOutlineHome, url: "/" },
  { title: "Dashboard", icon: AiOutlineDashboard, url: "/dashboard" },

  // Core admin modules
  { title: "Users", icon: HiOutlineUserGroup, url: "/dashboard/users" },
  { title: "Orders", icon: CiReceipt, url: "/dashboard/orders" },
  { title: "Menu", icon: VscLayoutMenubar, url: "/dashboard/menu" },
  { title: "Notifications", icon: AiOutlineMessage, url: "/dashboard/notifications" },

  // Hotel / operations modules (based on your folder structure)
  { title: "Reception", icon: MdOutlineFrontHand, url: "/dashboard/reception" },
  { title: "Room Board", icon: MdOutlineMeetingRoom, url: "/dashboard/room-board" },
  { title: "Room Service", icon: MdOutlineRoomService, url: "/dashboard/room-service" },
  // You already had deliveries as "Room service" - keeping it but renaming for clarity
  { title: "Deliveries", icon: HiOutlineTruck, url: "/dashboard/deliveries" },

  { title: "Operations", icon: MdOutlineWorkOutline, url: "/dashboard/operations" },
  { title: "Housekeeping", icon: MdOutlineCleaningServices, url: "/dashboard/housekeeping" },
  { title: "Tasks", icon: HiOutlineClipboardDocumentList, url: "/dashboard/tasks" },

  // Customers + Folio
  { title: "Register Customer", icon: MdOutlinePersonAddAlt, url: "/dashboard/customers/register" },

  /**
   * Folio הוא דינמי: /dashboard/folio/[reservationId]
   * לכן אין “עמוד רשימה” בתיקייה /folio (רק [reservationId])
   * אם בכל זאת רוצים בתפריט — אפשר לשים אותו כקישור “placeholder”
   * ולנווט אליו רק מתוך Reservation/Operations עם reservationId אמיתי.
   */
  // { title: "Folio", icon: MdOutlineReceiptLong, url: "/dashboard/folio" },

  { title: "Settings", icon: HiOutlineCog6Tooth, url: "/dashboard/settings" },
];
