// lib/housekeepingTags.ts
/**
 * Housekeeping tags are stored in Table.specialRequests (string[]).
 * We do NOT change backend schema now.
 *
 * Convention (new, key=value):
 * - HK:STATUS=CLEAN|DIRTY|MAINTENANCE|OUT_OF_ORDER
 * - HK:IN_LIST=true|false
 * - HK:LAST_CLEANED_AT=<ISO>
 * - HK:REASON=<urlencoded>
 *
 * Backwards compatibility (legacy):
 * - HK:CLEAN | HK:DIRTY | HK:MAINTENANCE | HK:OUT_OF_ORDER
 *
 * We preserve:
 * - Non-HK notes (any string not starting with "HK:")
 * - Unknown HK tags (for forward compatibility)
 */

export type HKStatus = "CLEAN" | "DIRTY" | "MAINTENANCE" | "OUT_OF_ORDER";

// Backwards compatibility alias (your code uses both names in different places)
export type HkRoomStatus = HKStatus;

export type HKMeta = {
  status: HKStatus;
  inCleaningList: boolean;
  lastCleanedAt: string | null; // ISO
  reason: string | null; // free text
};

const PREFIX = "HK:";
const STATUS_KEY = `${PREFIX}STATUS=`;
const IN_LIST_KEY = `${PREFIX}IN_LIST=`;
const LAST_CLEANED_KEY = `${PREFIX}LAST_CLEANED_AT=`;
const REASON_KEY = `${PREFIX}REASON=`;

// Legacy tags (older code used these)
const LEGACY_STATUS_TAGS: Record<HKStatus, string> = {
  CLEAN: "HK:CLEAN",
  DIRTY: "HK:DIRTY",
  MAINTENANCE: "HK:MAINTENANCE",
  OUT_OF_ORDER: "HK:OUT_OF_ORDER",
};

const isTrue = (v: string) => ["true", "1", "yes", "y"].includes(v.trim().toLowerCase());

const isKnownStatus = (v: string): v is HKStatus =>
  v === "CLEAN" || v === "DIRTY" || v === "MAINTENANCE" || v === "OUT_OF_ORDER";

function normalizeIsoOrNull(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Split specialRequests into:
 * - hk meta (derived)
 * - notes (non-HK strings)
 * - unknown HK tags (preserved)
 */
export function parseHousekeepingTags(
  specialRequests: string[] | null | undefined
): { hk: HKMeta; notes: string[]; unknownHK: string[] } {
  const raw = (specialRequests ?? []).filter((x): x is string => typeof x === "string" && x.trim().length > 0);

  let status: HKStatus | null = null;
  let inCleaningList = false;
  let lastCleanedAt: string | null = null;
  let reason: string | null = null;

  const notes: string[] = [];
  const unknownHK: string[] = [];

  for (const item of raw) {
    if (!item.startsWith(PREFIX)) {
      notes.push(item);
      continue;
    }

    // ---- Legacy tags like HK:CLEAN ----
    const legacy = (Object.keys(LEGACY_STATUS_TAGS) as HKStatus[]).find((k) => item === LEGACY_STATUS_TAGS[k]);
    if (legacy) {
      status = legacy;
      continue;
    }

    // ---- Key=value tags ----
    if (item.startsWith(STATUS_KEY)) {
      const v = item.slice(STATUS_KEY.length).trim().toUpperCase();
      if (isKnownStatus(v)) status = v;
      continue;
    }

    if (item.startsWith(IN_LIST_KEY)) {
      inCleaningList = isTrue(item.slice(IN_LIST_KEY.length));
      continue;
    }

    if (item.startsWith(LAST_CLEANED_KEY)) {
      const v = item.slice(LAST_CLEANED_KEY.length).trim();
      lastCleanedAt = normalizeIsoOrNull(v);
      continue;
    }

    if (item.startsWith(REASON_KEY)) {
      const encoded = item.slice(REASON_KEY.length);
      try {
        reason = decodeURIComponent(encoded);
      } catch {
        reason = encoded; // if malformed encoding, keep raw
      }
      continue;
    }

    // Unknown HK tags: preserve (forward compatibility)
    unknownHK.push(item);
  }

  return {
    hk: {
      status: status ?? "CLEAN", // default if nothing set
      inCleaningList,
      lastCleanedAt,
      reason,
    },
    notes,
    unknownHK,
  };
}

/**
 * Patch HK meta back into specialRequests.
 * - Non-HK notes preserved
 * - Unknown HK tags preserved
 *
 * IMPORTANT:
 * - supports explicitly clearing fields by passing null (e.g. { reason: null })
 * - we keep tags compact and stable
 */
export function applyHousekeepingPatch(
  specialRequests: string[] | null | undefined,
  patch: Partial<HKMeta>
): string[] {
  const parsed = parseHousekeepingTags(specialRequests);

  // "null" must be respected as explicit clear:
  const next: HKMeta = {
    status: patch.status ?? parsed.hk.status,
    inCleaningList:
      typeof patch.inCleaningList === "boolean" ? patch.inCleaningList : parsed.hk.inCleaningList,
    lastCleanedAt: "lastCleanedAt" in patch ? patch.lastCleanedAt ?? null : parsed.hk.lastCleanedAt,
    reason: "reason" in patch ? patch.reason ?? null : parsed.hk.reason,
  };

  const hkTags: string[] = [];

  // Always write the canonical status tag
  hkTags.push(`${STATUS_KEY}${next.status}`);

  // Compact tags
  if (next.inCleaningList) hkTags.push(`${IN_LIST_KEY}true`);
  if (next.lastCleanedAt) hkTags.push(`${LAST_CLEANED_KEY}${next.lastCleanedAt}`);

  // Reason only relevant for maintenance/OOO
  if (
    (next.status === "MAINTENANCE" || next.status === "OUT_OF_ORDER") &&
    next.reason?.trim()
  ) {
    hkTags.push(`${REASON_KEY}${encodeURIComponent(next.reason.trim())}`);
  }

  // Preserve non-HK notes + unknown HK tags
  return [...parsed.notes, ...parsed.unknownHK, ...hkTags];
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Hotel-friendly derived room status (client-only).
 * - Occupied overrides everything (Table.reserved)
 * - Otherwise use HK status to determine Vacant Clean/Dirty/Maintenance/OOO
 */
export type DerivedRoomStatus =
  | "OCCUPIED"
  | "VACANT_CLEAN"
  | "VACANT_DIRTY"
  | "MAINTENANCE"
  | "OUT_OF_ORDER";

export function deriveRoomStatus(isOccupied: boolean, hk: HKMeta): DerivedRoomStatus {
  if (isOccupied) return "OCCUPIED";
  if (hk.status === "OUT_OF_ORDER") return "OUT_OF_ORDER";
  if (hk.status === "MAINTENANCE") return "MAINTENANCE";
  if (hk.status === "DIRTY") return "VACANT_DIRTY";
  return "VACANT_CLEAN";
}
