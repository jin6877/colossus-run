/**
 * Warden controller (PROJECT.md §4, foot-dodge core). The reversed camera faces
 * the warden, so it now LOOMS directly over the fleeing hero (a small fixed gap)
 * instead of chasing from a readable distance. Its danger is its STOMPING FEET:
 * on a cadence it raises a foot, a ground shadow telegraphs the landing lane
 * (natural — no color paint), then it SLAMS. Stand in the footprint at slam and
 * you're crushed; dodge left/right (or the shockwave, which you hop). Pure logic
 * (no three) — the timing/aim (predictive lead) is unit-testable. The rig reads
 * gaitPhase / stomp state / attention to drive the 2-bone IK, the head look-at
 * and the cold crack glow.
 */

const LOOM_GAP = 13; // the warden looms this far behind (hero clearly in foreground)
const STOMP_GAP = 6; // it LUNGES forward to this gap to stomp, then recovers
const RECOVER = 0.3; // seconds to lift the foot back after a slam
const SLAM_T = 0.14; // seconds of the foot coming down

export type StompPhase = 'idle' | 'raise' | 'slam' | 'recover';

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export class Warden {
  s = 0;
  lateral = 0;
  speed = 0;
  gaitPhase = 0;
  attention = 0;
  emissiveSurge = 0;
  lungeT = 0; // reserved for hand sweeps (rig reads)

  // ---- stomp ----
  stompPhase: StompPhase = 'idle';
  stompLeg: 'L' | 'R' = 'R';
  targetLat = 0;
  targetS = 0;
  stompT = 0;
  stompCd = 0;
  windup = 0.8; // current windup length (for telegraph progress)
  telegraphProgress = 0; // 0..1 while the foot is raised
  slamEvent = false; // true the frame a slam lands (engine consumes)

  reset(startGap: number) {
    this.s = -startGap;
    this.lateral = 0;
    this.speed = 0;
    this.gaitPhase = 0;
    this.attention = 0;
    this.emissiveSurge = 0;
    this.stompPhase = 'idle';
    this.stompLeg = 'R';
    this.targetLat = 0;
    this.targetS = 0;
    this.stompT = 0;
    this.stompCd = 1.1; // first stomp ~1s in
    this.telegraphProgress = 0;
    this.slamEvent = false;
  }

  gapTo(heroS: number): number {
    return heroS - this.s;
  }

  get stomping(): boolean {
    return this.stompPhase !== 'idle';
  }

  update(
    dt: number,
    heroS: number,
    heroLateral: number,
    heroLatVel: number,
    heroSpeed: number,
    interval: number,
    windup: number,
    leadTime: number,
    avenueHalf: number,
  ) {
    this.slamEvent = false;

    // loom behind; LUNGE forward while stomping so a foot can reach the hero, then
    // recover — the giant surging in to slam reads as menace + a fair dodge window
    const gapNow = this.stomping ? STOMP_GAP : LOOM_GAP;
    const targetS = heroS - gapNow;
    this.s += (targetS - this.s) * (1 - Math.exp(-dt / 0.22));
    this.speed += (heroSpeed - this.speed) * (1 - Math.exp(-dt / 0.3));
    this.lateral += (heroLateral - this.lateral) * (1 - Math.exp(-dt / 0.45));

    // locomotion gait (legs shuffle) + always-watching attention
    const cadence = clamp(0.45 + heroSpeed * 0.01, 0.45, 0.78);
    this.gaitPhase = (this.gaitPhase + cadence * dt) % 1;
    this.attention += (0.85 - this.attention) * (1 - Math.exp(-dt / 0.5));

    // stomp state machine
    switch (this.stompPhase) {
      case 'idle':
        this.stompCd -= dt;
        if (this.stompCd <= 0) {
          this.stompLeg = this.stompLeg === 'R' ? 'L' : 'R';
          // aim at the hero's PREDICTED lateral (dodge window = windup)
          this.targetLat = clamp(heroLateral + heroLatVel * leadTime, -avenueHalf + 1, avenueHalf - 1);
          this.targetS = heroS - 0.5;
          this.windup = windup;
          this.stompT = windup;
          this.telegraphProgress = 0;
          this.stompPhase = 'raise';
          this.emissiveSurge = 1;
        }
        break;
      case 'raise':
        this.stompT -= dt;
        this.telegraphProgress = clamp(1 - this.stompT / this.windup, 0, 1);
        if (this.stompT <= 0) {
          this.stompPhase = 'slam';
          this.stompT = SLAM_T;
          this.slamEvent = true;
          this.emissiveSurge = 1;
        }
        break;
      case 'slam':
        this.stompT -= dt;
        if (this.stompT <= 0) {
          this.stompPhase = 'recover';
          this.stompT = RECOVER;
        }
        break;
      case 'recover':
        this.stompT -= dt;
        if (this.stompT <= 0) {
          this.stompPhase = 'idle';
          this.stompCd = interval;
          this.telegraphProgress = 0;
        }
        break;
    }

    if (this.emissiveSurge > 0) this.emissiveSurge = Math.max(0, this.emissiveSurge - dt / 0.4);
  }

  /** Foot height (world y) of the stomping foot for the current phase. */
  stompFootY(): number {
    if (this.stompPhase === 'raise') return 13;
    if (this.stompPhase === 'slam') return 13 * (this.stompT / SLAM_T);
    if (this.stompPhase === 'recover') return 13 * (1 - this.stompT / RECOVER);
    return 0;
  }
}
