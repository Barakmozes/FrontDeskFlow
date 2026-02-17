"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";

import { useUpdateManyTablesMutation } from "@/graphql/generated";
import { useHotelStore, type RoomInStore } from "@/lib/AreaStore";
import {
  applyHousekeepingPatch,
  daysSince,
  deriveRoomStatus,
  parseHousekeepingTags,
  type HKStatus,
} from "@/lib/housekeepingTags";

import SetRoomStatusModal from "./SetRoomStatusModal";

const pill = (cls: string, text: string) => (
  <span className={`text-[10px] px-2 py-1 rounded-full ${cls}`}>{text}</span>
);

export default function HousekeepingRoomCard({
  room,
  hotelName,
}: {
  room: RoomInStore;
  hotelName: string;
}) {
  const updateRoom = useHotelStore((s) => s.updateRoom);
  const [{ fetching }, updateManyTables] = useUpdateManyTablesMutation();

  const { hk, notes } = useMemo(() => parseHousekeepingTags(room.notes), [room.notes]);
  const derived = deriveRoomStatus(room.isOccupied, hk);

  const sinceDays = useMemo(() => daysSince(hk.lastCleanedAt), [hk.lastCleanedAt]);

  const [statusModalOpen, setStatusModalOpen] = useState(false);

  const commitSpecialRequests = async (nextSpecialRequests: string[]) => {
    const res = await updateManyTables({
      updates: [{ id: room.id, specialRequests: nextSpecialRequests }],
    });

    if (res.error) {
      console.error(res.error);
      toast.error("Failed to update room housekeeping state.");
      return;
    }

    const updated = res.data?.updateManyTables?.[0];
    if (!updated) {
      toast.error("Room updated, but no response returned.");
      return;
    }

    // Update local store to reflect server truth
    updateRoom(room.id, {
      notes: updated.specialRequests,
      isOccupied: updated.reserved,
      capacity: updated.diners,
      hotelId: updated.areaId,
      updatedAt: new Date().toISOString(),
    });

    toast.success("Room updated.");
  };

  const markClean = async () => {
    const next = applyHousekeepingPatch(room.notes, {
      status: "CLEAN",
      inCleaningList: false,
      lastCleanedAt: new Date().toISOString(),
      reason: null,
    });
    await commitSpecialRequests(next);
  };

  const markDirty = async () => {
    const next = applyHousekeepingPatch(room.notes, {
      status: "DIRTY",
      inCleaningList: true,
      // lastCleanedAt is NOT changed when becoming dirty
    });
    await commitSpecialRequests(next);
  };

  const toggleCleaningList = async () => {
    const next = applyHousekeepingPatch(room.notes, {
      inCleaningList: !hk.inCleaningList,
    });
    await commitSpecialRequests(next);
  };

  const statusColor = () => {
    switch (derived) {
      case "OCCUPIED":
        return "bg-red-100 text-red-800";
      case "VACANT_DIRTY":
        return "bg-amber-100 text-amber-800";
      case "VACANT_CLEAN":
        return "bg-emerald-100 text-emerald-800";
      case "MAINTENANCE":
        return "bg-slate-200 text-slate-800";
      case "OUT_OF_ORDER":
        return "bg-gray-200 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="border rounded-lg bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            Room {room.roomNumber}
          </p>
          <p className="text-xs text-gray-500 truncate">{hotelName}</p>

          <div className="mt-2 flex flex-wrap gap-2 items-center">
            {pill(statusColor(), derived.replaceAll("_", " "))}
            {hk.inCleaningList ? pill("bg-purple-100 text-purple-800", "In cleaning list") : null}
          </div>

          <div className="mt-2 text-xs text-gray-600 space-y-1">
            <div>
              <span className="text-gray-500">Last cleaned:</span>{" "}
              {hk.lastCleanedAt ? new Date(hk.lastCleanedAt).toLocaleString() : "Unknown"}
            </div>

            <div>
              <span className="text-gray-500">Days since cleaned:</span>{" "}
              {sinceDays === null ? "Unknown" : `${sinceDays} day(s)`}
              {room.isOccupied ? (
                <span className="ml-2 text-[10px] text-gray-500">(occupied rooms can still be added to list)</span>
              ) : null}
            </div>

            {hk.reason ? (
              <div>
                <span className="text-gray-500">Reason:</span> {hk.reason}
              </div>
            ) : null}
          </div>

          {notes.length ? (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-700">Notes</p>
              <ul className="mt-1 list-disc list-inside text-xs text-gray-600">
                {notes.slice(0, 3).map((n, i) => (
                  <li key={`${room.id}-note-${i}`}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setStatusModalOpen(true)}
          className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
        >
          Set Status
        </button>
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={markClean}
          disabled={fetching}
          className="text-xs px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300"
        >
          Mark Ready (Clean)
        </button>

        <button
          type="button"
          onClick={markDirty}
          disabled={fetching}
          className="text-xs px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:bg-gray-300"
        >
          Mark Dirty
        </button>

        <button
          type="button"
          onClick={toggleCleaningList}
          disabled={fetching}
          className="text-xs px-3 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-300"
          title="Works also for occupied rooms"
        >
          {hk.inCleaningList ? "Remove from list" : "Add to cleaning list"}
        </button>
      </div>

      {/* Modal */}
      <SetRoomStatusModal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        initialStatus={hk.status as HKStatus}
        initialReason={hk.reason}
        onSave={async (status, reason) => {
          setStatusModalOpen(false);

          const next = applyHousekeepingPatch(room.notes, {
            status,
            reason,
            // When room is set to MAINTENANCE/OOO, it usually shouldn't be in cleaning list.
            inCleaningList: status === "DIRTY" ? true : false,
            lastCleanedAt: status === "CLEAN" ? new Date().toISOString() : hk.lastCleanedAt,
          });

          await commitSpecialRequests(next);
        }}
      />
    </div>
  );
}
