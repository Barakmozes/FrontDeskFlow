// app/(dashboard)/dashboard/settings/SettingsClient.tsx
"use client";

import React from "react";
import SettingsControlCenter from "./SettingsControlCenter";

export default function SettingsClient({
  currentUserEmail,
  currentUserRole,
}: {
  currentUserEmail: string | null;
  currentUserRole: string | null;
}) {
  const canEdit = currentUserRole === "ADMIN" || currentUserRole === "MANAGER";

  return (
    <div className="py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">
          Control hotel pricing, policies, room overrides, property details, and operations hours — without schema changes.
        </p>
      </div>

      {!canEdit ? (
        <div className="rounded-xl border bg-white p-6">
          <div className="text-lg font-semibold text-slate-900">Access restricted</div>
          <p className="mt-2 text-sm text-slate-600">
            Only <b>ADMIN</b> or <b>MANAGER</b> can edit Settings.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Your role: <span className="font-semibold">{currentUserRole ?? "—"}</span>
          </p>
        </div>
      ) : (
        <SettingsControlCenter
          currentUserEmail={currentUserEmail}
          currentUserRole={currentUserRole}
        />
      )}
    </div>
  );
}
