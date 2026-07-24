/**
 * Input manager (PROJECT.md §2). Keyboard + pointer/touch, unified so a single
 * HeroInput snapshot is consumed once per fixed step (§0). Edge events (jump,
 * dash) are latched and cleared on consume so a fast tap is never dropped between
 * fixed steps; steer + slide are held/analog. Mobile: horizontal drag steers,
 * a quick up-flick jumps, a down-flick slides, and the HUD dash button / double-
 * tap space dashes. All listeners are passive and attach to a single element.
 */
import type { HeroInput } from './hero';

export class InputManager {
  private leftHeld = false;
  private rightHeld = false;
  private kbSlide = false;
  private jumpLatched = false;
  private dashLatched = false;

  private pointerId: number | null = null;
  private downX = 0;
  private downY = 0;
  private downT = 0;
  private steerPointer = 0;
  private manualSteer = 0; // programmatic steer (verify harness / assist)
  private slideUntil = 0;
  private lastSpaceTap = 0;

  private el: HTMLElement | Window | null = null;
  enabled = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.leftHeld = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.rightHeld = true;
        break;
      case 'Space':
      case 'ArrowUp':
      case 'KeyW': {
        if (!e.repeat) {
          const now = performance.now();
          if (e.code === 'Space' && now - this.lastSpaceTap < 260) this.dashLatched = true;
          else this.jumpLatched = true;
          this.lastSpaceTap = now;
        }
        e.preventDefault();
        break;
      }
      case 'ArrowDown':
      case 'KeyS':
      case 'ControlLeft':
      case 'ControlRight':
        this.kbSlide = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        if (!e.repeat) this.dashLatched = true;
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.leftHeld = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.rightHeld = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
      case 'ControlLeft':
      case 'ControlRight':
        this.kbSlide = false;
        break;
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    if (!this.enabled || this.pointerId !== null) return;
    // ignore taps that start on a HUD control (dash/jump/slide buttons)
    const t = e.target as HTMLElement | null;
    if (t && typeof t.closest === 'function' && t.closest('button, [data-control]')) return;
    this.pointerId = e.pointerId;
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.downT = performance.now();
    this.steerPointer = 0;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    this.steerPointer = Math.max(-1, Math.min(1, dx / 90));
    // fast up-flick -> jump; down-flick -> slide pulse
    const dt = performance.now() - this.downT;
    if (dt < 260) {
      if (dy < -46) {
        this.jumpLatched = true;
        this.downT = 0; // consume this gesture
      } else if (dy > 46) {
        this.slideUntil = performance.now() + 520;
        this.downT = 0;
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    this.steerPointer = 0;
  };

  attach(el: HTMLElement | Window) {
    this.detach();
    this.el = el;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    const t = el as HTMLElement;
    t.addEventListener('pointerdown', this.onPointerDown as EventListener);
    t.addEventListener('pointermove', this.onPointerMove as EventListener);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  detach() {
    if (!this.el) return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    const t = this.el as HTMLElement;
    t.removeEventListener?.('pointerdown', this.onPointerDown as EventListener);
    t.removeEventListener?.('pointermove', this.onPointerMove as EventListener);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.el = null;
  }

  // ---- HUD/mobile button hooks ----
  queueJump() {
    this.jumpLatched = true;
  }
  queueDash() {
    this.dashLatched = true;
  }
  setSlide(on: boolean) {
    if (on) this.slideUntil = performance.now() + 100000;
    else this.slideUntil = 0;
  }
  setSteer(v: number) {
    this.manualSteer = Math.max(-1, Math.min(1, v));
  }

  /** Consume the current input for one fixed step (clears the latched edges). */
  consume(out: HeroInput): HeroInput {
    let steer = 0;
    if (this.leftHeld) steer -= 1;
    if (this.rightHeld) steer += 1;
    if (steer === 0) steer = this.steerPointer || this.manualSteer;
    out.steer = Math.max(-1, Math.min(1, steer));
    out.jump = this.jumpLatched;
    out.dash = this.dashLatched;
    out.slideHeld = this.kbSlide || performance.now() < this.slideUntil;
    this.jumpLatched = false;
    this.dashLatched = false;
    return out;
  }
}
