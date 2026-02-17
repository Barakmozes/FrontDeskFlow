// app/components/Restaurant_interface/Tasks/TasksPanel.tsx
"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";

import {
  // Who am I?
  GetUserDocument,
  type GetUserQuery,
  type GetUserQueryVariables,
  Role,

  // Notifications (used as Tasks)
  GetUserNotificationsDocument,
  type GetUserNotificationsQuery,
  type GetUserNotificationsQueryVariables,

  AddNotificationDocument,
  type AddNotificationMutation,
  type AddNotificationMutationVariables,

  UpdateNotificationDocument,
  type UpdateNotificationMutation,
  type UpdateNotificationMutationVariables,

  DeleteNotificationDocument,
  type DeleteNotificationMutation,
  type DeleteNotificationMutationVariables,

  NotificationPriority,
  NotificationStatus,
} from "@/graphql/generated";

import {
  decodeTaskMessage,
  encodeTaskMessage,
  type TaskPayloadV1,
  type TaskKind,
  TASK_KINDS,
} from "@/lib/tasks/taskCodec";

const TASK_TYPE = "TASK";

type PanelTask = {
  id: string;
  userEmail: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  createdAt: string;
  updatedAt?: string | null;
  rawMessage: string;
  payload: TaskPayloadV1;
  isLegacyPlainText: boolean;
};

function safeDecodeTaskMessage(raw: string): { payload: TaskPayloadV1; isLegacyPlainText: boolean } {
  try {
    const payload = decodeTaskMessage(raw);
    // Basic sanity: must have title
    if (payload && typeof payload.title === "string") {
      return { payload, isLegacyPlainText: false };
    }
  } catch {
    // fallthrough
  }

  // Legacy plain text
  const payload: TaskPayloadV1 = {
    v: 1,
    title: (raw ?? "").trim() || "Untitled task",
    notes: [],
  };

  return { payload, isLegacyPlainText: true };
}

function formatWhen(dt?: string | null) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function badgeClass(kind: "status" | "priority", value: string) {
  if (kind === "status") {
    return value === "OPEN"
      ? "bg-amber-100 text-amber-800"
      : "bg-emerald-100 text-emerald-800";
  }
  if (value === NotificationPriority.High) return "bg-red-100 text-red-800";
  if (value === NotificationPriority.Low) return "bg-gray-100 text-gray-800";
  return "bg-blue-100 text-blue-800";
}

/**
 * TasksPanel
 * Uses Notification model as a lightweight task system.
 * IMPORTANT: We always store tasks using encodeTaskMessage(payload).
 * Backward compatible: if old tasks stored as plain text, we decode safely and treat it as title.
 */
export default function TasksPanel({
  currentUserEmail,
}: {
  currentUserEmail: string | null;
}) {
  // Create form (professional: title + optional description + due + kind)
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<TaskKind>("FRONT_DESK");
  const [dueAtLocal, setDueAtLocal] = useState<string>("");
  const [priority, setPriority] = useState<NotificationPriority>(NotificationPriority.Normal);

  // Completion notes by task id
  const [completeNote, setCompleteNote] = useState<Record<string, string>>({});

  // Who am I? (role check for manager/admin capabilities)
  const [{ data: meData }] = useQuery<GetUserQuery, GetUserQueryVariables>({
    query: GetUserDocument,
    variables: { email: currentUserEmail ?? "" },
    pause: !currentUserEmail,
    requestPolicy: "cache-first",
  });

  const myRole = meData?.getUser?.role ?? null;
  const myName =
    // depending on your schema, adjust if needed:
    (meData as any)?.getUser?.name ??
    (meData as any)?.getUser?.profile?.name ??
    null;

  const canAssign = myRole === Role.Admin || myRole === Role.Manager;

  const [{ data, fetching, error }, reexec] = useQuery<
    GetUserNotificationsQuery,
    GetUserNotificationsQueryVariables
  >({
    query: GetUserNotificationsDocument,
    variables: { userEmail: currentUserEmail ?? "" },
    pause: !currentUserEmail,
    requestPolicy: "cache-and-network",
  });

  const [{ fetching: creating }, addNotification] = useMutation<
    AddNotificationMutation,
    AddNotificationMutationVariables
  >(AddNotificationDocument);

  const [{ fetching: updating }, updateNotification] = useMutation<
    UpdateNotificationMutation,
    UpdateNotificationMutationVariables
  >(UpdateNotificationDocument);

  const [{ fetching: deleting }, deleteNotification] = useMutation<
    DeleteNotificationMutation,
    DeleteNotificationMutationVariables
  >(DeleteNotificationDocument);

  const tasks: PanelTask[] = useMemo(() => {
    const list = (data?.getUserNotifications ?? []).filter((n) => n.type === TASK_TYPE);

    return list
      .map((n) => {
        const decoded = safeDecodeTaskMessage(n.message);
        return {
          id: n.id,
          userEmail: n.userEmail,
          priority: n.priority,
          status: n.status,
          createdAt: n.createdAt,
          updatedAt: (n as any).updatedAt ?? null,
          rawMessage: n.message,
          payload: decoded.payload,
          isLegacyPlainText: decoded.isLegacyPlainText,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data]);

  const openTasks = tasks.filter((t) => t.status === NotificationStatus.Unread);
  const doneTasks = tasks.filter((t) => t.status === NotificationStatus.Read);

  function refresh() {
    reexec({ requestPolicy: "network-only" });
  }

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserEmail) {
      toast.error("Not logged in.");
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error("Task title is required.");
      return;
    }

    // If not manager/admin, tasks can only be created for yourself.
    const targetEmail = canAssign
      ? (assigneeEmail.trim() || currentUserEmail)
      : currentUserEmail;

    const dueAtIso = dueAtLocal ? new Date(dueAtLocal).toISOString() : undefined;

    const payload: TaskPayloadV1 = {
      v: 1,
      title: cleanTitle,
      description: description.trim() || undefined,
      kind,
      dueAt: dueAtIso,
      createdBy: {
        email: currentUserEmail,
        name: myName,
      },
      notes: [],
    };

    const encoded = encodeTaskMessage(payload);

    const res = await addNotification({
      userEmail: targetEmail,
      type: TASK_TYPE,
      message: encoded,
      priority,
      status: NotificationStatus.Unread, // OPEN
    });

    if (res.error) {
      console.error(res.error);
      toast.error(res.error.message || "Failed to create task.");
      return;
    }

    toast.success("Task created.");
    setTitle("");
    setDescription("");
    setAssigneeEmail("");
    setKind("FRONT_DESK");
    setDueAtLocal("");
    setPriority(NotificationPriority.Normal);
    refresh();
  };

  const markDone = async (id: string, rawMessage: string) => {
    const noteText = (completeNote[id] ?? "").trim();

    // Always decode → update payload.notes → re-encode
    const decoded = safeDecodeTaskMessage(rawMessage);
    const nextPayload: TaskPayloadV1 = {
      ...decoded.payload,
      v: 1,
      title: decoded.payload.title || "Untitled task",
      notes: Array.isArray(decoded.payload.notes) ? [...decoded.payload.notes] : [],
    };

    if (noteText) {
      nextPayload.notes!.push({
        at: new Date().toISOString(),
        text: noteText,
        by: {
          email: currentUserEmail ?? null,
          name: myName ?? null,
        },
      });
    }

    const nextMessage = encodeTaskMessage(nextPayload);

    const res = await updateNotification({
      updateNotificationId: id,
      status: NotificationStatus.Read, // DONE
      message: nextMessage,
    });

    if (res.error) {
      console.error(res.error);
      toast.error(res.error.message || "Failed to mark done.");
      return;
    }

    toast.success("Marked as done.");
    setCompleteNote((s) => ({ ...s, [id]: "" }));
    refresh();
  };

  const reopen = async (id: string) => {
    const res = await updateNotification({
      updateNotificationId: id,
      status: NotificationStatus.Unread,
    });

    if (res.error) {
      console.error(res.error);
      toast.error(res.error.message || "Failed to reopen task.");
      return;
    }

    toast.success("Reopened task.");
    refresh();
  };

  const remove = async (id: string) => {
    const res = await deleteNotification({ deleteNotificationId: id });
    if (res.error) {
      console.error(res.error);
      toast.error(res.error.message || "Failed to delete task.");
      return;
    }

    toast.success("Deleted.");
    refresh();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">My Tasks</h2>
          <p className="text-xs text-gray-500">
            Stored as Notifications (type = “TASK”). UNREAD=open, READ=done.
          </p>
        </div>

        <button
          onClick={refresh}
          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
        >
          Refresh
        </button>
      </div>

      {!currentUserEmail ? (
        <div className="mt-3 text-xs text-gray-600">Login is required to view tasks.</div>
      ) : null}

      {error ? (
        <div className="mt-3 text-xs text-red-600">Failed: {error.message}</div>
      ) : null}

      {/* Create task */}
      {currentUserEmail ? (
        <form onSubmit={createTask} className="mt-3 space-y-2">
          {canAssign ? (
            <input
              value={assigneeEmail}
              onChange={(e) => setAssigneeEmail(e.target.value)}
              placeholder="Assign to email or Name!"
              className="w-full border rounded-md px-3 py-2 text-xs"
            />
          ) : (
            <div className="text-[11px] text-gray-500">
              Only managers/admins can assign tasks to other employees.
            </div>
          )}

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title… (e.g. Replace towels in 204)"
            className="w-full border rounded-md px-3 py-2 text-xs"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)…"
            className="w-full border rounded-md px-3 py-2 text-xs min-h-[70px]"
          />

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as TaskKind)}
              className="border rounded-md px-2 py-2 text-xs bg-white"
            >
              {TASK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as NotificationPriority)}
              className="border rounded-md px-2 py-2 text-xs bg-white"
            >
              <option value={NotificationPriority.Low}>Low</option>
              <option value={NotificationPriority.Normal}>Normal</option>
              <option value={NotificationPriority.High}>High</option>
            </select>

            <input
              type="datetime-local"
              value={dueAtLocal}
              onChange={(e) => setDueAtLocal(e.target.value)}
              className="border rounded-md px-2 py-2 text-xs bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full text-xs px-3 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-950 disabled:bg-gray-300"
          >
            {creating ? "Creating…" : "Create Task"}
          </button>
        </form>
      ) : null}

      {/* List */}
      <div className="mt-4 space-y-3">
        <div className="text-xs text-gray-700 font-semibold">Open ({openTasks.length})</div>

        {fetching ? <div className="text-xs text-gray-500">Loading…</div> : null}

        {openTasks.length === 0 ? (
          <div className="text-xs text-gray-500">No open tasks.</div>
        ) : (
          openTasks.map((t) => {
            const statusLabel = "OPEN";
            const payload = t.payload;

            return (
              <div key={t.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] ${badgeClass(
                          "status",
                          statusLabel
                        )}`}
                      >
                        OPEN
                      </span>

                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] ${badgeClass(
                          "priority",
                          t.priority
                        )}`}
                      >
                        {t.priority}
                      </span>

                      {payload.kind ? (
                        <span className="inline-flex rounded-full px-2 py-1 text-[11px] bg-gray-100 text-gray-700">
                          {payload.kind}
                        </span>
                      ) : null}

                      {t.isLegacyPlainText ? (
                        <span className="inline-flex rounded-full px-2 py-1 text-[11px] bg-yellow-50 text-yellow-700 border border-yellow-200">
                          legacy text
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-xs font-semibold text-gray-900 whitespace-pre-wrap">
                      {payload.title || "Untitled task"}
                    </p>

                    {payload.description ? (
                      <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                        {payload.description}
                      </p>
                    ) : null}

                    <p className="text-[11px] text-gray-500 mt-2">
                      Created: {formatWhen(t.createdAt)}
                      {payload.dueAt ? ` • Due: ${formatWhen(payload.dueAt)}` : ""}
                    </p>

                    {Array.isArray(payload.notes) && payload.notes.length > 0 ? (
                      <div className="mt-2 rounded-md bg-gray-50 p-2">
                        <div className="text-[11px] font-semibold text-gray-700">Notes</div>
                        <div className="mt-1 space-y-1">
                          {payload.notes.slice(-2).map((n, idx) => (
                            <div key={idx} className="text-[11px] text-gray-700 whitespace-pre-wrap">
                              <span className="text-gray-500">{formatWhen(n.at)}:</span>{" "}
                              {n.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    disabled={deleting}
                    className="text-[11px] px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  <input
                    value={completeNote[t.id] ?? ""}
                    onChange={(e) => setCompleteNote((s) => ({ ...s, [t.id]: e.target.value }))}
                    placeholder="Completion note (optional)"
                    className="w-full border rounded-md px-2 py-2 text-xs"
                  />

                  <button
                    type="button"
                    onClick={() => markDone(t.id, t.rawMessage)}
                    disabled={updating}
                    className="w-full text-xs px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300"
                  >
                    Mark Done
                  </button>
                </div>
              </div>
            );
          })
        )}

        <div className="text-xs text-gray-700 font-semibold">Done ({doneTasks.length})</div>

        {doneTasks.length === 0 ? (
          <div className="text-xs text-gray-500">No completed tasks.</div>
        ) : (
          doneTasks.slice(0, 8).map((t) => {
            const payload = t.payload;

            return (
              <div key={t.id} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] ${badgeClass(
                          "status",
                          "DONE"
                        )}`}
                      >
                        DONE
                      </span>

                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] ${badgeClass(
                          "priority",
                          t.priority
                        )}`}
                      >
                        {t.priority}
                      </span>
                    </div>

                    <p className="mt-2 text-xs font-semibold text-gray-900 whitespace-pre-wrap">
                      {payload.title || "Untitled task"}
                    </p>

                    {payload.description ? (
                      <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                        {payload.description}
                      </p>
                    ) : null}

                    <p className="text-[11px] text-gray-500 mt-2">
                      Updated: {formatWhen(t.updatedAt ?? t.createdAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    disabled={deleting}
                    className="text-[11px] px-2 py-1 rounded bg-white border hover:bg-gray-100 disabled:bg-gray-300"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => reopen(t.id)}
                    disabled={updating}
                    className="text-[11px] px-2 py-1 rounded bg-white border hover:bg-gray-100 disabled:bg-gray-300"
                  >
                    Reopen
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
