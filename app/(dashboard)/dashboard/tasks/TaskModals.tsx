"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  NotificationPriority,
  NotificationStatus,
  Role,
  useAddNotificationMutation,
  useDeleteNotificationMutation,
  useUpdateNotificationMutation,
} from "@/graphql/generated";
import { encodeTaskMessage, TaskKind, TASK_KINDS, TaskPayloadV1 } from "@/lib/tasks/taskCodec";

type BasicUser = { email?: string | null; name?: string | null; role?: Role | null };
type BasicHotel = { id: string; name: string };
type BasicRoom = { id: string; areaId: string; tableNumber: number };

function ModalShell(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <button
            onClick={props.onClose}
            className="rounded-md px-2 py-1 text-sm hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4">{props.children}</div>
      </div>
    </div>
  );
}

function toDatetimeLocalValue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // datetime-local expects "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export function CreateTaskModal(props: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;

  currentUser?: BasicUser | null;
  assignees: BasicUser[]; // from GetUsers
  hotels: BasicHotel[];
  rooms: BasicRoom[];

  defaultAssigneeEmail?: string | null;
  draft?: Partial<TaskPayloadV1> | null;
}) {
  const [, addTask] = useAddNotificationMutation();

  const [assigneeEmail, setAssigneeEmail] = useState(props.defaultAssigneeEmail ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<TaskKind>("FRONT_DESK");
  const [priority, setPriority] = useState<NotificationPriority>(NotificationPriority.Normal);

  const [hotelId, setHotelId] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [dueAtLocal, setDueAtLocal] = useState<string>("");

  const roomsForHotel = useMemo(() => {
    if (!hotelId) return [];
    return props.rooms.filter((r) => r.areaId === hotelId);
  }, [hotelId, props.rooms]);

  // Prefill when opened (important if we open "Create task" from a room card later)
  useEffect(() => {
    if (!props.open) return;

    setAssigneeEmail(props.defaultAssigneeEmail ?? "");
    setTitle(props.draft?.title ?? "");
    setDescription(props.draft?.description ?? "");
    setKind((props.draft?.kind as TaskKind) ?? "FRONT_DESK");

    setHotelId(props.draft?.hotelId ?? "");
    setRoomId(props.draft?.roomId ?? "");
    setDueAtLocal(toDatetimeLocalValue(props.draft?.dueAt));
  }, [props.open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit() {
    const cleanTitle = title.trim();
    if (!assigneeEmail.trim()) return toast.error("Please select an assignee");
    if (!cleanTitle) return toast.error("Please enter a title");

    const selectedRoom = roomId ? props.rooms.find((r) => r.id === roomId) : undefined;

    const payload: TaskPayloadV1 = {
      v: 1,
      title: cleanTitle,
      description: description.trim() || undefined,
      kind,
      hotelId: hotelId || undefined,
      roomId: roomId || undefined,
      roomNumber: selectedRoom?.tableNumber,
      dueAt: dueAtLocal ? new Date(dueAtLocal).toISOString() : undefined,
      createdBy: {
        email: props.currentUser?.email ?? null,
        name: props.currentUser?.name ?? null,
      },
      notes: [],
    };

    const message = encodeTaskMessage(payload);

    const result = await addTask({
      message,
      type: "TASK",
      userEmail: assigneeEmail.trim(),
      priority,
      status: NotificationStatus.Unread, // OPEN
    });

    if (result.error) {
      console.error(result.error);
      toast.error(result.error.message || "Failed to create task");
      return;
    }

    toast.success("Task created");
    props.onCreated();
    props.onClose();
  }

  return (
    <ModalShell open={props.open} title="Create Task" onClose={props.onClose}>
      <div className="grid gap-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium">Assignee</label>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={assigneeEmail}
            onChange={(e) => setAssigneeEmail(e.target.value)}
          >
            <option value="">Select employee…</option>
            {props.assignees
              .filter((u) => !!u.email)
              .map((u) => (
                <option key={u.email!} value={u.email!}>
                  {u.name ? `${u.name} (${u.email})` : u.email}
                </option>
              ))}
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Title</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Replace towels in 204"
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="w-full rounded-md border px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional details…"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Kind</label>
            <select className="w-full rounded-md border px-3 py-2" value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
              {TASK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Priority</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value as NotificationPriority)}
            >
              <option value={NotificationPriority.Low}>LOW</option>
              <option value={NotificationPriority.Normal}>NORMAL</option>
              <option value={NotificationPriority.High}>HIGH</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Due</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              type="datetime-local"
              value={dueAtLocal}
              onChange={(e) => setDueAtLocal(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Hotel (Area)</label>
            <select className="w-full rounded-md border px-3 py-2" value={hotelId} onChange={(e) => {
              setHotelId(e.target.value);
              setRoomId(""); // reset room when hotel changes
            }}>
              <option value="">No hotel</option>
              {props.hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Room (Table)</label>
            <select className="w-full rounded-md border px-3 py-2" value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={!hotelId}>
              <option value="">{hotelId ? "Select room…" : "Select hotel first"}</option>
              {roomsForHotel.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.tableNumber}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button onClick={props.onClose} className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onSubmit} className="rounded-md bg-black px-3 py-2 text-sm text-white hover:opacity-90">
            Create
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function EditTaskModal(props: {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;

  currentUser?: BasicUser | null;
  canEditDetails: boolean;

  notificationId: string;
  assignedToEmail: string;

  initialMessage: string;
  initialPriority: NotificationPriority;
  initialStatus: NotificationStatus;
}) {
  const [, updateTask] = useUpdateNotificationMutation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<TaskKind>("FRONT_DESK");
  const [dueAtLocal, setDueAtLocal] = useState("");

  const [priority, setPriority] = useState<NotificationPriority>(props.initialPriority);
  const [status, setStatus] = useState<NotificationStatus>(props.initialStatus);

  const [newNote, setNewNote] = useState("");

  // decode only when open
  useEffect(() => {
    if (!props.open) return;
    const decoded = (() => {
      // Keep decode logic centralized
      try {
        const { decodeTaskMessage } = require("@/lib/tasks/taskCodec");
        return decodeTaskMessage(props.initialMessage) as TaskPayloadV1;
      } catch {
        return { v: 1, title: props.initialMessage || "Untitled task" } as TaskPayloadV1;
      }
    })();

    setTitle(decoded.title ?? "");
    setDescription(decoded.description ?? "");
    setKind((decoded.kind as TaskKind) ?? "FRONT_DESK");
    setDueAtLocal(toDatetimeLocalValue(decoded.dueAt));

    setPriority(props.initialPriority);
    setStatus(props.initialStatus);
    setNewNote("");
  }, [props.open, props.initialMessage, props.initialPriority, props.initialStatus]);

  async function onSave() {
    const cleanTitle = title.trim() || "Untitled task";
    const dueAtIso = dueAtLocal ? new Date(dueAtLocal).toISOString() : undefined;

    // Rebuild payload (we only store what we need; keep it small and stable)
    const payload: TaskPayloadV1 = {
      v: 1,
      title: cleanTitle,
      description: description.trim() || undefined,
      kind,
      dueAt: dueAtIso,
    };

    // Optional: append note (employee completion notes)
    if (newNote.trim()) {
      payload.notes = [
        {
          at: new Date().toISOString(),
          text: newNote.trim(),
          by: { email: props.currentUser?.email ?? null, name: props.currentUser?.name ?? null },
        },
      ];
    }

    const message = encodeTaskMessage(payload);

    const result = await updateTask({
      updateNotificationId: props.notificationId,
      message,
      priority,
      status,
    });

    if (result.error) {
      console.error(result.error);
      toast.error(result.error.message || "Failed to update task");
      return;
    }

    toast.success("Task updated");
    props.onUpdated();
    props.onClose();
  }

  return (
    <ModalShell open={props.open} title="Edit Task" onClose={props.onClose}>
      <div className="grid gap-3">
        <div className="text-sm text-gray-600">
          Assigned to: <span className="font-medium">{props.assignedToEmail}</span>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Title</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!props.canEditDetails}
          />
          {!props.canEditDetails && (
            <div className="text-xs text-gray-500">Only managers/admins can edit task details. You can still add notes and mark done.</div>
          )}
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            className="w-full rounded-md border px-3 py-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={!props.canEditDetails}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Kind</label>
            <select className="w-full rounded-md border px-3 py-2" value={kind} onChange={(e) => setKind(e.target.value as TaskKind)} disabled={!props.canEditDetails}>
              {TASK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Priority</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value as NotificationPriority)}
            >
              <option value={NotificationPriority.Low}>LOW</option>
              <option value={NotificationPriority.Normal}>NORMAL</option>
              <option value={NotificationPriority.High}>HIGH</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Status</label>
            <select className="w-full rounded-md border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as NotificationStatus)}>
              <option value={NotificationStatus.Unread}>OPEN</option>
              <option value={NotificationStatus.Read}>DONE</option>
            </select>
          </div>
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Due</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="datetime-local"
            value={dueAtLocal}
            onChange={(e) => setDueAtLocal(e.target.value)}
            disabled={!props.canEditDetails}
          />
        </div>

        <div className="grid gap-1">
          <label className="text-sm font-medium">Add note (completion / update)</label>
          <textarea
            className="w-full rounded-md border px-3 py-2"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
            placeholder="e.g. Completed, guest satisfied. Left extra towels."
          />
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button onClick={props.onClose} className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onSave} className="rounded-md bg-black px-3 py-2 text-sm text-white hover:opacity-90">
            Save
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function DeleteTaskModal(props: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  notificationId: string;
}) {
  const [, deleteTask] = useDeleteNotificationMutation();

  async function onConfirm() {
    const result = await deleteTask({ deleteNotificationId: props.notificationId });
    if (result.error) {
      console.error(result.error);
      toast.error(result.error.message || "Failed to delete task");
      return;
    }
    toast.success("Task deleted");
    props.onDeleted();
    props.onClose();
  }

  return (
    <ModalShell open={props.open} title="Delete Task" onClose={props.onClose}>
      <p className="text-sm text-gray-700">This will permanently delete the task.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={props.onClose} className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={onConfirm} className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:opacity-90">
          Delete
        </button>
      </div>
    </ModalShell>
  );
}
