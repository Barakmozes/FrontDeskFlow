"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery } from "@urql/next";

import {
  // get current user role
  GetUserDocument,
  GetUserQuery,
  GetUserQueryVariables,
  Role,

  // tasks via notifications (generated after notification.graphql + codegen)
  GetUserNotificationsDocument,
  GetUserNotificationsQuery,
  GetUserNotificationsQueryVariables,

  AddNotificationDocument,
  AddNotificationMutation,
  AddNotificationMutationVariables,

  UpdateNotificationDocument,
  UpdateNotificationMutation,
  UpdateNotificationMutationVariables,

  DeleteNotificationDocument,
  DeleteNotificationMutation,
  DeleteNotificationMutationVariables,

  NotificationPriority,
  NotificationStatus,
} from "@/graphql/generated";

const TASK_TYPE = "TASK";

/**
 * Notification => Task mapping:
 * - type === "TASK" is a task
 * - status UNREAD = open, READ = completed
 *
 * This lets you ship the To-Do module without new Prisma models.
 */
export default function TasksPanel({ currentUserEmail }: { currentUserEmail: string | null }) {
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<NotificationPriority>(NotificationPriority.Normal);

  const [completeNote, setCompleteNote] = useState<Record<string, string>>({});

  // Who am I? (role check for manager/admin capabilities)
  const [{ data: meData }] = useQuery<GetUserQuery, GetUserQueryVariables>({
    query: GetUserDocument,
    variables: { email: currentUserEmail ?? "" },
    pause: !currentUserEmail,
  });

  const myRole = meData?.getUser?.role;
  const canAssign = myRole === Role.Admin || myRole === Role.Manager;

  const [
    { data, fetching, error },
    refetch,
  ] = useQuery<GetUserNotificationsQuery, GetUserNotificationsQueryVariables>({
    query: GetUserNotificationsDocument,
    variables: { userEmail: currentUserEmail ?? "" },
    pause: !currentUserEmail,
    requestPolicy: "cache-first",
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

  const tasks = useMemo(() => {
    const list = (data?.getUserNotifications ?? []).filter((n) => n.type === TASK_TYPE);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data]);

  const openTasks = tasks.filter((t) => t.status === NotificationStatus.Unread);
  const doneTasks = tasks.filter((t) => t.status === NotificationStatus.Read);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUserEmail) {
      toast.error("Not logged in.");
      return;
    }
    if (!message.trim()) {
      toast.error("Task description is required.");
      return;
    }

    // If not manager/admin, tasks can only be created for yourself.
    const targetEmail = canAssign
      ? (assigneeEmail.trim() || currentUserEmail)
      : currentUserEmail;

    const res = await addNotification({
      userEmail: targetEmail,
      type: TASK_TYPE,
      message: message.trim(),
      priority,
      status: NotificationStatus.Unread,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to create task.");
      return;
    }

    toast.success("Task created.");
    setMessage("");
    setAssigneeEmail("");
    refetch({ requestPolicy: "network-only" });
  };

  const markDone = async (id: string, currentMessage: string) => {
    const note = (completeNote[id] ?? "").trim();

    // Append a completion note into message so we don't need a new DB column.
    const nextMessage =
      note.length > 0 ? `${currentMessage}\n\n✅ Done note: ${note}` : currentMessage;

    const res = await updateNotification({
      updateNotificationId: id,
      status: NotificationStatus.Read,
      message: nextMessage,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to mark done.");
      return;
    }

    toast.success("Marked as done.");
    refetch({ requestPolicy: "network-only" });
  };

  const reopen = async (id: string) => {
    const res = await updateNotification({
      updateNotificationId: id,
      status: NotificationStatus.Unread,
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to reopen task.");
      return;
    }

    toast.success("Reopened task.");
    refetch({ requestPolicy: "network-only" });
  };

  const remove = async (id: string) => {
    const res = await deleteNotification({ deleteNotificationId: id });
    if (res.error) {
      console.error(res.error);
      toast.error("Failed to delete task.");
      return;
    }

    toast.success("Deleted.");
    refetch({ requestPolicy: "network-only" });
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
          onClick={() => refetch({ requestPolicy: "network-only" })}
          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
        >
          Refresh
        </button>
      </div>

      {!currentUserEmail ? (
        <div className="mt-3 text-xs text-gray-600">
          Login is required to view tasks.
        </div>
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
              placeholder="Assign to email (optional, defaults to me)"
              className="w-full border rounded-md px-3 py-2 text-xs"
            />
          ) : (
            <div className="text-[11px] text-gray-500">
              Only managers/admins can assign tasks to other employees.
            </div>
          )}

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Task description…"
            className="w-full border rounded-md px-3 py-2 text-xs min-h-[70px]"
          />

          <div className="flex gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as NotificationPriority)}
              className="border rounded-md px-2 py-2 text-xs bg-white"
            >
              <option value={NotificationPriority.Low}>Low</option>
              <option value={NotificationPriority.Normal}>Normal</option>
              <option value={NotificationPriority.High}>High</option>
            </select>

            <button
              type="submit"
              disabled={creating}
              className="flex-1 text-xs px-3 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-950 disabled:bg-gray-300"
            >
              {creating ? "Creating…" : "Create Task"}
            </button>
          </div>
        </form>
      ) : null}

      {/* List */}
      <div className="mt-4 space-y-3">
        <div className="text-xs text-gray-700 font-semibold">
          Open ({openTasks.length})
        </div>

        {fetching ? <div className="text-xs text-gray-500">Loading…</div> : null}

        {openTasks.length === 0 ? (
          <div className="text-xs text-gray-500">No open tasks.</div>
        ) : (
          openTasks.map((t) => (
            <div key={t.id} className="border rounded-lg p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 whitespace-pre-wrap">
                    {t.message}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Priority: {t.priority} • Created: {new Date(t.createdAt).toLocaleString()}
                  </p>
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

              <div className="mt-2 space-y-2">
                <input
                  value={completeNote[t.id] ?? ""}
                  onChange={(e) =>
                    setCompleteNote((s) => ({ ...s, [t.id]: e.target.value }))
                  }
                  placeholder="Completion note (optional)"
                  className="w-full border rounded-md px-2 py-2 text-xs"
                />

                <button
                  type="button"
                  onClick={() => markDone(t.id, t.message)}
                  disabled={updating}
                  className="w-full text-xs px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300"
                >
                  Mark Done
                </button>
              </div>
            </div>
          ))
        )}

        <div className="text-xs text-gray-700 font-semibold">
          Done ({doneTasks.length})
        </div>

        {doneTasks.length === 0 ? (
          <div className="text-xs text-gray-500">No completed tasks.</div>
        ) : (
          doneTasks.slice(0, 8).map((t) => (
            <div key={t.id} className="border rounded-lg p-3 bg-gray-50">
              <p className="text-xs text-gray-800 whitespace-pre-wrap">{t.message}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => reopen(t.id)}
                  disabled={updating}
                  className="text-[11px] px-2 py-1 rounded bg-white border hover:bg-gray-100 disabled:bg-gray-300"
                >
                  Reopen
                </button>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  disabled={deleting}
                  className="text-[11px] px-2 py-1 rounded bg-white border hover:bg-gray-100 disabled:bg-gray-300"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
