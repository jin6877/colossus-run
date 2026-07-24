/**
 * Warden controller (PROJECT.md §4) — the WARDEN also runs the course arc-length
 * (always s_warden < s_player) as a KINEMATIC driver; its collider is one capsule
 * for proximity, and destruction is triggered from its FOOT positions (§5), not a
 * dynamic body. Catch-up is a rubber band around a target gap G* that shrinks
 * with distance: fall behind and it surges, get close and it eases (but never
 * stops — there's a floor). Pure logic (no three); the render rig reads gaitPhase
 * / footfall events / attention to drive the 2-bone leg IK, head look-at and the
 * cold crack glow. "Intelligence" is cheap and high-impact: predictive lateral
 * aim toward the hero, dash-reaction surges, and telegraphed corner-cut lunges.
 */

const KP = 0.5; // proportional gain on (gap - G*)
const SURGE_MAX = 1.55; // warden speed cap as a multiple of hero speed
const FLOOR = 0.8; // warden speed floor as a multiple of hero speed (never stops)
const LAT_TAU = 0.55; // lateral tracking smoothness
const LUNGE_GAP = 10; // start telegraphing sweeps when this close

function crossed(a: number, b: number, mark: number): boolean {
  // did the phase pass `mark` going forward within [a, b) (b may exceed 1)?
  return a < mark && b >= mark;
}

export interface Footfall {
  side: 'L' | 'R';
}

export class Warden {
  s = 0;
  lateral = 0;
  speed = 0;
  gaitPhase = 0; // [0,1); right foot lands at 0, left at 0.5
  attention = 0; // 0..1 lock-on (drives mask glow)
  emissiveSurge = 0; // spikes on footfall/telegraph, decays (charge/discharge)
  lungeT = 0; // >0 while a sweep is telegraphed/striking
  private lungeCd = 2.5;
  /** footfall events produced this step (consumed by the Engine for FX/destruction) */
  pending: Footfall[] = [];

  reset(startGap: number) {
    this.s = -startGap;
    this.lateral = 0;
    this.speed = 0;
    this.gaitPhase = 0;
    this.attention = 0;
    this.emissiveSurge = 0;
    this.lungeT = 0;
    this.lungeCd = 2.5;
    this.pending.length = 0;
  }

  gapTo(heroS: number): number {
    return heroS - this.s;
  }

  update(
    dt: number,
    heroS: number,
    heroLateral: number,
    heroSpeed: number,
    heroDashing: boolean,
    gapTarget: number,
  ) {
    this.pending.length = 0;
    const gap = heroS - this.s;

    // ---- catch-up rubber band ----
    let desired = heroSpeed + KP * (gap - gapTarget);
    if (heroDashing) desired += heroSpeed * 0.25; // dash reaction surge
    const lo = heroSpeed * FLOOR;
    const hi = heroSpeed * SURGE_MAX;
    desired = Math.max(lo, Math.min(hi, desired));
    // ease toward desired (heavy body, no instant velocity change)
    this.speed += (desired - this.speed) * (1 - Math.exp(-dt / 0.35));
    this.s += this.speed * dt;

    // ---- predictive lateral aim (menacing, head-on) ----
    this.lateral += (heroLateral - this.lateral) * (1 - Math.exp(-dt / LAT_TAU));

    // ---- attention / proximity glow ----
    const near = Math.max(0, Math.min(1, (LUNGE_GAP * 4 - gap) / (LUNGE_GAP * 4)));
    this.attention += (near - this.attention) * (1 - Math.exp(-dt / 0.4));

    // ---- telegraphed sweep when very close ----
    if (this.lungeCd > 0) this.lungeCd -= dt;
    if (this.lungeT > 0) {
      this.lungeT -= dt;
    } else if (gap < LUNGE_GAP && this.lungeCd <= 0) {
      this.lungeT = 0.9; // windup + strike window
      this.lungeCd = 3.2;
      this.emissiveSurge = 1; // arm cracks flare on telegraph
    }

    // ---- gait phase + footfall detection (slow cadence for a huge creature) ----
    const cadence = Math.max(0.45, Math.min(0.8, 0.45 + heroSpeed * 0.011)); // steps/sec
    const inc = cadence * dt;
    const np = this.gaitPhase + inc;
    if (crossed(this.gaitPhase, np, 0.5)) this.pending.push({ side: 'L' });
    if (crossed(this.gaitPhase, np, 1.0)) this.pending.push({ side: 'R' });
    this.gaitPhase = np % 1;
    if (this.gaitPhase < 0) this.gaitPhase += 1;

    if (this.emissiveSurge > 0) this.emissiveSurge = Math.max(0, this.emissiveSurge - dt / 0.4);
  }

  /** Bump the cold glow on footfall contact (called by the Engine at the foot). */
  footSurge() {
    this.emissiveSurge = Math.max(this.emissiveSurge, 0.9);
  }
}
