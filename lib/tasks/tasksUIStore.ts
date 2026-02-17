// lib/tasks/tasksUIStore.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { NotificationPriority } from "@/graphql/generated";
import type { TaskDraft } from "./taskCodec";

/**
 * Global UI state so Tasks can be opened from anywhere later:
 * - Room card → "Create task for this room"
 * - Reservation card → "Create guest request task"
 */
export type TaskStatusFilter = "OPEN" | "DONE" | "ALL";
export type TaskViewScope = "MINE" | "ALL";

type TasksUIStore = {
  // Filters
  statusFilter: TaskStatusFilter;
  priorityFilter: "ALL" | NotificationPriority;
  viewScope: TaskViewScope;

  setStatusFilter: (v: TaskStatusFilter) => void;
  setPriorityFilter: (v: "ALL" | NotificationPriority) => void;
  setViewScope: (v: TaskViewScope) => void;

  // Modals
  isCreateOpen: boolean;
  isEditOpen: boolean;
  isDeleteOpen: boolean;
  selectedTaskId: string | null;

  // Optional prefill for Create modal (e.g. open from a room card)
  draft: TaskDraft | null;

  openCreate: (draft?: TaskDraft) => void;
  openEdit: (taskId: string) => void;
  openDelete: (taskId: string) => void;
  closeModals: () => void;
  clearDraft: () => void;
};

export const useTasksUI = create<TasksUIStore>()(
  devtools((set) => ({
    statusFilter: "OPEN",
    priorityFilter: "ALL",
    viewScope: "MINE",

    setStatusFilter: (v) => set({ statusFilter: v }),
    setPriorityFilter: (v) => set({ priorityFilter: v }),
    setViewScope: (v) => set({ viewScope: v }),

    isCreateOpen: false,
    isEditOpen: false,
    isDeleteOpen: false,
    selectedTaskId: null,
    draft: null,

    openCreate: (draft) =>
      set({
        isCreateOpen: true,
        isEditOpen: false,
        isDeleteOpen: false,
        selectedTaskId: null,
        draft: draft ?? null,
      }),

    openEdit: (taskId) =>
      set({
        isCreateOpen: false,
        isEditOpen: true,
        isDeleteOpen: false,
        selectedTaskId: taskId,
      }),

    openDelete: (taskId) =>
      set({
        isCreateOpen: false,
        isEditOpen: false,
        isDeleteOpen: true,
        selectedTaskId: taskId,
      }),

    closeModals: () =>
      set({
        isCreateOpen: false,
        isEditOpen: false,
        isDeleteOpen: false,
        selectedTaskId: null,
      }),

    clearDraft: () => set({ draft: null }),
  }))
);
