"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import type { UserRow } from "./types";

type Props = {
  user: UserRow;
  onClose: () => void;
  onUpdated: () => void;
};

const ROLES: Role[] = ["USER", "ADMIN", "DELIVERY", "WAITER", "CHEF", "MANAGER"];

export default function EditRoleForm({ user, onClose, onUpdated }: Props) {
  const [role, setRole] = useState<Role>(user.role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveRole() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to update role.");
        return;
      }

      onUpdated();
      onClose();
    } catch {
      setError("Network error while updating role.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="my-6 space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="form-label">Username</label>
        <input
          type="text"
          className="formInput"
          value={user.email ?? ""}
          disabled
        />
      </div>

      <div>
        <label className="form-label">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="block w-full rounded-md appearance-none bg-white border border-green-400 px-4 py-2 pr-8 leading-tight focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          className="rounded-md border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </button>

        <button
          type="button"
          className="form-button"
          onClick={saveRole}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Role"}
        </button>
      </div>
    </div>
  );
}
