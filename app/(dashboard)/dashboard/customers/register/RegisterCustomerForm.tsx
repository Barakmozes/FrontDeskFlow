"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { usePathname, useSearchParams } from "next/navigation";

import {
  CUSTOMER_SOURCES,
  CUSTOMER_SOURCE_LABEL,
  normalizePhone,
  type CustomerSource,
} from "@/lib/customerTracking";

type FormState = {
  name: string;
  email: string;
  phone: string;
  source: CustomerSource;

  smsOperational: boolean;
  emailOperational: boolean;
  marketing: boolean;

  // for now: Reception capturing consent verbally
  consentMethod: "VERBAL" | "WRITTEN" | "DIGITAL";
};

const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export default function RegisterCustomerForm() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [state, setState] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    source: "WALK_IN",

    smsOperational: false,
    emailOperational: true, // typically OK for operational messages
    marketing: false,

    consentMethod: "VERBAL",
  });

  const [submitting, setSubmitting] = useState(false);

  const utm = useMemo(() => {
    // Optional tracking if you ever link to this page with UTM parameters
    return {
      utmSource: searchParams?.get("utm_source"),
      utmMedium: searchParams?.get("utm_medium"),
      utmCampaign: searchParams?.get("utm_campaign"),
      utmTerm: searchParams?.get("utm_term"),
      utmContent: searchParams?.get("utm_content"),
    };
  }, [searchParams]);

  const onChange = (patch: Partial<FormState>) => setState((s) => ({ ...s, ...patch }));

  const validateClient = (): string | null => {
    if (!state.name.trim()) return "Name is required";
    if (!state.email.trim() || !isValidEmail(state.email)) return "Valid email is required";

    if (state.smsOperational) {
      const phone = normalizePhone(state.phone);
      if (!phone) return "Phone is required for SMS consent";
    }

    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const err = validateClient();
    if (err) {
      toast.error(err);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: state.name.trim(),
        email: state.email.trim().toLowerCase(),
        phone: state.phone ? normalizePhone(state.phone) : null,
        source: state.source,

        consent: {
          smsOperational: state.smsOperational,
          emailOperational: state.emailOperational,
          marketing: state.marketing,
          method: state.consentMethod,
        },

        context: {
          page: pathname,
          referrer: typeof document !== "undefined" ? document.referrer || null : null,
          locale: typeof navigator !== "undefined" ? navigator.language || null : null,
          timezone:
            typeof Intl !== "undefined"
              ? Intl.DateTimeFormat().resolvedOptions().timeZone || null
              : null,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent || null : null,
          utm,
        },
      };

      const res = await fetch("/api/customers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        toast.error(json?.error ?? "Failed to register customer");
        return;
      }

      toast.success(
        json.created?.user
          ? "Customer created successfully"
          : "Customer updated successfully"
      );

      // Keep source/consents, clear personal data for quick next entry
      setState((s) => ({
        ...s,
        name: "",
        email: "",
        phone: "",
      }));
    } catch {
      toast.error("Failed to register customer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Full name</label>
          <input
            value={state.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="John Doe"
            autoComplete="name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            value={state.email}
            onChange={(e) => onChange({ email: e.target.value })}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="guest@email.com"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Phone (for SMS)</label>
          <input
            value={state.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="+9725..."
            autoComplete="tel"
          />
          <p className="text-xs text-gray-500 mt-1">
            If SMS consent is enabled, phone is required.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Booking source</label>
          <select
            value={state.source}
            onChange={(e) => onChange({ source: e.target.value as CustomerSource })}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            {CUSTOMER_SOURCES.map((s) => (
              <option key={s} value={s}>
                {CUSTOMER_SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Consent (captured at Reception)</p>
            <p className="text-xs text-gray-500">
              Store only consent decisions + source for reporting.
            </p>
          </div>

          <select
            value={state.consentMethod}
            onChange={(e) => onChange({ consentMethod: e.target.value as any })}
            className="border rounded-lg px-2 py-1 text-sm bg-white"
            title="How consent was captured"
          >
            <option value="VERBAL">Verbal</option>
            <option value="WRITTEN">Written</option>
            <option value="DIGITAL">Digital</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={state.smsOperational}
            onChange={(e) => onChange({ smsOperational: e.target.checked })}
          />
          Operational SMS (pre‑arrival / check‑in instructions)
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={state.emailOperational}
            onChange={(e) => onChange({ emailOperational: e.target.checked })}
          />
          Operational Email (confirmation / invoices)
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={state.marketing}
            onChange={(e) => onChange({ marketing: e.target.checked })}
          />
          Marketing messages (optional)
        </label>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={submitting}
          className={`px-4 py-2 rounded-lg text-sm font-medium shadow transition ${
            submitting
              ? "bg-gray-300 text-gray-700 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {submitting ? "Saving…" : "Create / Update Customer"}
        </button>
      </div>
    </form>
  );
}
