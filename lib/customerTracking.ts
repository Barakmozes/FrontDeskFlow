/**
 * Customer registration tracking is encoded into Notification.message.
 * We DO NOT change Prisma schema now.
 *
 * Why Notification.message?
 * - You already have Notifications in the dashboard.
 * - It is append-only (works like an audit log).
 * - Later, Reports can parse these tags to measure:
 *   - source breakdown (Walk-in / Phone / Website / OTA / Agent / Employee)
 *   - consent rates (SMS / Email / Marketing)
 *
 * Encoding format (similar to housekeeping tags):
 * - Optional human summary line (does NOT start with PREFIX)
 * - Then multiple `PREFIX + KEY=VALUE` lines
 * - VALUE is encoded with encodeURIComponent(...)
 */

export const CUSTOMER_SOURCES = [
  "WALK_IN",
  "PHONE",
  "WEBSITE",
  "OTA",
  "AGENT",
  "EMPLOYEE",
] as const;

export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];

export const CUSTOMER_SOURCE_LABEL: Record<CustomerSource, string> = {
  WALK_IN: "Walk-in",
  PHONE: "Phone",
  WEBSITE: "Website",
  OTA: "OTA",
  AGENT: "Agent",
  EMPLOYEE: "Employee",
};

export type ConsentMethod = "VERBAL" | "WRITTEN" | "DIGITAL";

export type CustomerConsent = {
  smsOperational: boolean;
  emailOperational: boolean;
  marketing: boolean;
  method: ConsentMethod;
  capturedAt: string; // ISO
};

export type CustomerUtm = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
};

export type CustomerRegistrationContext = {
  page: string | null; // e.g. "/dashboard/customers/register"
  referrer: string | null;
  locale: string | null; // e.g. "en-US"
  timezone: string | null; // e.g. "Asia/Jerusalem"
  userAgent: string | null;
  utm?: CustomerUtm;
};

export type CustomerRegistrationTracking = {
  version: 1;
  event: "CUSTOMER_REGISTERED";
  source: CustomerSource;

  actorEmail: string; // staff user performing action
  actorRole: string; // current Role enum value

  customerEmail: string;
  customerName: string | null;
  phone: string | null;

  consent: CustomerConsent;
  context: CustomerRegistrationContext;
};

const PREFIX = "CUST:";
const VERSION_KEY = `${PREFIX}V=`;
const EVENT_KEY = `${PREFIX}EVENT=`;
const SOURCE_KEY = `${PREFIX}SOURCE=`;
const ACTOR_EMAIL_KEY = `${PREFIX}ACTOR_EMAIL=`;
const ACTOR_ROLE_KEY = `${PREFIX}ACTOR_ROLE=`;
const CUSTOMER_EMAIL_KEY = `${PREFIX}CUSTOMER_EMAIL=`;
const CUSTOMER_NAME_KEY = `${PREFIX}CUSTOMER_NAME=`;
const PHONE_KEY = `${PREFIX}PHONE=`;

const CONSENT_SMS_KEY = `${PREFIX}CONSENT_SMS_OP=`;
const CONSENT_EMAIL_KEY = `${PREFIX}CONSENT_EMAIL_OP=`;
const CONSENT_MKT_KEY = `${PREFIX}CONSENT_MARKETING=`;
const CONSENT_METHOD_KEY = `${PREFIX}CONSENT_METHOD=`;
const CONSENT_AT_KEY = `${PREFIX}CONSENT_AT=`;

const CTX_PAGE_KEY = `${PREFIX}CTX_PAGE=`;
const CTX_REF_KEY = `${PREFIX}CTX_REFERRER=`;
const CTX_LOCALE_KEY = `${PREFIX}CTX_LOCALE=`;
const CTX_TZ_KEY = `${PREFIX}CTX_TZ=`;
const CTX_UA_KEY = `${PREFIX}CTX_UA=`;

const UTM_SOURCE_KEY = `${PREFIX}UTM_SOURCE=`;
const UTM_MEDIUM_KEY = `${PREFIX}UTM_MEDIUM=`;
const UTM_CAMPAIGN_KEY = `${PREFIX}UTM_CAMPAIGN=`;
const UTM_TERM_KEY = `${PREFIX}UTM_TERM=`;
const UTM_CONTENT_KEY = `${PREFIX}UTM_CONTENT=`;

const isTrue = (v: string) => ["true", "1", "yes", "y"].includes(v.trim().toLowerCase());

/**
 * Phone normalization:
 * - trims
 * - removes spaces / dashes / parentheses
 * - preserves a single leading "+" if present
 *
 * NOTE: We keep it intentionally light to avoid country-specific rules for now.
 */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();

  // Keep digits and '+' only
  let out = trimmed.replace(/[^\d+]/g, "");

  // Only allow "+" at the beginning
  if (out.includes("+")) {
    out = out.startsWith("+")
      ? "+" + out.slice(1).replace(/\+/g, "")
      : out.replace(/\+/g, "");
  }

  return out;
}

export function isProbablyValidPhone(normalized: string): boolean {
  const digits = normalized.replace(/[^\d]/g, "");
  // simple sanity: 7-15 digits (E.164 max is 15)
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Encode tracking to a Notification.message payload.
 */
export function encodeCustomerRegistrationTracking(
  tracking: CustomerRegistrationTracking,
  opts?: { summary?: string }
): string {
  const lines: string[] = [];

  // Optional human-readable summary line (shown nicely in Notifications UI)
  if (opts?.summary?.trim()) lines.push(opts.summary.trim());

  // Version first (forward compatibility)
  lines.push(`${VERSION_KEY}1`);

  // Core
  lines.push(`${EVENT_KEY}${tracking.event}`);
  lines.push(`${SOURCE_KEY}${tracking.source}`);

  // Actor
  lines.push(`${ACTOR_EMAIL_KEY}${encodeURIComponent(tracking.actorEmail)}`);
  lines.push(`${ACTOR_ROLE_KEY}${encodeURIComponent(tracking.actorRole)}`);

  // Customer identity
  lines.push(`${CUSTOMER_EMAIL_KEY}${encodeURIComponent(tracking.customerEmail)}`);
  if (tracking.customerName) {
    lines.push(`${CUSTOMER_NAME_KEY}${encodeURIComponent(tracking.customerName)}`);
  }
  if (tracking.phone) {
    lines.push(`${PHONE_KEY}${encodeURIComponent(tracking.phone)}`);
  }

  // Consent
  lines.push(`${CONSENT_SMS_KEY}${tracking.consent.smsOperational ? "true" : "false"}`);
  lines.push(`${CONSENT_EMAIL_KEY}${tracking.consent.emailOperational ? "true" : "false"}`);
  lines.push(`${CONSENT_MKT_KEY}${tracking.consent.marketing ? "true" : "false"}`);
  lines.push(`${CONSENT_METHOD_KEY}${tracking.consent.method}`);
  lines.push(`${CONSENT_AT_KEY}${tracking.consent.capturedAt}`);

  // Context (safe strings, URI encoded)
  if (tracking.context.page) lines.push(`${CTX_PAGE_KEY}${encodeURIComponent(tracking.context.page)}`);
  if (tracking.context.referrer)
    lines.push(`${CTX_REF_KEY}${encodeURIComponent(tracking.context.referrer)}`);
  if (tracking.context.locale) lines.push(`${CTX_LOCALE_KEY}${encodeURIComponent(tracking.context.locale)}`);
  if (tracking.context.timezone) lines.push(`${CTX_TZ_KEY}${encodeURIComponent(tracking.context.timezone)}`);
  if (tracking.context.userAgent) lines.push(`${CTX_UA_KEY}${encodeURIComponent(tracking.context.userAgent)}`);

  // UTM (optional)
  const utm = tracking.context.utm;
  if (utm?.utmSource) lines.push(`${UTM_SOURCE_KEY}${encodeURIComponent(utm.utmSource)}`);
  if (utm?.utmMedium) lines.push(`${UTM_MEDIUM_KEY}${encodeURIComponent(utm.utmMedium)}`);
  if (utm?.utmCampaign) lines.push(`${UTM_CAMPAIGN_KEY}${encodeURIComponent(utm.utmCampaign)}`);
  if (utm?.utmTerm) lines.push(`${UTM_TERM_KEY}${encodeURIComponent(utm.utmTerm)}`);
  if (utm?.utmContent) lines.push(`${UTM_CONTENT_KEY}${encodeURIComponent(utm.utmContent)}`);

  return lines.join("\n");
}

/**
 * Parse the encoded tags out of a Notification.message.
 * (Useful later when you build Reports / Metrics.)
 */
export function parseCustomerTrackingMessage(message: string | null | undefined): {
  summary: string | null;
  tags: Record<string, string>;
} {
  const raw = (message ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

  const tags: Record<string, string> = {};
  let summary: string | null = null;

  for (const line of raw) {
    if (!line.startsWith(PREFIX)) {
      // First non-tag line becomes summary
      if (!summary) summary = line;
      continue;
    }

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(PREFIX.length, eq); // KEY without prefix
    const val = line.slice(eq + 1);

    // decodeURIComponent safely
    try {
      tags[key] = decodeURIComponent(val);
    } catch {
      tags[key] = val;
    }
  }

  return { summary, tags };
}

export function tagsToConsent(tags: Record<string, string>): CustomerConsent | null {
  const capturedAt = tags["CONSENT_AT"];
  if (!capturedAt) return null;

  const method = (tags["CONSENT_METHOD"] as ConsentMethod) || "VERBAL";

  return {
    smsOperational: isTrue(tags["CONSENT_SMS_OP"] ?? "false"),
    emailOperational: isTrue(tags["CONSENT_EMAIL_OP"] ?? "false"),
    marketing: isTrue(tags["CONSENT_MARKETING"] ?? "false"),
    method,
    capturedAt,
  };
}
