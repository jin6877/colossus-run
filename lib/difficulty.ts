/**
 * Difficulty / tension curve (PROJECT.md §8, adapted for the foot-dodge core).
 * Pure functions of survived distance — deterministic + unit-testable. Forward
 * speed ramps up; the warden STOMP cadence tightens (shorter interval + shorter
 * windup telegraph) and it leads the hero's motion more, so the feet get harder
 * to dodge the deeper you go.
 */

const V0 = 14; // starting forward speed (m/s)
const VMAX = 30; // top speed (m/s) — a touch calmer than the rear-cam core, for control
const V_K = 0.007;

// legacy loom target gap (kept for the looming warden + unit tests)
const GAP_START = 40;
const GAP_END = 22;
const GAP_K = 0.012;

/** Forward speed the game feeds the hero at a given survived distance. */
export function speedAt(dist: number): number {
  return Math.min(VMAX, V0 + V_K * Math.max(0, dist));
}

/** Loom target gap (m) — the warden hangs this far behind, always overhead. */
export function gapTargetAt(dist: number): number {
  return Math.max(GAP_END, GAP_START - GAP_K * Math.max(0, dist));
}

/** Seconds between stomps — tightens with distance (more relentless). */
export function stompIntervalAt(dist: number): number {
  return Math.max(0.7, 1.7 - 0.0006 * Math.max(0, dist));
}

/** Telegraph windup (s) before a slam — shrinks with distance (less warning). */
export function windupAt(dist: number): number {
  return Math.max(0.42, 0.85 - 0.00022 * Math.max(0, dist));
}

/** How far ahead (s) the warden predicts the hero when aiming a stomp. */
export function leadTimeAt(dist: number): number {
  return Math.min(0.4, 0.08 + 0.00014 * Math.max(0, dist));
}

export const SPEED_MIN = V0;
export const SPEED_MAX = VMAX;
