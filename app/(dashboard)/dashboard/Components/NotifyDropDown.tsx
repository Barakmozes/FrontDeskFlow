// app/(dashboard)/dashboard/Components/NotifyDropDown.tsx
"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { Menu, Transition } from "@headlessui/react";
import { HiOutlineBellAlert } from "react-icons/hi2";
import { useMutation, useQuery } from "@urql/next";
import { gql } from "urql";

// ✅ Decode TASK notifications (so you won't see JSON/encoded payload)
import { decodeTaskMessage, type TaskPayloadV1 } from "@/lib/tasks/taskCodec";

// --- GraphQL (inline) ---
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

type Props = {
  /** Pass from server (recommended): user?.email */
  userEmail?: string | null;
  /** Max items shown in dropdown */
  limit?: number;
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
 * ✅ Human readable message formatter
 * - If type === "TASK": decode with taskCodec and display title + nice subtitle.
 * - Else: try to parse JSON and extract common fields; fallback to plain text.
 */
function toDisplayMessage(type: unknown, raw: unknown): { title: string; subtitle?: string } {
  const t = String(type ?? "").trim();
  const s =
    typeof raw === "string"
      ? raw.trim()
      : (() => {
          try {
            return JSON.stringify(raw);
          } catch {
            return String(raw ?? "");
          }
        })();

  // TASK payload
  if (t.toUpperCase() === "TASK") {
    try {
      const payload = decodeTaskMessage(s) as TaskPayloadV1;

      const title = String(payload?.title ?? "").trim() || "Task";
      const meta: string[] = [];

      if (payload?.kind) meta.push(String(payload.kind));
      if (payload?.roomNumber != null) meta.push(`Room ${payload.roomNumber}`);
      if (payload?.dueAt) meta.push(`Due: ${formatWhen(payload.dueAt)}`);

      const subtitle =
        payload?.description?.trim()
          ? payload.description.trim()
          : meta.length
          ? meta.join(" · ")
          : undefined;

      return { title, subtitle };
    } catch {
      // fallthrough
    }
  }

  // Generic "looks like JSON" parse
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    try {
      const obj: any = JSON.parse(s);
      const title =
        (typeof obj?.title === "string" && obj.title.trim()) ||
        (typeof obj?.message === "string" && obj.message.trim()) ||
        (typeof obj?.text === "string" && obj.text.trim()) ||
        "";
      if (title) return { title };

      // If no good fields, keep it short
      const compact = JSON.stringify(obj);
      return { title: compact };
    } catch {
      return { title: s };
    }
  }

  return { title: s };
}

function unreadBadgeText(count: number) {
  if (count <= 0) return "";
  return count > 99 ? "99+" : String(count);
}

export default function NotifyDropDown({ userEmail, limit = 10 }: Props) {
  const email = userEmail ?? null;

  const [{ data, fetching, error }, reexecute] = useQuery<{ getUserNotifications: NotificationRow[] }>({
    query: GetUserNotificationsQuery,
    variables: { userEmail: email ?? "" },
    pause: !email,
    requestPolicy: "cache-and-network",
  });

  const [, markRead] = useMutation(MarkNotificationAsReadMutation);

  const notifications = useMemo(() => {
    const list = data?.getUserNotifications ?? [];
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [data?.getUserNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.status === "UNREAD").length,
    [notifications]
  );

  async function handleOpenNotification(n: NotificationRow) {
    if (n.status !== "UNREAD") return;

    const res = await markRead({ id: n.id });
    if (res.error) {
      console.error("markNotificationAsRead error:", res.error);
    }
    reexecute({ requestPolicy: "network-only" });
  }

  // Not logged in
  if (!email) {
    return (
      <button
        type="button"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-gray-500 cursor-not-allowed"
        title="Sign in to view notifications"
        disabled
      >
        <HiOutlineBellAlert className="h-6 w-6" />
      </button>
    );
  }

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-gray-600 hover:bg-green-200 hover:text-green-700 transition"
        title="Notifications"
      >
        {/* Unread ping */}
        {unreadCount > 0 ? (
          <span className="absolute top-1.5 right-1.5">
            <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-green-500 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-600" />
          </span>
        ) : null}

        <HiOutlineBellAlert className="h-6 w-6" />

        {/* Count badge */}
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unreadBadgeText(unreadCount)}
          </span>
        ) : null}
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-[22rem] origin-top-right overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              <p className="text-[11px] text-gray-500 truncate">{email}</p>
            </div>

            <Link
              href="/dashboard/notifications"
              className="text-xs font-medium text-green-700 hover:underline"
            >
              View all →
            </Link>
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {fetching ? (
              <div className="px-4 py-3 text-sm text-gray-500">Loading…</div>
            ) : null}

            {error ? (
              <div className="px-4 py-3 text-sm text-red-600">Failed to load notifications.</div>
            ) : null}

            {!fetching && !error && notifications.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No notifications yet.</div>
            ) : null}

            {!error &&
              notifications.slice(0, limit).map((n) => {
                const view = toDisplayMessage(n.type, n.message);

                return (
                  <Menu.Item key={n.id}>
                    {({ active }) => (
                      <Link
                        href="/dashboard/notifications"
                        onClick={() => handleOpenNotification(n)}
                        className={[
                          "block px-4 py-3 border-b last:border-b-0",
                          active ? "bg-slate-50" : "bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-800">
                                {n.type}
                              </span>

                              {n.status === "UNREAD" ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  NEW
                                </span>
                              ) : null}
                            </div>

                            {/* ✅ human readable message */}
                            <div className="mt-1">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {view.title}
                              </div>
                              {view.subtitle ? (
                                <div className="text-xs text-gray-600 truncate">
                                  {view.subtitle}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="text-[10px] text-gray-400 whitespace-nowrap pt-0.5">
                            {formatTime(n.createdAt)}
                          </div>
                        </div>
                      </Link>
                    )}
                  </Menu.Item>
                );
              })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
            <span className="text-[11px] text-gray-600">
              Unread: <span className="font-semibold">{unreadCount}</span>
            </span>

            <button
              type="button"
              onClick={() => reexecute({ requestPolicy: "network-only" })}
              className="text-xs font-medium text-gray-700 hover:text-gray-900"
              title="Refresh"
            >
              Refresh
            </button>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
