/**
 * Hero controller (PROJECT.md §3) — a custom KINEMATIC runner, not a Rapier
 * dynamic body. The world position is P(s) + lateralOffset·N(s) + up·yJump; the
 * player only steers/evades, the game owns forward speed. Game collision is
 * curated obstacle volumes (§5), never the hundreds of debris bodies, so control
 * stays crisp and difficulty is "designed". Pure logic (no three) so the feel —
 * input buffering, coyote time, dash economy — is unit-testable.
 */
import type { Course } from './course';
import { GRAVITY } from './constants';

export interface HeroInput {
  steer: number; // analog target, -1 (left) .. +1 (right)
  jump: boolean; // rising edge this step
  slideHeld: boolean;
  dash: boolean; // rising edge this step
}

const MARGIN = 1.3; // keep-off from the avenue edge
const STEER_SPEED = 15; // max lateral speed (m/s)
const STEER_TAU = 0.08; // lateral velocity smoothing time
const MAX_LEAN = 0.5; // radians of body roll into a turn
const JUMP_V = 8.8; // ~1.5m apex under GRAVITY=-26
const SLIDE_TIME = 0.62;
const DASH_BOOST = 15; // extra m/s during a dash
const DASH_TIME = 0.34;
const DASH_CD = 2.0;
const DASH_COST = 0.5; // stamina fraction per dash
const JUMP_BUFFER = 0.12; // pre-land jump grace
const COYOTE = 0.1; // post-ledge jump grace
const STAMINA_REGEN = 0.34; // per second

export class Hero {
  s = 0;
  lateral = 0;
  private lateralVel = 0;
  yJump = 0;
  private vJump = 0;
  grounded = true;
  sliding = false;
  private slideT = 0;
  lean = 0;
  phase = 0; // run cycle [0,1)
  speed = 0; // effective forward speed this step
  stamina = 1;
  dashCd = 0;
  private dashT = 0;
  private jumpBufferT = 0;
  private coyoteT = COYOTE;
  private grazeSlowT = 0;
  stumbleT = 0; // drives the stumble pose after a graze
  steerVis = 0; // smoothed steer for lean/camera lead

  reset() {
    this.s = 0;
    this.lateral = 0;
    this.lateralVel = 0;
    this.yJump = 0;
    this.vJump = 0;
    this.grounded = true;
    this.sliding = false;
    this.slideT = 0;
    this.lean = 0;
    this.phase = 0;
    this.speed = 0;
    this.stamina = 1;
    this.dashCd = 0;
    this.dashT = 0;
    this.jumpBufferT = 0;
    this.coyoteT = COYOTE;
    this.grazeSlowT = 0;
    this.stumbleT = 0;
    this.steerVis = 0;
  }

  get dashing(): boolean {
    return this.dashT > 0;
  }
  /** Current lateral velocity (m/s, + = right) — for the warden's predictive aim. */
  get lateralVelocity(): number {
    return this.lateralVel;
  }
  /** Dash cooldown as a 0..1 fill (for the HUD radial). */
  get dashReady(): number {
    return this.dashCd <= 0 ? 1 : 1 - this.dashCd / DASH_CD;
  }

  /** Local collision box (relative to the ground point) — y range + half width. */
  collision(): { yBottom: number; yTop: number; halfW: number } {
    const base = this.yJump;
    const top = base + (this.sliding ? 0.85 : 1.8);
    return { yBottom: base, yTop: top, halfW: 0.6 };
  }

  /** A graze: brief slowdown + stumble pose (warden closes the gap). */
  graze() {
    this.grazeSlowT = Math.max(this.grazeSlowT, 0.45);
    this.stumbleT = Math.max(this.stumbleT, 0.5);
  }

  update(dt: number, input: HeroInput, course: Course, baseSpeed: number) {
    // ---- timers ----
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.dashT > 0) this.dashT -= dt;
    if (this.grazeSlowT > 0) this.grazeSlowT -= dt;
    if (this.stumbleT > 0) this.stumbleT -= dt;
    if (this.jumpBufferT > 0) this.jumpBufferT -= dt;
    if (!this.dashing) this.stamina = Math.min(1, this.stamina + STAMINA_REGEN * dt);

    // ---- dash ----
    if (input.dash && this.dashCd <= 0 && this.stamina >= DASH_COST) {
      this.dashT = DASH_TIME;
      this.dashCd = DASH_CD;
      this.stamina -= DASH_COST;
    }
    const dashBoost = this.dashing ? DASH_BOOST * (this.dashT / DASH_TIME) : 0;

    // ---- forward motion ----
    let speed = baseSpeed + dashBoost;
    if (this.grazeSlowT > 0) speed *= 0.58; // graze penalty lets the warden close
    this.speed = speed;
    this.s += speed * dt;

    // ---- steering (inertial toward target lateral velocity, then integrate) ----
    const steer = Math.max(-1, Math.min(1, input.steer));
    this.steerVis += (steer - this.steerVis) * (1 - Math.exp(-dt / 0.1));
    const targetVel = steer * STEER_SPEED;
    const a = 1 - Math.exp(-dt / STEER_TAU);
    this.lateralVel += (targetVel - this.lateralVel) * a;
    this.lateral += this.lateralVel * dt;
    const hw = course.halfWidth(this.s) - MARGIN;
    if (this.lateral > hw) {
      this.lateral = hw;
      this.lateralVel = Math.min(0, this.lateralVel);
    } else if (this.lateral < -hw) {
      this.lateral = -hw;
      this.lateralVel = Math.max(0, this.lateralVel);
    }
    this.lean += (steer * MAX_LEAN - this.lean) * (1 - Math.exp(-dt / 0.1));

    // ---- jump (buffered + coyote) ----
    if (input.jump) this.jumpBufferT = JUMP_BUFFER;
    if (this.grounded) this.coyoteT = COYOTE;
    else if (this.coyoteT > 0) this.coyoteT -= dt;
    if (this.jumpBufferT > 0 && (this.grounded || this.coyoteT > 0)) {
      this.vJump = JUMP_V;
      this.grounded = false;
      this.jumpBufferT = 0;
      this.coyoteT = 0;
      this.sliding = false;
    }

    // ---- slide (grounded only) ----
    if (input.slideHeld && this.grounded && !this.sliding) {
      this.sliding = true;
      this.slideT = SLIDE_TIME;
    }
    if (this.sliding) {
      this.slideT -= dt;
      if (this.slideT <= 0 || !input.slideHeld) this.sliding = false;
    }

    // ---- vertical integration ----
    if (!this.grounded) {
      this.vJump += GRAVITY * dt;
      this.yJump += this.vJump * dt;
      if (this.yJump <= 0) {
        this.yJump = 0;
        this.vJump = 0;
        this.grounded = true;
      }
    }

    // ---- run-cycle phase (cadence ∝ speed) ----
    const stride = 4.2;
    this.phase = (this.phase + (speed / stride) * dt) % 1;
    if (this.phase < 0) this.phase += 1;
  }
}
