// app/(dashboard)/dashboard/notifications/NotificationsList.tsx
"use client";

import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@urql/next";
import { TbLetterO, TbLetterQ, TbLetterS } from "react-icons/tb";
import { decodeTaskMessage, type TaskPayloadV1 } from "@/lib/tasks/taskCodec";

type Props = {
  /** Email of the user whose notifications we want to show */
  userEmail: string | null;
};

type NotificationStatus = "READ" | "UNREAD";
type NotificationPriority = "LOW" | "NORMAL" | "HIGH";

type NotificationRow = {
  id: string;
  type: string;
  message: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  createdAt: string;
  updatedAt: string;
};

type ActiveTab = "all" | "read" | "unread";

// ---------- GraphQL ----------
const GetUserNotificationsQuery = gql`
  query GetUserNotifications($userEmail: String!) {
    getUserNotifications(userEmail: $userEmail) {
      id
      type
      message
      status
      priority
      createdAt
      updatedAt
    }
  }
`;

const MarkNotificationAsReadMutation = gql`
  mutation MarkNotificationAsRead($id: String!) {
    markNotificationAsRead(id: $id) {
      id
      status
      updatedAt
    }
  }
`;

// ---------- Helpers ----------
const formatTime = (date: unknown) => {
  const d = new Date(String(date ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatWhen = (date: unknown) => {
  const d = new Date(String(date ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
};

const toDisplayMessage = (type: string, msg: string) => {
  const t = type?.trim() ?? "";
  if (!msg) return { title: "" };

  // TASK messages
  if (t.toUpperCase() === "TASK") {
    try {
      const payload = decodeTaskMessage(msg) as TaskPayloadV1;
      const title = payload?.title?.trim() || "Task";
      const parts: string[] = [];
      if (payload?.kind) parts.push(payload.kind);
      if (payload?.roomNumber != null) parts.push(`Room ${payload.roomNumber}`);
      if (payload?.dueAt) parts.push(`Due: ${formatWhen(payload.dueAt)}`);
      const subtitle = payload?.description?.trim() || (parts.length ? parts.join(" · ") : undefined);
      return { title, subtitle };
    } catch {
      // fallthrough
    }
  }

  // Try JSON parse
  if ((msg.startsWith("{") && msg.endsWith("}")) || (msg.startsWith("[") && msg.endsWith("]"))) {
    try {
      const obj = JSON.parse(msg);
      const title = obj?.title || obj?.message || obj?.text || msg;
      return { title };
    } catch {
      return { title: msg };
    }
  }

  // Plain text
  return { title: msg };
};

const pillColor = (priority: NotificationPriority) => {
  switch (priority) {
    case "HIGH":
      return "bg-red-700";
    case "LOW":
      return "bg-slate-600";
    default:
      return "bg-green-700";
  }
};

const TypeIcon = ({ type, priority }: { type: string; priority: NotificationPriority }) => {
  const t = type?.trim() ?? "";
  const btnClass = `p-2 text-white rounded-full ${pillColor(priority)}`;

  if (t === "Signup") return <span className={btnClass}><TbLetterS size={28} /></span>;
  if (t === "Query") return <span className={btnClass}><TbLetterQ size={28} /></span>;
  if (t === "Order") return <span className={btnClass}><TbLetterO size={28} /></span>;

  const letter = (t[0] ?? "N").toUpperCase();
  return (
    <span className={btnClass}>
      <span className="block w-[28px] text-center text-lg font-bold leading-7">{letter}</span>
    </span>
  );
};

// ---------- Component ----------
export default function NotificationsList({ userEmail }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [markingAll, setMarkingAll] = useState(false);

  const [{ data, fetching, error }, reexecute] = useQuery<{ getUserNotifications: NotificationRow[] }>({
    query: GetUserNotificationsQuery,
    variables: { userEmail: userEmail ?? "" },
    pause: !userEmail,
    requestPolicy: "cache-and-network",
  });

  const [, markRead] = useMutation(MarkNotificationAsReadMutation);

  const all = useMemo(() => [...(data?.getUserNotifications ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ), [data?.getUserNotifications]);

  const counts = useMemo(() => {
    const unread = all.filter(n => n.status === "UNREAD").length;
    const read = all.filter(n => n.status === "READ").length;
    return { all: all.length, unread, read };
  }, [all]);

  const filtered = useMemo(() => {
    let list = all;
    if (activeTab === "read") list = list.filter(n => n.status === "READ");
    if (activeTab === "unread") list = list.filter(n => n.status === "UNREAD");
    return list;
  }, [all, activeTab]);

  const markOneAsRead = async (n: NotificationRow) => {
    if (n.status === "READ") return;
    await markRead({ id: n.id });
    reexecute({ requestPolicy: "network-only" });
  };

  const markAllAsRead = async () => {
    const unread = all.filter(n => n.status === "UNREAD");
    if (unread.length === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      for (const n of unread) {
        await markRead({ id: n.id });
      }
      reexecute({ requestPolicy: "network-only" });
    } finally {
      setMarkingAll(false);
    }
  };

  if (!userEmail) {
    return (
      <div className="p-10 text-center text-gray-500">
        You must be signed in to view notifications.
      </div>
    );
  }

  return (
    <section className="mt-4">
      {/* Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 p-4 items-center">
        <div className="text-center md:text-left">
          <h1 className="text-lg md:text-2xl font-semibold">Notifications</h1>
          <p className="text-xs text-gray-500 mt-1">{userEmail}</p>
        </div>
        <div className="flex justify-center md:justify-end">
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={markingAll || counts.unread === 0}
            className={`text-green-600 p-2 rounded-md hover:bg-green-200 ${markingAll || counts.unread === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {markingAll ? "Marking…" : "Mark all as read"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center space-x-3 border-b p-2">
        {(["all", "read", "unread"] as ActiveTab[]).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`p-1 ${activeTab === tab ? "border-b-2 border-green-600 text-green-700 bg-green-50" : ""}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tab === "all" ? counts.all : tab === "read" ? counts.read : counts.unread})
          </button>
        ))}
      </div>

      {/* List */}
      <div className="p-4 max-h-[70vh] space-y-3 overflow-y-auto scrollbar-hide">
        {fetching && <div className="text-sm text-gray-500">Loading…</div>}
        {error && <div className="text-sm text-red-600">Failed to load notifications.</div>}
        {!fetching && !error && filtered.length === 0 && <div className="text-sm text-gray-500">No notifications.</div>}

        {filtered.map(n => {
          const view = toDisplayMessage(n.type, n.message);
          return (
            <div className="flex items-center space-x-2" key={n.id}>
              <TypeIcon type={n.type} priority={n.priority} />

              <button
                type="button"
                onClick={() => markOneAsRead(n)}
                className={`flex flex-col flex-1 p-2 rounded-md text-left cursor-pointer transition ${n.status === "READ" ? "bg-white" : "bg-slate-100 text-green-800 hover:bg-green-100"}`}
              >
                <h3 className={n.status === "UNREAD" ? "font-semibold" : ""}>
                  {view.title}
                  {n.status === "UNREAD" && <span className="ml-2 text-[10px] text-green-700 font-semibold">NEW</span>}
                </h3>
                {view.subtitle && <p className="text-xs text-gray-600 truncate">{view.subtitle}</p>}
                <p className="text-xs text-gray-500 whitespace-nowrap">{formatTime(n.createdAt)}</p>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
