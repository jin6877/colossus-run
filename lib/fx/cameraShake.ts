/**
 * Trauma-based camera shake (reused from meteor-city, PROJECT.md 부록 A;
 * DESIGN §4.4). Amplitude scales with trauma^2 and decays at 1.5/s. Unlike
 * meteor-city (which applied it after OrbitControls), our custom chase camera
 * asks for the offset at the END of its own update and adds it — so the shake
 * rides on top of the smoothed rig without being overwritten. Rotation-led with
 * a small positional nudge; deliberately restrained so captures aren't wrecked.
 * A separate low-frequency roll sway is layered in at extreme proximity ("a huge
 * thing is beside you, pressing the air").
 */
import type { Camera, Vector3 } from 'three';

export class CameraShake {
  private trauma = 0;
  private t = 0;
  private maxPos = 0.55;
  private maxRot = 0.045;
  /** extra low-frequency roll amplitude (radians), set from proximity each frame */
  swayAmp = 0;

  add(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  get value() {
    return this.trauma;
  }

  /**
   * Advance the shake and apply it to the camera. Call at the very end of the
   * chase-camera update. Writes the positional offset into offsetOut for debug.
   */
  apply(camera: Camera, dt: number, offsetOut: Vector3) {
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    this.t += dt;
    const s = this.trauma * this.trauma;

    let roll = 0;
    if (s > 0.0001) {
      const nx = Math.sin(this.t * 47.3) * Math.sin(this.t * 19.7);
      const ny = Math.sin(this.t * 53.1 + 1.3) * Math.sin(this.t * 23.2);
      const nz = Math.sin(this.t * 41.7 + 2.1) * Math.sin(this.t * 17.1);
      offsetOut.set(nx * this.maxPos * s, ny * this.maxPos * s, nz * this.maxPos * s);
      camera.position.add(offsetOut);
      roll += nz * this.maxRot * s;
    } else {
      offsetOut.set(0, 0, 0);
    }

    // low-frequency dread sway (DESIGN §4.4, p>0.85)
    if (this.swayAmp > 0.00001) {
      roll += Math.sin(this.t * 0.8 * Math.PI * 2) * this.swayAmp;
    }
    if (roll !== 0) camera.rotateZ(roll);
  }
}
