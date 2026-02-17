"use client";

import React, { useEffect, useState } from "react";
import type { HKStatus } from "@/lib/housekeepingTags";

export default function SetRoomStatusModal({
  open,
  onClose,
  initialStatus,
  initialReason,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initialStatus: HKStatus;
  initialReason: string | null;
  onSave: (status: HKStatus, reason: string | null) => void;
}) {
  const [status, setStatus] = useState<HKStatus>(initialStatus);
  const [reason, setReason] = useState(initialReason ?? "");

  useEffect(() => {
    if (!open) return;
    setStatus(initialStatus);
    setReason(initialReason ?? "");
  }, [open, initialStatus, initialReason]);

  if (!open) return null;

  const needsReason = status === "MAINTENANCE" || status === "OUT_OF_ORDER";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Set room status</p>
            <p className="text-xs text-gray-500">Housekeeping / Maintenance status</p>
          </div>

          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900">
            ✕
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as HKStatus)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="CLEAN">Vacant Clean</option>
              <option value="DIRTY">Vacant Dirty</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="OUT_OF_ORDER">Out of Order</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Reason {needsReason ? "(required)" : "(optional)"}
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={needsReason ? "e.g. AC broken" : "Optional"}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => onSave(status, needsReason ? (reason.trim() || null) : (reason.trim() || null))}
              className="text-sm px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
