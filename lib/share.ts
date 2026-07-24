/**
 * Seed <-> URL query (adapted from meteor-city, PROJECT.md §9). All external
 * input is treated as hostile: the seed is integer-parsed and range-clamped, and
 * we only ever read our OWN query params — no external URL is dereferenced and
 * nothing here touches innerHTML. colossus-run drops meteor type/size and keeps a
 * single `seed` (the course is fully determined by it).
 */

export const SEED_MAX = 0x7fffffff; // stay within signed 32-bit for a stable PRNG

/** Parse an arbitrary seed string to a valid integer seed, or null if invalid. */
export function parseSeed(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!/^-?\d{1,10}$/.test(trimmed)) return null; // digits only, bounded length
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  const clamped = Math.abs(n) % (SEED_MAX + 1);
  return clamped >>> 0;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * (SEED_MAX + 1)) >>> 0;
}

/** A short, friendly display code for a seed (base36, uppercased). */
export function seedCode(seed: number): string {
  return (seed >>> 0).toString(36).toUpperCase();
}

export interface ShareState {
  seed: number;
}

/** Read seed from a URLSearchParams-like source, with validation + fallback. */
export function readShareState(
  params: URLSearchParams,
  fallback: ShareState,
): { state: ShareState; seedWasInvalid: boolean } {
  const rawSeed = params.get('seed');
  const parsed = parseSeed(rawSeed);
  const seedWasInvalid = rawSeed != null && parsed == null;
  return {
    state: { seed: parsed ?? fallback.seed },
    seedWasInvalid,
  };
}

/** Build a shareable query string (no host — caller prepends origin+path). */
export function buildShareQuery(state: ShareState): string {
  const p = new URLSearchParams();
  p.set('seed', String(state.seed >>> 0));
  return p.toString();
}

export function buildShareUrl(origin: string, pathname: string, state: ShareState): string {
  return `${origin}${pathname}?${buildShareQuery(state)}`;
}
