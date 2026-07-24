/**
 * Difficulty / tension curve (PROJECT.md §8, adapted for the ~4m agile-predator
 * claw core). Pure functions of survived distance — deterministic + unit-testable.
 * Forward speed ramps up; the warden's SWIPE cadence tightens (shorter interval +
 * shorter windup telegraph) and it leads the hero's motion more, so the claws get
 * faster and harder to juke the deeper you go. Standing still / running straight
 * is lethal by design — the locked swipe band lands on a hero who doesn't dodge.
 */

const V0 = 15; // starting forward speed (m/s)
const VMAX = 34; // top speed (m/s) — fast + thrilling
const V_K = 0.008;

// legacy loom target gap (kept for unit tests + the follow-distance reference)
const GAP_START = 40;
const GAP_END = 20;
const GAP_K = 0.012;

/** Forward speed the game feeds the hero at a given survived distance. */
export function speedAt(dist: number): number {
  return Math.min(VMAX, V0 + V_K * Math.max(0, dist));
}

/** Loom/follow target gap (m) — the predator hangs this close behind. */
export function gapTargetAt(dist: number): number {
  return Math.max(GAP_END, GAP_START - GAP_K * Math.max(0, dist));
}

/** Seconds between claw swipes — tightens with distance (more relentless). */
export function swipeIntervalAt(dist: number): number {
  return Math.max(0.6, 1.35 - 0.00055 * Math.max(0, dist));
}

/** Telegraph windup (s) before a swipe — shrinks with distance (less warning). */
export function windupAt(dist: number): number {
  return Math.max(0.4, 0.72 - 0.0002 * Math.max(0, dist));
}

/** How far ahead (s) the warden predicts the hero's lane when aiming a swipe. */
export function leadTimeAt(dist: number): number {
  return Math.min(0.36, 0.1 + 0.00016 * Math.max(0, dist));
}

export const SPEED_MIN = V0;
export const SPEED_MAX = VMAX;
