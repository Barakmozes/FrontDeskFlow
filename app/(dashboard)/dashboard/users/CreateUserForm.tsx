"use client";

import { useMemo, useState } from "react";
import type { Role } from "@prisma/client";

type Props = {
  onSuccess: () => void;
  onCancel: () => void;
};

const ROLES: Role[] = ["USER", "ADMIN", "DELIVERY", "WAITER", "CHEF", "MANAGER"];

export default function CreateUserForm({ onSuccess, onCancel }: Props) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState(""); // stored into User.email
  const [role, setRole] = useState<Role>("USER");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      username.trim().length >= 2 &&
      password.length >= 4 &&
      confirmPassword.length >= 4 &&
      password === confirmPassword &&
      !loading
    );
  }, [username, password, confirmPassword, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          username: username.trim(),
          role,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Failed to create user.");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error while creating user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label className="form-label">Name</label>
        <input
          className="formInput border border-green-200"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Employee name"
        />
      </div>

      <div>
      {/* Username (stored in User.email) */}
        <label className="form-label ">Username or email</label>
        <input
          className="formInput border border-green-200"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
      
      </div>

      <div>
        <label className="form-label">Role</label>
        <select
          className="block w-full rounded-md appearance-none bg-white border border-green-400 px-4 py-2 pr-8 leading-tight focus:outline-none"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="form-label">Password</label>
        <input
          className="formInput border border-green-200"
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 4 characters"
        />
      </div>

      <div>
        <label className="form-label">Confirm Password</label>
        <input
          className="formInput border border-green-200"
          value={confirmPassword}
          type="password"
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          disabled={loading}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="form-button"
          disabled={!canSubmit}
        >
          {loading ? "Creating..." : "Create User"}
        </button>
      </div>
    </form>
  );
}
