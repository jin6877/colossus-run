/**
 * Difficulty / tension curve (PROJECT.md §8). Pure functions of survived
 * distance — deterministic and unit-testable. Speed ramps up, the warden's
 * target gap G* shrinks (the world closes in), and both are capped so the run
 * stays fast-but-fair.
 */

const V0 = 14; // starting forward speed (m/s)
const VMAX = 34; // top speed (m/s)
const V_K = 0.008; // ramp slope (reaches vmax ~2.5km in)

const GAP_START = 40; // far target gap (m) — warden present but survivable early
const GAP_END = 22; // deep target gap (m) — the world closes in
const GAP_K = 0.012; // shrink slope

/** Forward speed the game feeds the hero at a given survived distance. */
export function speedAt(dist: number): number {
  return Math.min(VMAX, V0 + V_K * Math.max(0, dist));
}

/** Warden target gap G* — shrinks with distance so the world gets scarier. */
export function gapTargetAt(dist: number): number {
  return Math.max(GAP_END, GAP_START - GAP_K * Math.max(0, dist));
}

export const SPEED_MIN = V0;
export const SPEED_MAX = VMAX;
