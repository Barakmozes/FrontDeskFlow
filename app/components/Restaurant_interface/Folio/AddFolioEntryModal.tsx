"use client";

import React, { useEffect, useState } from "react";
import type { FolioKind, PaymentMethod } from "@/lib/folioEncoding";

export default function AddFolioEntryModal({
  open,
  kind,
  onClose,
  onSave,
}: {
  open: boolean;
  kind: FolioKind; // "CHARGE" | "PAYMENT"
  onClose: () => void;
  onSave: (data: {
    amount: number;
    description: string;
    method?: PaymentMethod;
    reference?: string | null;
  }) => void;
}) {
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setAmount(0);
    setDescription("");
    setMethod("CASH");
    setReference("");
  }, [open]);

  if (!open) return null;

  const title = kind === "CHARGE" ? "Add Charge" : "Record Payment";

  const validateAndSave = () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return alert("Amount must be a positive number.");
    if (!description.trim()) return alert("Description is required.");

    onSave({
      amount: amt,
      description: description.trim(),
      method: kind === "PAYMENT" ? method : undefined,
      reference: kind === "PAYMENT" ? (reference.trim() || null) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500">
              Stored as a Notification (type = FOLIO) until we add real Billing models.
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              placeholder="e.g. 150"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
              placeholder={kind === "CHARGE" ? "e.g. Mini-bar" : "e.g. Cash payment"}
            />
          </div>

          {kind === "PAYMENT" ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="BANK">Bank transfer</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Reference (optional)
                </label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="e.g. last 4 digits / transaction id"
                />
              </div>
            </>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="text-sm px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200"
            >
              Cancel
            </button>

            <button
              onClick={validateAndSave}
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
