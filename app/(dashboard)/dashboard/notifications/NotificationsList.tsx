// app/(dashboard)/dashboard/notifications/NotificationsList.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { gql } from "urql";
import { useMutation, useQuery } from "@urql/next";
import { TbLetterO, TbLetterQ, TbLetterS } from "react-icons/tb";

import { decodeTaskMessage, type TaskPayloadV1 } from "@/lib/tasks/taskCodec";

/**
 * NotificationsList
 * - Personal list for the currently logged-in user
 * - Connected to real DB notifications (GraphQL)
 *
 * IMPORTANT:
 * - Some notifications (TASK) store their message in an encoded payload format
 *   via encodeTaskMessage(). If we render n.message directly it will look like JSON/encoded text.
 * - This component decodes TASK messages into a human readable title/summary.
 */

type Props = {
  /** Optional: if you want to pass from server page (getCurrentUser().email) */
  userEmail?: string | null;
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

// ---------- UI helpers ----------
function formatTime(dateLike: unknown): string {
  const d = new Date(String(dateLike ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWhen(dateLike: unknown): string {
  const d = new Date(String(dateLike ?? ""));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

/**
 * Decode and normalize "message" into a human-friendly string.
 * - For TASK type, uses decodeTaskMessage() (handles your encoded payload).
 * - For other types, tries to parse JSON and extract common fields.
 */
function toDisplayMessage(type: unknown, msg: unknown): { title: string; subtitle?: string } {
  const t = String(type ?? "").trim();
  if (msg == null) return { title: "" };

  // Always start from string
  const s =
    typeof msg === "string"
      ? msg.trim()
      : (() => {
          try {
            return JSON.stringify(msg);
          } catch {
            return String(msg);
          }
        })();

  // 1) TASK: decode using your task codec
  if (t.toUpperCase() === "TASK") {
    try {
      const payload = decodeTaskMessage(s) as TaskPayloadV1;

      const title = String(payload?.title ?? "").trim() || "Task";
      const parts: string[] = [];

      // Optional bits that read nicely in Notifications
      if (payload?.kind) parts.push(String(payload.kind));
      if (payload?.roomNumber != null) parts.push(`Room ${payload.roomNumber}`);
      if (payload?.dueAt) parts.push(`Due: ${formatWhen(payload.dueAt)}`);

      const subtitle =
        payload?.description?.trim()
          ? payload.description.trim()
          : parts.length
          ? parts.join(" · ")
          : undefined;

      return { title, subtitle };
    } catch {
      // fallthrough to generic parsing
    }
  }

  // 2) Generic JSON string parsing
  if (
    (s.startsWith("{") && s.endsWith("}")) ||
    (s.startsWith("[") && s.endsWith("]"))
  ) {
    try {
      const obj: any = JSON.parse(s);

      // common fields
      const title =
        (typeof obj?.title === "string" && obj.title.trim()) ||
        (typeof obj?.message === "string" && obj.message.trim()) ||
        (typeof obj?.text === "string" && obj.text.trim()) ||
        "";

      // If we found something meaningful, show it. Otherwise, last resort: compact string.
      if (title) return { title };

      // If it's an object but no known fields:
      return { title: typeof obj === "string" ? obj : JSON.stringify(obj) };
    } catch {
      // not valid JSON
      return { title: s };
    }
  }

  // 3) Plain text
  return { title: s };
}

function pillColor(priority: NotificationPriority): string {
  if (priority === "HIGH") return "bg-red-700";
  if (priority === "LOW") return "bg-slate-600";
  return "bg-green-700";
}

/**
 * Some legacy type icons (from your original UI).
 * For everything else, we render the first letter in a circle.
 */
function TypeIcon({ type, priority }: { type: string; priority: NotificationPriority }) {
  const t = (type ?? "").trim();

  const btnClass = `p-2 text-white rounded-full ${pillColor(priority)}`;

  if (t === "Signup") return <span className={btnClass}><TbLetterS size={28} /></span>;
  if (t === "Query") return <span className={btnClass}><TbLetterQ size={28} /></span>;
  if (t === "Order") return <span className={btnClass}><TbLetterO size={28} /></span>;

  const letter = (t[0] ?? "N").toUpperCase();

  return (
    <span className={btnClass}>
      <span className="block w-[28px] text-center text-lg font-bold leading-7">
        {letter}
      </span>
    </span>
  );
}

export default function NotificationsList({ userEmail }: Props) {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim().toLowerCase();

  // Prefer prop, fallback to next-auth session
  const { data: session } = useSession();
  const email = userEmail ?? (session?.user?.email ?? null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [markingAll, setMarkingAll] = useState(false);

  const [{ data, fetching, error }, reexecute] = useQuery<{
    getUserNotifications: NotificationRow[];
  }>({
    query: GetUserNotificationsQuery,
    variables: { userEmail: email ?? "" },
    pause: !email,
    requestPolicy: "cache-and-network",
  });

  const [, markRead] = useMutation(MarkNotificationAsReadMutation);

  const all = useMemo(() => {
    const list = data?.getUserNotifications ?? [];
    // newest first
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [data?.getUserNotifications]);

  const counts = useMemo(() => {
    const unread = all.filter((n) => n.status === "UNREAD").length;
    const read = all.filter((n) => n.status === "READ").length;
    return { all: all.length, unread, read };
  }, [all]);

  const filtered = useMemo(() => {
    let list = all;

    // Tab filter
    if (activeTab === "read") list = list.filter((n) => n.status === "READ");
    if (activeTab === "unread") list = list.filter((n) => n.status === "UNREAD");

    // Search filter (?q=) — matches type/message/title/decoded fields
    if (q) {
      list = list.filter((n) => {
        const view = toDisplayMessage(n.type, n.message);
        const hay = `${n.type} ${n.message} ${view.title} ${view.subtitle ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    return list;
  }, [all, activeTab, q]);

  async function markOneAsRead(n: NotificationRow) {
    if (n.status !== "UNREAD") return;

    const res = await markRead({ id: n.id });
    if (res.error) {
      console.error("markNotificationAsRead error:", res.error);
      return;
    }

    reexecute({ requestPolicy: "network-only" });
  }

  async function markAllAsRead() {
    const unread = all.filter((n) => n.status === "UNREAD");
    if (unread.length === 0 || markingAll) return;

    setMarkingAll(true);
    try {
      // Sequential to avoid flooding the API.
      for (const n of unread) {
        const res = await markRead({ id: n.id });
        if (res.error) {
          console.error("markAll: markNotificationAsRead error:", res.error);
        }
      }
      reexecute({ requestPolicy: "network-only" });
    } finally {
      setMarkingAll(false);
    }
  }

  const isTabActive = (tab: ActiveTab) => activeTab === tab;

  if (!email) {
    return (
      <section className="mt-8 bg-white">
        <div className="p-10 text-center">
          <h1 className="text-lg md:text-3xl">Notifications</h1>
          <p className="mt-2 text-sm text-gray-500">
            You must be signed in to view notifications.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 bg-white">
      {/* Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 p-10 items-center">
        <div className="text-center md:text-left">
          <h1 className="text-lg md:text-3xl">Notifications</h1>
          <p className="text-xs text-gray-500 mt-1">{email}</p>
        </div>

        <div className="flex justify-center md:justify-end">
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={markingAll || counts.unread === 0}
            className={`text-green-600 p-2 rounded-md hover:bg-green-200 ${
              markingAll || counts.unread === 0 ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title={counts.unread === 0 ? "No unread notifications" : "Mark all as read"}
          >
            {markingAll ? "Marking…" : "Mark all as read"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center space-x-3 border-b p-2">
        <button
          className={`p-1 ${
            isTabActive("all") && "border-b-2 border-green-600 text-green-700 bg-green-50"
          }`}
          onClick={() => setActiveTab("all")}
          type="button"
        >
          All <span className="text-xs text-gray-400">({counts.all})</span>
        </button>

        <button
          className={`p-1 ${
            isTabActive("read") && "border-b-2 border-green-600 text-green-700 bg-green-50"
          }`}
          onClick={() => setActiveTab("read")}
          type="button"
        >
          Read <span className="text-xs text-gray-400">({counts.read})</span>
        </button>

        <button
          className={`p-1 ${
            isTabActive("unread") &&
            "border-b-2 border-green-600 text-green-700 bg-green-50"
          }`}
          onClick={() => setActiveTab("unread")}
          type="button"
        >
          Unread <span className="text-xs text-gray-400">({counts.unread})</span>
        </button>
      </div>

      {/* List */}
      <div className="p-4 max-h-[80vh] space-y-3 overflow-y-auto scrollbar-hide">
        {fetching ? <div className="text-sm text-gray-500">Loading…</div> : null}

        {error ? (
          <div className="text-sm text-red-600">
            Failed to load notifications: {error.message}
          </div>
        ) : null}

        {!fetching && !error && filtered.length === 0 ? (
          <div className="text-sm text-gray-500">
            {q ? "No notifications match your search." : "No notifications here."}
          </div>
        ) : null}

        {!error &&
          filtered.map((n) => {
            const view = toDisplayMessage(n.type, n.message);

            return (
              <div className="flex items-center space-x-2" key={n.id}>
                {/* Icon */}
                <div>
                  <TypeIcon type={n.type} priority={n.priority} />
                </div>

                {/* Body (click marks as read) */}
                <button
                  type="button"
                  onClick={() => markOneAsRead(n)}
                  className={`flex flex-col flex-1 p-2 rounded-md text-left cursor-pointer transition ${
                    n.status === "READ"
                      ? "bg-white"
                      : "bg-slate-100 text-green-800 hover:bg-green-100"
                  }`}
                  title={n.status === "UNREAD" ? "Click to mark as read" : "Read"}
                >
                  <h3 className={n.status === "READ" ? "" : "font-semibold"}>
                    {n.type}
                    {n.status === "UNREAD" ? (
                      <span className="ml-2 text-[10px] text-green-700 font-semibold">
                        NEW
                      </span>
                    ) : null}
                  </h3>

                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                      {/* Title (always readable) */}
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {view.title}
                      </p>

                      {/* Subtitle (optional) */}
                      {view.subtitle ? (
                        <p className="text-xs text-gray-600 truncate">
                          {view.subtitle}
                        </p>
                      ) : null}
                    </div>

                    <p className="text-xs text-gray-500 whitespace-nowrap">
                      {formatTime(n.createdAt)}
                    </p>
                  </div>
                </button>
              </div>
            );
          })}
      </div>
    </section>
  );
}
