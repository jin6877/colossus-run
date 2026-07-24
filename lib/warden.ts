/**
 * Warden controller — a ~4m AGILE PORCELAIN PREDATOR (user override of the 50m
 * titan + foot-stomp core). It is FAST: it rubber-bands right onto the fleeing
 * hero's heels and, on a tight cadence, rears an arm back (windup telegraph) and
 * SWIPES its claw across a locked lane band. Stand in that band at the strike and
 * you die; you must juke left/right — or hop a low rake / duck a high rake — OUT
 * of the locked band during the windup. Running straight = the swipe lands on you
 * = death (that's the whole point of this override). Pure logic (no three) so the
 * timing/aim is unit-testable; the rig reads gaitPhase / swipe state / attention
 * to drive the leg IK, the arm swipe, the head look-at and the cold crack glow.
 */

const FOLLOW_GAP = 4.2; // holds this close behind the hero (predator on the heels)
const ENGAGE_GAP = 7; // will open a swipe once within this
const STRIKE_GAP = 1.3; // lunges to ~here as the claw connects, then recovers
const STRIKE_T = 0.16; // seconds the claw sweeps across
const RECOVER = 0.32; // seconds to pull the arm back after a swipe

export type SwipePhase = 'idle' | 'windup' | 'strike' | 'recover';
/** 0 = mid rake (dodge = lateral), 1 = low rake (lateral OR jump), 2 = high rake (lateral OR slide). */
export type SwipeMode = 0 | 1 | 2;

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

  // ---- claw swipe ----
  swipePhase: SwipePhase = 'idle';
  swipeArm: 'L' | 'R' = 'R';
  swipeMode: SwipeMode = 0;
  swipeCount = 0;
  targetLat = 0; // locked lateral aim (center of the kill band)
  swipeT = 0;
  swipeCd = 0;
  windup = 0.7; // current windup length (telegraph)
  swipeProgress = 0; // 0..1 during windup (fill), then 0..1 across the strike
  strikeEvent = false; // true the frame the claw connects (engine consumes the kill check)
  lunge = 0; // 0..1 forward lunge amount (rig + gap)

  reset(startGap: number) {
    this.s = -startGap;
    this.lateral = 0;
    this.speed = 0;
    this.gaitPhase = 0;
    this.attention = 0;
    this.emissiveSurge = 0;
    this.swipePhase = 'idle';
    this.swipeArm = 'R';
    this.swipeMode = 0;
    this.swipeCount = 0;
    this.targetLat = 0;
    this.swipeT = 0;
    this.swipeCd = 0.9; // first swipe ~0.9s in — pressure comes fast
    this.windup = 0.7;
    this.swipeProgress = 0;
    this.strikeEvent = false;
    this.lunge = 0;
  }

  gapTo(heroS: number): number {
    return heroS - this.s;
  }

  /** True while a swipe is winding up or striking (telegraph visible / claw live). */
  get attacking(): boolean {
    return this.swipePhase === 'windup' || this.swipePhase === 'strike';
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
    this.strikeEvent = false;

    // rubber-band right onto the hero's heels; lunge in during a strike so the
    // claw actually reaches. Fast time-constant = an agile predator, not a lumbering
    // titan. It always at least matches the hero's speed, so it never falls away.
    const gapNow =
      this.swipePhase === 'strike'
        ? STRIKE_GAP - this.lunge * 1.0
        : this.attacking
        ? FOLLOW_GAP * 0.62
        : FOLLOW_GAP;
    const targetS = heroS - gapNow;
    this.s += (targetS - this.s) * (1 - Math.exp(-dt / 0.15));
    this.speed += (heroSpeed - this.speed) * (1 - Math.exp(-dt / 0.22));
    // body tracks the hero laterally (stays behind them), but the swipe's aim is
    // LOCKED at windup start so a late juke escapes it
    this.lateral += (heroLateral - this.lateral) * (1 - Math.exp(-dt / 0.28));

    // fast, light gait (agile) + always-watching attention
    const cadence = clamp(1.0 + heroSpeed * 0.03, 1.0, 2.2);
    this.gaitPhase = (this.gaitPhase + cadence * dt) % 1;
    this.attention += (0.92 - this.attention) * (1 - Math.exp(-dt / 0.35));

    const gap = heroS - this.s;

    // swipe state machine
    switch (this.swipePhase) {
      case 'idle':
        this.swipeCd -= dt;
        if (this.swipeCd <= 0 && gap <= ENGAGE_GAP) {
          this.swipeArm = this.swipeArm === 'R' ? 'L' : 'R';
          this.swipeMode = (this.swipeCount % 3) as SwipeMode;
          this.swipeCount++;
          // lock the aim at the hero's PREDICTED lane (dodge window = the windup)
          this.targetLat = clamp(
            heroLateral + heroLatVel * leadTime,
            -avenueHalf + 0.6,
            avenueHalf - 0.6,
          );
          this.windup = windup;
          this.swipeT = windup;
          this.swipeProgress = 0;
          this.swipePhase = 'windup';
          this.emissiveSurge = 1;
        }
        break;
      case 'windup':
        this.swipeT -= dt;
        this.swipeProgress = clamp(1 - this.swipeT / this.windup, 0, 1);
        if (this.swipeT <= 0) {
          this.swipePhase = 'strike';
          this.swipeT = STRIKE_T;
          this.strikeEvent = true; // engine resolves the kill on this frame
          this.emissiveSurge = 1;
        }
        break;
      case 'strike':
        this.swipeT -= dt;
        this.swipeProgress = clamp(1 - this.swipeT / STRIKE_T, 0, 1);
        this.lunge = Math.sin(this.swipeProgress * Math.PI); // 0 -> 1 -> 0 lunge
        if (this.swipeT <= 0) {
          this.swipePhase = 'recover';
          this.swipeT = RECOVER;
          this.lunge = 0;
        }
        break;
      case 'recover':
        this.swipeT -= dt;
        if (this.swipeT <= 0) {
          this.swipePhase = 'idle';
          this.swipeCd = interval;
          this.swipeProgress = 0;
        }
        break;
    }

    if (this.emissiveSurge > 0) this.emissiveSurge = Math.max(0, this.emissiveSurge - dt / 0.4);
  }
}
