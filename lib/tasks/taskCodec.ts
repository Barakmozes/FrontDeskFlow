// lib/tasks/taskCodec.ts
/**
 * We store hotel-task payload inside Notification.message
 * because the backend Notification model already exists and we don't want to migrate Prisma yet.
 *
 * Convention:
 *   Notification.type === "TASK"
 *   Notification.message === "TASK|<json>"
 *
 * This keeps compatibility with "plain text" notifications too.
 */

export type TaskKind =
  | "HOUSEKEEPING"
  | "MAINTENANCE"
  | "GUEST_REQUEST"
  | "FRONT_DESK"
  | "OTHER";

export const TASK_KINDS: TaskKind[] = [
  "HOUSEKEEPING",
  "MAINTENANCE",
  "GUEST_REQUEST",
  "FRONT_DESK",
  "OTHER",
];

export type TaskNote = {
  at: string; // ISO string
  by?: { email?: string | null; name?: string | null };
  text: string;
};

export type TaskPayloadV1 = {
  v: 1;

  title: string;
  description?: string;
  kind?: TaskKind;

  // Hotel context (Area/Table mapping)
  hotelId?: string; // Area.id
  roomId?: string; // Table.id
  roomNumber?: number; // Table.tableNumber

  // Optional link
  reservationId?: string;

  // Optional due datetime
  dueAt?: string; // ISO string

  createdBy?: { email?: string | null; name?: string | null };
  notes?: TaskNote[];
};

export type TaskDraft = Partial<Omit<TaskPayloadV1, "v">> & { v?: 1 };

const PREFIX = "TASK|";

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function encodeTaskMessage(payload: TaskPayloadV1): string {
  return PREFIX + JSON.stringify(payload);
}

export function decodeTaskMessage(message: string): TaskPayloadV1 {
  const fallbackTitle = (message ?? "").trim() || "Untitled task";

  const raw = message?.startsWith(PREFIX) ? message.slice(PREFIX.length) : message;
  const parsed = raw ? safeJsonParse(raw) : null;

  if (!parsed || typeof parsed !== "object") {
    // Backward-compatible: treat plain text as title
    return { v: 1, title: fallbackTitle };
  }

  const obj = parsed as Record<string, unknown>;
  const title = (asString(obj.title)?.trim() || fallbackTitle).slice(0, 140);

  const kindRaw = asString(obj.kind);
  const kind = kindRaw && (TASK_KINDS as string[]).includes(kindRaw) ? (kindRaw as TaskKind) : undefined;

  const notesRaw = Array.isArray(obj.notes) ? obj.notes : undefined;
  const notes: TaskNote[] | undefined = notesRaw
    ? notesRaw
        .map((n) => {
          if (!n || typeof n !== "object") return null;
          const nn = n as Record<string, unknown>;
          const text = asString(nn.text)?.trim();
          const at = asString(nn.at);
          if (!text || !at) return null;
          const byObj = nn.by && typeof nn.by === "object" ? (nn.by as Record<string, unknown>) : undefined;
          return {
            at,
            text,
            by: byObj
              ? { email: asString(byObj.email) ?? null, name: asString(byObj.name) ?? null }
              : undefined,
          } satisfies TaskNote;
        })
        .filter(Boolean) as TaskNote[]
    : undefined;

  return {
    v: 1,
    title,
    description: asString(obj.description),
    kind,
    hotelId: asString(obj.hotelId),
    roomId: asString(obj.roomId),
    roomNumber: asNumber(obj.roomNumber),
    reservationId: asString(obj.reservationId),
    dueAt: asString(obj.dueAt),
    createdBy:
      obj.createdBy && typeof obj.createdBy === "object"
        ? {
            email: asString((obj.createdBy as any).email) ?? null,
            name: asString((obj.createdBy as any).name) ?? null,
          }
        : undefined,
    notes,
  };
}
