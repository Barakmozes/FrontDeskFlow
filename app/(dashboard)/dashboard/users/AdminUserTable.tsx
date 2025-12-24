"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import TableWrapper from "../Components/TableWrapper";
import EditRoleModal from "./EditRoleModal";
import CreateUserModal from "./CreateUserModal";
import { UserRow } from "./types";
import { useSearchParams } from "next/navigation";
const FALLBACK_AVATAR = "/img/avatar.png"; // adjust to an existing static asset

const AdminUserTable = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);





  const searchParams = useSearchParams();
const q = (searchParams.get("q") ?? "").trim().toLowerCase();

 const sortedUsers = useMemo(() => {
  if (!q) return users;

  return users.filter((u) => {
    const hay = `${u.name ?? ""} ${u.email ?? ""} ${u.role ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}, [users, q]);

  async function fetchUsers() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Failed to load users.");
        setUsers([]);
        return;
      }

      setUsers((data.users ?? []).map((u: any) => ({
        ...u,
        createdAt: String(u.createdAt),
      })));
    } catch {
      setError("Network error while loading users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <TableWrapper title="All Users">
      <div className="flex items-center justify-between pb-4">
        <div className="text-sm text-slate-500">
          {loading ? "Loading users..." : `${sortedUsers.length} users`}
        </div>

        <CreateUserModal onCreated={fetchUsers} />
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border text-left text-slate-500">
          <thead className="text-xs overflow-x-auto whitespace-nowrap text-slate-700 uppercase bg-slate-100">
            <tr>
              <th scope="col" className="px-6 py-3">Avatar</th>
              <th scope="col" className="px-6 py-3">Name</th>
              <th scope="col" className="px-6 py-3">Username</th>
              <th scope="col" className="px-6 py-3">Role</th>
              <th scope="col" className="px-6 py-3">Edit</th>
            </tr>
          </thead>

          <tbody>
            {!loading && sortedUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-sm text-slate-400">
                  No users found.
                </td>
              </tr>
            )}

            {sortedUsers.map((user) => (
              <tr className="bg-white border-t" key={user.id}>
                <td className="px-6 py-2">
                  <Image
                    src={user.image || FALLBACK_AVATAR}
                    width={50}
                    height={50}
                    alt="avatar"
                    className="rounded-full object-cover"
                  />
                </td>

                <td className="px-6 py-2">{user.name || "-"}</td>

                <td className="px-6 py-2">{user.email || "-"}</td>

                <td className="px-6 py-2">{user.role}</td>

                <td className="px-6 py-2 whitespace-nowrap">
                  <EditRoleModal user={user} onUpdated={fetchUsers} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableWrapper>
  );
};

export default AdminUserTable;
