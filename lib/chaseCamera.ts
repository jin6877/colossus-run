/**
 * Chase camera (PROJECT.md §7, DESIGN §4) — the game's signature and the answer
 * to the "how do you show the monster behind you" problem. A custom rig (NOT
 * OrbitControls): behind the hero, looking FORWARD. As the warden closes, the
 * proximity p interpolates the rig so the camera pulls back and tilts UP — the
 * warden rises into the top third of the frame — while shake / vignette / the
 * forward-cast shadow do the rest, so the player never needs to look back.
 * Framerate-independent exponential smoothing (a = 1 - exp(-dt/τ)) kills jitter;
 * death-cam swings to a 3/4 rear angle as the hand comes down.
 */
import { PerspectiveCamera, Vector3, MathUtils } from 'three';
import { CAM } from './constants';
import { SPEED_MIN, SPEED_MAX } from './difficulty';
import type { Frame } from './course';
import type { CameraShake } from './fx/cameraShake';

export interface ChaseContext {
  frame: Frame; // hero moving frame
  heroX: number;
  heroZ: number;
  heroY: number; // head height incl. jump
  steer: number; // smoothed steer for look-lead
  speed: number;
  proximity: number; // p in [0,1]
  wardenX: number;
  wardenZ: number;
  dying: boolean;
  deathT: number; // seconds since death began
  shake: CameraShake;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class ChaseCamera {
  private pos = new Vector3();
  private aim = new Vector3();
  private inited = false;
  private _off = new Vector3();
  private _desPos = new Vector3();
  private _desAim = new Vector3();
  private _tmp = new Vector3();

  reset() {
    this.inited = false;
  }

  update(camera: PerspectiveCamera, dt: number, ctx: ChaseContext) {
    const { frame, proximity: p } = ctx;
    const tx = frame.tx;
    const tz = frame.tz;
    const rx = frame.rx;
    const rz = frame.rz;

    const head = this._tmp.set(ctx.heroX, ctx.heroY, ctx.heroZ);

    if (!ctx.dying) {
      // ---- rig params interpolated by proximity ----
      const back = lerp(CAM.distanceBackFar, CAM.distanceBackNear, p);
      const height = lerp(CAM.heightFar, CAM.heightNear, p);
      const pitch = lerp(CAM.pitchFar, CAM.pitchNear, p);

      // desired position: behind the hero, up, shouldered to one side
      this._desPos.set(
        head.x - tx * back + rx * CAM.shoulder,
        head.y + height,
        head.z - tz * back + rz * CAM.shoulder,
      );

      // aim point: ahead of the hero, lifted, with steer lead
      this._desAim.set(
        head.x + tx * 4 + rx * ctx.steer * 1.5,
        head.y + 0.2,
        head.z + tz * 4 + rz * ctx.steer * 1.5,
      );

      if (!this.inited) {
        this.pos.copy(this._desPos);
        this.aim.copy(this._desAim);
        this.inited = true;
      }
      // extreme proximity pull-back snaps faster (DESIGN §7.4)
      const tauPos = p > 0.85 ? CAM.tauPosSnap : CAM.tauPos;
      const ap = 1 - Math.exp(-dt / tauPos);
      const ar = 1 - Math.exp(-dt / CAM.tauRot);
      this.pos.lerp(this._desPos, ap);
      this.aim.lerp(this._desAim, ar);

      camera.position.copy(this.pos);

      // build a forward dir then apply pitch about the right axis (tilt up at near)
      const dir = this._off.copy(this.aim).sub(this.pos).normalize();
      // rotate dir about the right axis (rx,0,rz) by `pitch`
      applyPitch(dir, rx, rz, pitch);
      camera.lookAt(this.pos.x + dir.x, this.pos.y + dir.y, this.pos.z + dir.z);

      // ---- fov: base interp + speed ramp (DESIGN §7.1) ----
      const speedK = MathUtils.clamp(
        (ctx.speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN),
        0,
        1,
      );
      const fov = lerp(CAM.fovFar, CAM.fovNear, p) + speedK * 8;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }

      // low-frequency dread sway at extreme proximity (DESIGN §4.4)
      ctx.shake.swayAmp = p > 0.85 ? (p - 0.85) / 0.15 * (0.4 * Math.PI / 180) : 0;
    } else {
      // ---- death-cam: 3/4 rear angle, low, craning UP the towering colossus ----
      const k = MathUtils.clamp(ctx.deathT / 0.9, 0, 1);
      const ang = 2.4; // ~137° behind, to the side
      const dist = 13;
      const dirX = Math.sin(ang) * rx + Math.cos(ang) * -tx;
      const dirZ = Math.sin(ang) * rz + Math.cos(ang) * -tz;
      this._desPos.set(head.x + dirX * dist, head.y + 2.2, head.z + dirZ * dist);
      // crane the aim from the hero UP the warden's body toward its descending
      // mask/hand — the giant fills the frame as it comes down (DESIGN §4.6)
      const ax = ctx.wardenX + (ctx.heroX - ctx.wardenX) * 0.35;
      const az = ctx.wardenZ + (ctx.heroZ - ctx.wardenZ) * 0.35;
      this._desAim.set(ax, head.y + 3 + k * 24, az);
      const fov = 70;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      const a = 1 - Math.exp(-dt / CAM.tauPosSnap);
      this.pos.lerp(this._desPos, a);
      this.aim.lerp(this._desAim, a);
      camera.position.copy(this.pos);
      camera.lookAt(this.aim);
      ctx.shake.swayAmp = 0;
    }

    // shake offset added last (rides on the smoothed rig, DESIGN §4.4)
    ctx.shake.apply(camera, dt, this._off);
  }
}

/** Rotate a unit direction about the horizontal right axis k=(rx,0,rz) by `ang`. */
function applyPitch(dir: Vector3, rx: number, rz: number, ang: number) {
  // Rodrigues rotation: d' = d cosθ + (k×d) sinθ + k (k·d)(1-cosθ)
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const dx = dir.x;
  const dy = dir.y;
  const dz = dir.z;
  const kd = rx * dx + rz * dz; // k·d (ky = 0)
  const crx = -rz * dy; // (k×d).x  = ky*dz - kz*dy = -rz*dy
  const cry = rz * dx - rx * dz; // (k×d).y  = kz*dx - kx*dz
  const crz = rx * dy; // (k×d).z  = kx*dy - ky*dx = rx*dy
  dir.x = dx * c + crx * s + rx * kd * (1 - c);
  dir.y = dy * c + cry * s;
  dir.z = dz * c + crz * s + rz * kd * (1 - c);
  dir.normalize();
}
