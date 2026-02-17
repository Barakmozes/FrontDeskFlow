/**
 * Room rate overrides are stored in Table.specialRequests (string[]).
 * This is client-only "hotel dressing", no schema change.
 *
 * Tag example:
 *   RATE:OVERRIDE=350
 *
 * We keep all other tags/notes (including HK:... tags) intact.
 */

export type RoomRateMeta = {
  overrideNightlyRate: number | null;
};

const PREFIX = "RATE:";
const OVERRIDE_KEY = `${PREFIX}OVERRIDE=`;

function toNumberSafe(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseRoomRateTags(
  specialRequests: string[] | null | undefined
): {
  rate: RoomRateMeta;
  notes: string[]; // everything that isn't RATE:
} {
  const raw = (specialRequests ?? []).filter(Boolean);

  let overrideNightlyRate: number | null = null;
  const notes: string[] = [];

  for (const item of raw) {
    if (!item.startsWith(PREFIX)) {
      notes.push(item);
      continue;
    }

    if (item.startsWith(OVERRIDE_KEY)) {
      const n = toNumberSafe(item.slice(OVERRIDE_KEY.length).trim());
      if (n !== null && n >= 0) overrideNightlyRate = clampMoney(n);
      continue;
    }
  }

  return { rate: { overrideNightlyRate }, notes };
}

export function applyRoomRatePatch(
  specialRequests: string[] | null | undefined,
  patch: Partial<RoomRateMeta>
): string[] {
  const raw = (specialRequests ?? []).filter(Boolean);

  // Remove all RATE tags, keep everything else (HK tags + notes stay)
  const nonRate = raw.filter((s) => !s.startsWith(PREFIX));

  const { rate } = parseRoomRateTags(raw);
  const next: RoomRateMeta = {
    overrideNightlyRate: patch.overrideNightlyRate ?? rate.overrideNightlyRate,
  };

  if (next.overrideNightlyRate === null) return nonRate;

  return [...nonRate, `${OVERRIDE_KEY}${clampMoney(next.overrideNightlyRate)}`];
}

export function getEffectiveNightlyRate(baseRate: number, override: number | null | undefined): number {
  const v = override ?? null;
  return v !== null ? v : baseRate;
}
