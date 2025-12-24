/**
 * lib/hotelSettingsTags.ts
 *
 * Stores and retrieves per-hotel configuration from `Area.description`.
 *
 * System model:
 *   - Area = Hotel
 *   - Table = Room
 *   - Hotel base settings live in Area.description (this file)
 *   - Room override nightly rate lives in Table.specialRequests (roomRateTags.ts)
 *
 * Goals:
 *   - Never throw during parse (resilient to malformed descriptions).
 *   - Preserve non-settings text in Area.description.
 *   - Backward compatible with legacy KEY=VALUE / KEY: VALUE lines.
 *   - Preferred modern format: embedded JSON block between markers.
 */

export const HOTEL_SETTINGS_BLOCK_MARKERS = {
  START: "[[HOTEL_SETTINGS_JSON]]",
  END: "[[/HOTEL_SETTINGS_JSON]]",
} as const;

export const HOTEL_TAGS = {
  HOURS_BREAKFAST: "HOURS_BREAKFAST",
  HOURS_RESTAURANT: "HOURS_RESTAURANT",
  HOURS_ROOM_SERVICE: "HOURS_ROOM_SERVICE",
} as const;

export type HotelOpeningHours = {
  breakfast: string;   // e.g. "07:00-10:30" or ""
  restaurant: string;  // e.g. "12:00-22:00" or ""
  roomService: string; // e.g. "24/7" or ""
};

export type HotelSettings = {
  // Pricing
  baseNightlyRate: number; // 0 means "unset"
  currency: string;        // "USD", "EUR", etc.

  // Policies
  autoPostRoomCharges: boolean;
  checkoutRequiresPaidFolio: boolean;

  // Times (stored as strings to avoid null issues in inputs)
  checkInTime: string;  // "15:00" or ""
  checkOutTime: string; // "11:00" or ""

  // Receipt identity / business details (strings; "" means unset)
  hotelAddress: string;
  hotelPhone: string;
  hotelEmail: string;
  hotelWebsite: string;
  vatNumber: string;

  // Derived from tags (HOURS_* keys)
  openingHours: HotelOpeningHours;
};

export type ParsedHotelSettings = {
  /** Area.description without the managed settings JSON block */
  baseText: string;
  /** Safe defaults + normalized values */
  settings: HotelSettings;
  
  /** Generic tag bag (string values only) */
  tags: Record<string, string>;
  /** Raw parsed JSON block (debug/migration); null if not present/invalid */
  rawBlock: unknown | null;
};

export type HotelSettingsPatch = Partial<{
  baseNightlyRate: number | null;
  currency: string | null;

  autoPostRoomCharges: boolean | null;
  checkoutRequiresPaidFolio: boolean | null;

  checkInTime: string | null;
  checkOutTime: string | null;

  hotelAddress: string | null;
  hotelPhone: string | null;
  hotelEmail: string | null;
  hotelWebsite: string | null;
  vatNumber: string | null;

  // Structured opening-hours patch → writes HOURS_* tags
  openingHours: Partial<HotelOpeningHours> | null;

  /**
   * Generic tags patch. `null`/`undefined` deletes the tag.
   * Used by OpeningHours.tsx (HOURS_* keys) and any other per-hotel tag settings.
   */
  tags: Record<string, string | null | undefined> | null;

  // Optional address components (legacy / convenience)
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}>;

type SettingsJsonBlock = {
  version?: number;
  settings?: Partial<HotelSettings> & Record<string, unknown>;
  tags?: Record<string, unknown>;
};

const DEFAULT_SETTINGS: HotelSettings = {
  baseNightlyRate: 0,
  currency: "USD",

  autoPostRoomCharges: false,
  checkoutRequiresPaidFolio: true,

  checkInTime: "",
  checkOutTime: "",

  hotelAddress: "",
  hotelPhone: "",
  hotelEmail: "",
  hotelWebsite: "",
  vatNumber: "",

  openingHours: {
    breakfast: "",
    restaurant: "",
    roomService: "",
  },
};

function safeTrim(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeUpper(v: unknown): string {
  return safeTrim(v).toUpperCase();
}

function safeNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function safeBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(s)) return true;
    if (["false", "0", "no", "n", "off"].includes(s)) return false;
  }
  return null;
}

function normalizeCurrency(v: unknown, fallback = "USD"): string {
  const c = safeUpper(v);
  const cleaned = c.replace(/[^A-Z]/g, "");
  if (cleaned.length >= 3 && cleaned.length <= 5) return cleaned;
  return fallback;
}

function normalizeTime(v: unknown): string {
  // We keep validation permissive (07:00-10:30 / 24/7 etc.)
  return safeTrim(v);
}

/**
 * Extract first settings JSON block using known marker pairs.
 * Supports legacy marker variants for backwards compatibility.
 */
function extractSettingsBlock(text: string): { start: number; end: number; json: string } | null {
  const candidates: Array<{ start: string; end: string }> = [
    { start: HOTEL_SETTINGS_BLOCK_MARKERS.START, end: HOTEL_SETTINGS_BLOCK_MARKERS.END },
    { start: "[[HOTEL_SETTINGS]]", end: "[[/HOTEL_SETTINGS]]" }, // legacy
    { start: "<<<HOTEL_SETTINGS>>>", end: "<<<END_HOTEL_SETTINGS>>>" }, // legacy
    { start: "<!-- HOTEL_SETTINGS_START -->", end: "<!-- HOTEL_SETTINGS_END -->" }, // legacy
  ];

  for (const m of candidates) {
    const s = text.indexOf(m.start);
    if (s === -1) continue;
    const e = text.indexOf(m.end, s + m.start.length);
    if (e === -1) continue;

    const json = text.slice(s + m.start.length, e).trim();
    return { start: s, end: e + m.end.length, json };
  }

  return null;
}

function safeJsonParse(str: string): unknown | null {
  const trimmed = str.trim();
  if (!trimmed) return null;

  // Optional legacy base64 support: "base64:...."
  const maybeBase64 = trimmed.startsWith("base64:") ? trimmed.slice("base64:".length) : null;

  try {
    if (maybeBase64) {
      const atobFn = (globalThis as any)?.atob as ((s: string) => string) | undefined;
      if (typeof atobFn === "function") {
        const decoded = atobFn(maybeBase64);
        return JSON.parse(decoded);
      }
      // If atob isn't available, fall through to plain JSON parse.
    }
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Parse legacy uppercase tags lines:
 *   KEY=VALUE
 *   KEY: VALUE
 */
function parseLegacyTags(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/g);

  for (const line of lines) {
    const m = line.match(/^\s*(?:[#@]\s*)?([A-Z][A-Z0-9_]{2,})\s*(?:=|:)\s*(.*?)\s*$/);
    if (!m) continue;

    const key = m[1]?.trim();
    const value = (m[2] ?? "").trim();
    if (!key) continue;
    if (value !== "") out[key] = value;
  }

  return out;
}

function mergeTags(
  base: Record<string, string>,
  patch: Record<string, string | null | undefined> | null | undefined
): Record<string, string> {
  const next: Record<string, string> = { ...base };
  if (!patch) return next;

  for (const [k, v] of Object.entries(patch)) {
    const key = String(k ?? "").trim();
    if (!key) continue;

    if (v == null) {
      delete next[key];
      continue;
    }

    const val = String(v).trim();
    if (!val) {
      delete next[key];
      continue;
    }

    next[key] = val;
  }

  return next;
}

function tagsToOpeningHours(tags: Record<string, string>): HotelOpeningHours {
  return {
    breakfast: tags[HOTEL_TAGS.HOURS_BREAKFAST] ?? "",
    restaurant: tags[HOTEL_TAGS.HOURS_RESTAURANT] ?? "",
    roomService: tags[HOTEL_TAGS.HOURS_ROOM_SERVICE] ?? "",
  };
}

function normalizeSettings(input: Partial<HotelSettings> | null | undefined, base: HotelSettings): HotelSettings {
  const s = input ?? {};

  const baseNightlyRate = safeNumber((s as any).baseNightlyRate);
  const currency = normalizeCurrency((s as any).currency, base.currency);

  const autoPostRoomCharges = safeBool((s as any).autoPostRoomCharges);
  const checkoutRequiresPaidFolio = safeBool((s as any).checkoutRequiresPaidFolio);

  const checkInTime = normalizeTime((s as any).checkInTime);
  const checkOutTime = normalizeTime((s as any).checkOutTime);

  const hotelAddress = safeTrim((s as any).hotelAddress);
  const hotelPhone = safeTrim((s as any).hotelPhone);
  const hotelEmail = safeTrim((s as any).hotelEmail);
  const hotelWebsite = safeTrim((s as any).hotelWebsite);
  const vatNumber = safeTrim((s as any).vatNumber);

  const openingHoursRaw = (s as any).openingHours as Partial<HotelOpeningHours> | undefined;

  return {
    baseNightlyRate: baseNightlyRate != null ? Math.max(0, baseNightlyRate) : base.baseNightlyRate,
    currency,

    autoPostRoomCharges: autoPostRoomCharges != null ? autoPostRoomCharges : base.autoPostRoomCharges,
    checkoutRequiresPaidFolio:
      checkoutRequiresPaidFolio != null ? checkoutRequiresPaidFolio : base.checkoutRequiresPaidFolio,

    checkInTime: checkInTime || base.checkInTime,
    checkOutTime: checkOutTime || base.checkOutTime,

    hotelAddress: hotelAddress || base.hotelAddress,
    hotelPhone: hotelPhone || base.hotelPhone,
    hotelEmail: hotelEmail || base.hotelEmail,
    hotelWebsite: hotelWebsite || base.hotelWebsite,
    vatNumber: vatNumber || base.vatNumber,

    openingHours: {
      breakfast: normalizeTime(openingHoursRaw?.breakfast) || base.openingHours.breakfast,
      restaurant: normalizeTime(openingHoursRaw?.restaurant) || base.openingHours.restaurant,
      roomService: normalizeTime(openingHoursRaw?.roomService) || base.openingHours.roomService,
    },
  };
}

function buildSettingsBlock(payload: SettingsJsonBlock): string {
  const json = JSON.stringify(
    {
      version: 1,
      settings: payload.settings ?? {},
      tags: payload.tags ?? {},
    },
    null,
    2
  );

  return `${HOTEL_SETTINGS_BLOCK_MARKERS.START}\n${json}\n${HOTEL_SETTINGS_BLOCK_MARKERS.END}`;
}

export function parseHotelSettings(description: string | null | undefined): ParsedHotelSettings {
  const text = String(description ?? "");

  const block = extractSettingsBlock(text);
  const baseText = block ? `${text.slice(0, block.start)}${text.slice(block.end)}`.trim() : text.trim();

  const legacyTags = parseLegacyTags(baseText);

  const raw = block ? safeJsonParse(block.json) : null;
  let jsonTags: Record<string, string> = {};
  let jsonSettings: Partial<HotelSettings> | null = null;

  if (raw && typeof raw === "object") {
    const rb = raw as SettingsJsonBlock;

    if (rb.tags && typeof rb.tags === "object") {
      for (const [k, v] of Object.entries(rb.tags)) {
        const key = String(k ?? "").trim();
        if (!key) continue;
        const val = safeTrim(v);
        if (val) jsonTags[key] = val;
      }
    }

    if (rb.settings && typeof rb.settings === "object") {
      jsonSettings = rb.settings as any;
    }
  }

  // Merge tags: legacy first, JSON overrides
  const tags: Record<string, string> = { ...legacyTags, ...jsonTags };

  // Back-compat: derive some settings from tags when JSON is absent.
  const tagBaseRate =
    safeNumber(tags["BASE_NIGHTLY_RATE"]) ??
    safeNumber(tags["BASE_RATE"]) ??
    safeNumber(tags["BASE_NIGHTLY"]) ??
    null;

  const tagCurrency = tags["CURRENCY"] ?? tags["HOTEL_CURRENCY"] ?? "";

  const tagAutoPost =
    safeBool(tags["AUTO_POST_ROOM_CHARGES"]) ??
    safeBool(tags["AUTOPOST_ROOM_CHARGES"]) ??
    safeBool(tags["AUTO_POST_CHARGES"]) ??
    null;

  const tagRequiresPaid =
    safeBool(tags["CHECKOUT_REQUIRES_PAID_FOLIO"]) ??
    safeBool(tags["REQUIRES_PAID_FOLIO"]) ??
    null;

  const derivedFromTags: Partial<HotelSettings> = {
    baseNightlyRate: tagBaseRate ?? undefined,
    currency: tagCurrency || undefined,
    autoPostRoomCharges: tagAutoPost ?? undefined,
    checkoutRequiresPaidFolio: tagRequiresPaid ?? undefined,

    checkInTime: tags["CHECKIN_TIME"] || undefined,
    checkOutTime: tags["CHECKOUT_TIME"] || undefined,

    hotelAddress: tags["HOTEL_ADDRESS"] || undefined,
    hotelPhone: tags["HOTEL_PHONE"] || undefined,
    hotelEmail: tags["HOTEL_EMAIL"] || undefined,
    hotelWebsite: tags["HOTEL_WEBSITE"] || undefined,
    vatNumber: tags["VAT_NUMBER"] || tags["VAT"] || undefined,

    openingHours: tagsToOpeningHours(tags),
  };

  // Normalize settings: defaults -> derivedFromTags -> jsonSettings
  const merged = normalizeSettings(derivedFromTags, DEFAULT_SETTINGS);
  const settings = normalizeSettings(jsonSettings, merged);

  // Single source of truth for opening hours is HOURS_* tags
  settings.openingHours = tagsToOpeningHours(tags);
  settings.currency = normalizeCurrency(settings.currency, "USD");

  return { baseText, settings, tags, rawBlock: raw };
}

export function serializeHotelSettings(args: {
  description?: string | null;
  settings?: Partial<HotelSettings> | null;
  tags?: Record<string, string> | null;
}): string {
  const parsed = args.description != null ? parseHotelSettings(args.description) : null;

  const baseText = parsed ? parsed.baseText : "";
  const baseSettings = parsed ? parsed.settings : DEFAULT_SETTINGS;
  const baseTags = parsed ? parsed.tags : {};

  const nextSettings = normalizeSettings(args.settings ?? {}, baseSettings);

  // Sanitize tags
  const nextTags: Record<string, string> = { ...baseTags };
  for (const [k, v] of Object.entries(args.tags ?? {})) {
    const key = String(k ?? "").trim();
    const val = safeTrim(v);
    if (!key) continue;
    if (!val) continue;
    nextTags[key] = val;
  }

  const block = buildSettingsBlock({ version: 1, settings: nextSettings, tags: nextTags });

  if (!parsed) return block;

  const prefix = baseText.trim();
  return prefix ? `${prefix}\n\n${block}` : block;
}

export function applyHotelSettingsPatch(description: string | null | undefined, patch: HotelSettingsPatch): string {
  const parsed = parseHotelSettings(description);
  let settings: HotelSettings = { ...parsed.settings };
  let tags: Record<string, string> = { ...parsed.tags };

  // 1) Generic tags patch
  if (patch.tags !== undefined && patch.tags !== null) {
    tags = mergeTags(tags, patch.tags);
  }

  // 2) Structured opening-hours patch (writes HOURS_* tags)
  if (patch.openingHours !== undefined && patch.openingHours !== null) {
    const oh = patch.openingHours;
    tags = mergeTags(tags, {
      [HOTEL_TAGS.HOURS_BREAKFAST]: oh.breakfast ?? undefined,
      [HOTEL_TAGS.HOURS_RESTAURANT]: oh.restaurant ?? undefined,
      [HOTEL_TAGS.HOURS_ROOM_SERVICE]: oh.roomService ?? undefined,
    });
  }

  // 3) Address components patch
  const hasAnyAddressPart =
    patch.addressLine1 != null ||
    patch.addressLine2 != null ||
    patch.city != null ||
    patch.state != null ||
    patch.zip != null ||
    patch.country != null;

  if (hasAnyAddressPart) {
    const line1 = safeTrim(patch.addressLine1 ?? "");
    const line2 = safeTrim(patch.addressLine2 ?? "");
    const city = safeTrim(patch.city ?? "");
    const state = safeTrim(patch.state ?? "");
    const zip = safeTrim(patch.zip ?? "");
    const country = safeTrim(patch.country ?? "");

    const addrLines: string[] = [];
    if (line1) addrLines.push(line1);
    if (line2) addrLines.push(line2);

    const cityLine = [city, state, zip].filter(Boolean).join(" ");
    if (cityLine) addrLines.push(cityLine);
    if (country) addrLines.push(country);

    settings.hotelAddress = addrLines.join("\n");
  }

  // 4) Direct settings patch
  if (patch.baseNightlyRate !== undefined) {
    settings.baseNightlyRate = patch.baseNightlyRate == null ? 0 : Math.max(0, Number(patch.baseNightlyRate) || 0);
  }

  if (patch.currency !== undefined) {
    // null/"" => keep old currency
    const next = normalizeCurrency(patch.currency, settings.currency || "USD");
    settings.currency = next;
  }

  if (patch.autoPostRoomCharges !== undefined) {
    settings.autoPostRoomCharges = Boolean(patch.autoPostRoomCharges);
  }

  if (patch.checkoutRequiresPaidFolio !== undefined) {
    settings.checkoutRequiresPaidFolio = Boolean(patch.checkoutRequiresPaidFolio);
  }

  if (patch.checkInTime !== undefined) {
    settings.checkInTime = normalizeTime(patch.checkInTime ?? "");
  }

  if (patch.checkOutTime !== undefined) {
    settings.checkOutTime = normalizeTime(patch.checkOutTime ?? "");
  }

  if (patch.hotelAddress !== undefined) settings.hotelAddress = safeTrim(patch.hotelAddress ?? "");
  if (patch.hotelPhone !== undefined) settings.hotelPhone = safeTrim(patch.hotelPhone ?? "");
  if (patch.hotelEmail !== undefined) settings.hotelEmail = safeTrim(patch.hotelEmail ?? "");
  if (patch.hotelWebsite !== undefined) settings.hotelWebsite = safeTrim(patch.hotelWebsite ?? "");
  if (patch.vatNumber !== undefined) settings.vatNumber = safeTrim(patch.vatNumber ?? "");

  // Opening hours are derived from tags
  settings.openingHours = tagsToOpeningHours(tags);
  settings.currency = normalizeCurrency(settings.currency, "USD");

  const block = buildSettingsBlock({ version: 1, settings, tags });

  const prefix = parsed.baseText.trim();
  return prefix ? `${prefix}\n\n${block}` : block;
}

/**
 * Summarize opening hours for UI
 *
 * Accepts:
 *  - Area.description string
 *  - tags object
 *  - openingHours object
 */
export function summarizeOpeningHours(
  input?: string | Record<string, string> | Partial<HotelOpeningHours> | null
): string {
  if (!input) return "—";

  let hours: HotelOpeningHours;

  if (typeof input === "string") {
    const parsed = parseHotelSettings(input);
    hours = parsed.settings.openingHours;
  } else if ("breakfast" in input || "restaurant" in input || "roomService" in input) {
    hours = {
      breakfast: safeTrim((input as any).breakfast),
      restaurant: safeTrim((input as any).restaurant),
      roomService: safeTrim((input as any).roomService),
    };
  } else {
    hours = tagsToOpeningHours(input as Record<string, string>);
  }

  const parts: string[] = [];
  if (hours.breakfast) parts.push(`Breakfast: ${hours.breakfast}`);
  if (hours.restaurant) parts.push(`Restaurant: ${hours.restaurant}`);
  if (hours.roomService) parts.push(`Room service: ${hours.roomService}`);

  return parts.length ? parts.join(" • ") : "—";
}
