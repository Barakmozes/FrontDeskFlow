"use client";

import { useMemo, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getCurrentUser } from "@/lib/session";
import {
  NotificationPriority,
  NotificationStatus,
  Role,
  useGetAreasNameDescriptionQuery,
  useGetNotificationsQuery,
  useGetTablesQuery,
  useGetUserNotificationsQuery,
  useGetUsersQuery,
  useUpdateNotificationMutation,
} from "@/graphql/generated";
import { decodeTaskMessage } from "@/lib/tasks/taskCodec";
import { useTasksUI } from "@/lib/tasks/tasksUIStore";
import { useHotelStore } from "@/lib/AreaStore";
import { CreateTaskModal, DeleteTaskModal, EditTaskModal } from "./TaskModals";

function formatWhen(dt: any) {
  try {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  } catch {
    return "-";
  }
}

function badgeClass(kind: "status" | "priority", value: string) {
  if (kind === "status") {
    return value === "OPEN" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
  }
  if (value === NotificationPriority.High) return "bg-red-100 text-red-800";
  if (value === NotificationPriority.Low) return "bg-gray-100 text-gray-800";
  return "bg-blue-100 text-blue-800";
}

export default function TasksPage() {
  const ui = useTasksUI();
  const selectedHotel = useHotelStore((s) => s.selectedHotel);

  const [myEmail, setMyEmail] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<Role | null>(null);

  // Load current user on client
  useEffect(() => {
    async function loadUser() {
      const user = await getCurrentUser();
      setMyEmail(user?.email ?? null);
      setMyName(user?.name ?? null);
         // Force cast safely
    const role = user?.role as Role | undefined;
    setMyRole(role ?? null);
    }
    loadUser();
  }, []);

  const canViewAll = myRole === Role.Admin || myRole === Role.Manager;
  const viewAll = canViewAll && ui.viewScope === "ALL";

  // Employees list
  const [{ data: usersData }] = useGetUsersQuery({ pause: !canViewAll });
  const assignees = usersData?.getUsers ?? [];

  // Hotels + Rooms
  const [{ data: hotelsData }] = useGetAreasNameDescriptionQuery();
  const hotels = hotelsData?.getAreasNameDescription ?? [];

  const [{ data: roomsData }] = useGetTablesQuery();
  const rooms = roomsData?.getTables ?? [];

  const hotelNameById = useMemo(() => {
    const map = new Map<string, string>();
    hotels.forEach((h) => map.set(h.id, h.name));
    return map;
  }, [hotels]);

  // Tasks query: ALL or MINE
  const [{ data: allNotifsData, fetching: fetchingAll }, reexecAll] = useGetNotificationsQuery({ pause: !viewAll });
  const [{ data: myNotifsData, fetching: fetchingMine }, reexecMine] = useGetUserNotificationsQuery({
    variables: myEmail ? { userEmail: myEmail } : ({} as any),
    pause: !myEmail || viewAll,
  });

  const notifications = (viewAll ? allNotifsData?.getNotifications : myNotifsData?.getUserNotifications) ?? [];
  const taskNotifications = notifications.filter((n) => n.type === "TASK");

  const tasks = useMemo(() => {
    return taskNotifications.map((n) => {
      const payload = decodeTaskMessage(n.message);
      return {
        id: n.id,
        userEmail: n.userEmail,
        userName: n.user?.name ?? null,
        status: n.status,
        priority: n.priority,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        payload,
        rawMessage: n.message,
      };
    });
  }, [taskNotifications]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (ui.statusFilter !== "ALL") {
        const isOpen = t.status === NotificationStatus.Unread;
        if (ui.statusFilter === "OPEN" && !isOpen) return false;
        if (ui.statusFilter === "DONE" && isOpen) return false;
      }
      if (ui.priorityFilter !== "ALL" && t.priority !== ui.priorityFilter) return false;
      return true;
    });
  }, [tasks, ui.statusFilter, ui.priorityFilter]);

  const selectedTask = useMemo(() => tasks.find((t) => t.id === ui.selectedTaskId) ?? null, [tasks, ui.selectedTaskId]);

  const [, updateNotification] = useUpdateNotificationMutation();

  function refresh() {
    if (viewAll) reexecAll({ requestPolicy: "network-only" });
    else reexecMine({ requestPolicy: "network-only" });
  }

  async function toggleDone(taskId: string, nextDone: boolean) {
    const nextStatus = nextDone ? NotificationStatus.Read : NotificationStatus.Unread;

    const res = await updateNotification({ updateNotificationId: taskId, status: nextStatus });
    if (res.error) {
      console.error(res.error);
      toast.error(res.error.message || "Failed to update task status");
      return;
    }
    refresh();
  }

  const openCount = tasks.filter((t) => t.status === NotificationStatus.Unread).length;
  const doneCount = tasks.filter((t) => t.status === NotificationStatus.Read).length;

  if (!myEmail) {
    return <div className="p-10 text-center text-gray-500">Loading user...</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tasks</h1>
          <div className="text-sm text-gray-600">
            Open: <span className="font-medium">{openCount}</span> · Done:{" "}
            <span className="font-medium">{doneCount}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canViewAll && (
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={ui.viewScope}
              onChange={(e) => ui.setViewScope(e.target.value as any)}
            >
              <option value="MINE">My tasks</option>
              <option value="ALL">All tasks</option>
            </select>
          )}

          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={ui.statusFilter}
            onChange={(e) => ui.setStatusFilter(e.target.value as any)}
          >
            <option value="OPEN">Open</option>
            <option value="DONE">Done</option>
            <option value="ALL">All</option>
          </select>

          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={ui.priorityFilter}
            onChange={(e) => ui.setPriorityFilter(e.target.value as any)}
          >
            <option value="ALL">All priorities</option>
            <option value={NotificationPriority.Low}>LOW</option>
            <option value={NotificationPriority.Normal}>NORMAL</option>
            <option value={NotificationPriority.High}>HIGH</option>
          </select>

          <button
            className="rounded-md bg-black px-3 py-2 text-sm text-white hover:opacity-90"
            onClick={() =>
              ui.openCreate({
                // Nice default: if the user selected a hotel in the layout store,
                // prefill the task with that hotel.
                hotelId: selectedHotel?.id,
              })
            }
          >
            + New Task
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Room</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Assigned</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(fetchingAll || fetchingMine) && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}

            {!fetchingAll && !fetchingMine && filteredTasks.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                  No tasks found.
                </td>
              </tr>
            )}

            {filteredTasks.map((t) => {
              const isOpen = t.status === NotificationStatus.Unread;
              const hotelName = t.payload.hotelId ? hotelNameById.get(t.payload.hotelId) : null;
              const roomLabel =
                t.payload.roomNumber != null
                  ? `Room ${t.payload.roomNumber}${hotelName ? ` · ${hotelName}` : ""}`
                  : hotelName
                  ? hotelName
                  : "-";

              return (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{t.payload.title}</td>
                  <td className="px-3 py-2">{t.payload.kind ?? "OTHER"}</td>
                  <td className="px-3 py-2">{roomLabel}</td>
                  <td className="px-3 py-2">{t.payload.dueAt ? formatWhen(t.payload.dueAt) : "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs ${badgeClass("priority", t.priority)}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs ${badgeClass(
                        "status",
                        isOpen ? "OPEN" : "DONE"
                      )}`}
                    >
                      {isOpen ? "OPEN" : "DONE"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{t.userName ? `${t.userName} (${t.userEmail})` : t.userEmail}</td>
                  <td className="px-3 py-2">{formatWhen(t.updatedAt)}</td>

                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => ui.openEdit(t.id)}
                      >
                        View / Edit
                      </button>

                      <button
                        className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => toggleDone(t.id, isOpen)}
                        title={isOpen ? "Mark done" : "Reopen"}
                      >
                        {isOpen ? "Done" : "Reopen"}
                      </button>

                      <button
                        className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                        onClick={() => ui.openDelete(t.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
{/* Modals */}
<CreateTaskModal
  open={ui.isCreateOpen}
  onClose={() => {
    ui.closeModals();
    ui.clearDraft();
  }}
  onCreated={refresh}
  currentUser={{ email: myEmail, name: myName, role: myRole }}
  assignees={canViewAll ? assignees : [{ email: myEmail, name: myName, role: myRole }]}
  hotels={hotels.map((h) => ({ id: h.id, name: h.name }))}
  rooms={rooms.map((r) => ({ id: r.id, areaId: r.areaId, tableNumber: r.tableNumber }))}
  defaultAssigneeEmail={myEmail}
  draft={ui.draft as any}
/>

{selectedTask && (
  <EditTaskModal
    open={ui.isEditOpen}
    onClose={ui.closeModals}
    onUpdated={refresh}
    currentUser={{ email: myEmail, name: myName, role: myRole }}
    canEditDetails={canViewAll}
    notificationId={selectedTask.id}
    assignedToEmail={selectedTask.userEmail}
    initialMessage={selectedTask.rawMessage}
    initialPriority={selectedTask.priority}
    initialStatus={selectedTask.status}
  />
)}


      {selectedTask && (
        <DeleteTaskModal
          open={ui.isDeleteOpen}
          onClose={ui.closeModals}
          onDeleted={refresh}
          notificationId={selectedTask.id}
        />
      )}
    </div>
  );
}
