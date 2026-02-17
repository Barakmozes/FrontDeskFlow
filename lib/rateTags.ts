// lib/rateTags.ts

/**
 * Pricing tags are stored in Table.specialRequests (string[]).
 * We do NOT change backend schema now.
 *
 * Tags are prefixed with "RATE:" so we never collide with:
 *  - housekeeping tags (HK:*)
 *  - regular notes
 *
 * Example tags:
 *  - RATE:CURRENCY=USD
 *  - RATE:BASE=150
 *  - RATE:OVERRIDE=220
 */

export type CurrencyCode = "USD" | "EUR" | "ILS" | "GBP" | "AUD" | "CAD" | "JPY";

export type RateMeta = {
  currency: CurrencyCode;
  base: number | null; // hotel base nightly rate (applied to all rooms)
  override: number | null; // room-specific nightly override
};

export type RatePatch = Partial<{
  currency: CurrencyCode | null;
  base: number | null;
  override: number | null;
}>;

const PREFIX = "RATE:";
const CURRENCY_KEY = `${PREFIX}CURRENCY=`;
const BASE_KEY = `${PREFIX}BASE=`;
const OVERRIDE_KEY = `${PREFIX}OVERRIDE=`;

const parseNumber = (v: string): number | null => {
  const n = parseFloat(v.trim());
  if (!Number.isFinite(n)) return null;
  return n;
};

const asCurrency = (v: string): CurrencyCode | null => {
  const code = v.trim().toUpperCase();
  if (
    code === "USD" ||
    code === "EUR" ||
    code === "ILS" ||
    code === "GBP" ||
    code === "AUD" ||
    code === "CAD" ||
    code === "JPY"
  ) {
    return code as CurrencyCode;
  }
  return null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseRateTags(
  specialRequests: string[] | null | undefined
): { rate: RateMeta; notes: string[] } {
  const raw = specialRequests ?? [];

  let currency: CurrencyCode = "USD";
  let base: number | null = null;
  let override: number | null = null;

  const notes: string[] = [];

  for (const item of raw) {
    if (!item?.startsWith(PREFIX)) {
      notes.push(item);
      continue;
    }

    if (item.startsWith(CURRENCY_KEY)) {
      const c = asCurrency(item.slice(CURRENCY_KEY.length));
      if (c) currency = c;
      continue;
    }

    if (item.startsWith(BASE_KEY)) {
      base = parseNumber(item.slice(BASE_KEY.length));
      continue;
    }

    if (item.startsWith(OVERRIDE_KEY)) {
      override = parseNumber(item.slice(OVERRIDE_KEY.length));
      continue;
    }

    // Unknown RATE tags are ignored (forward compatibility).
  }

  return { rate: { currency, base, override }, notes };
}

export function applyRatePatch(
  specialRequests: string[] | null | undefined,
  patch: RatePatch
): string[] {
  const raw = (specialRequests ?? []).filter((s) => !!s);

  // Keep everything NOT RATE:* (includes HK:* and notes)
  const nonRate = raw.filter((s) => !s.startsWith(PREFIX));

  const { rate } = parseRateTags(raw);

  const nextCurrency =
    patch.currency === undefined ? rate.currency : patch.currency ?? rate.currency;

  const nextBase = patch.base === undefined ? rate.base : patch.base;
  const nextOverride = patch.override === undefined ? rate.override : patch.override;

  const tags: string[] = [];

  // Always persist currency tag so UI formatting is consistent.
  tags.push(`${CURRENCY_KEY}${nextCurrency}`);

  if (nextBase != null && Number.isFinite(nextBase)) {
    tags.push(`${BASE_KEY}${round2(nextBase)}`);
  }

  if (nextOverride != null && Number.isFinite(nextOverride)) {
    tags.push(`${OVERRIDE_KEY}${round2(nextOverride)}`);
  }

  return [...nonRate, ...tags];
}

export function getEffectiveNightlyRate(rate: RateMeta): number | null {
  if (rate.override != null) return rate.override;
  if (rate.base != null) return rate.base;
  return null;
}
