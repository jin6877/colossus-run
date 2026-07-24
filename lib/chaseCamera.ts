/**
 * Chase camera — 3/4 OVER-SHOULDER rear rig (user override of the reversed cam).
 * It sits behind + above the fleeing hero and looks FORWARD down the course, so
 * the road ahead fills the upper frame (you see obstacles coming) while the hero
 * sits low/back and the ~4m predator — following on the hero's heels — stays in
 * frame just behind/below them. Core tension reads in one shot: dodge the road
 * ahead + juke the claw behind. Framerate-independent exponential smoothing kills
 * jitter; the death-cam swings to a 3/4 side angle as the claw comes down.
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
  proximity: number; // 0..1 incoming-swipe threat (drives a little pull-back)
  wardenX: number;
  wardenZ: number;
  dying: boolean;
  deathT: number; // seconds since death began
  shake: CameraShake;
}

const BACK = 7.2; // camera this far BEHIND the hero (up-course) — past the warden
const HEIGHT = 3.2; // up enough to see over the hero + the road ahead
const SHOULDER = 1.5; // side offset -> 3/4 over-shoulder view
const LOOK_AHEAD = 9; // aim this far down-course -> forward road gets the headroom
const LOOK_UP = 1.4; // lift the aim toward the horizon (hero sits low in frame)

export class ChaseCamera {
  private pos = new Vector3();
  private aim = new Vector3();
  private inited = false;
  private _off = new Vector3();
  private _desPos = new Vector3();
  private _desAim = new Vector3();

  reset() {
    this.inited = false;
  }

  update(camera: PerspectiveCamera, dt: number, ctx: ChaseContext) {
    const { frame, proximity: p } = ctx;
    const tx = frame.tx;
    const tz = frame.tz;
    const rx = frame.rx;
    const rz = frame.rz;

    if (!ctx.dying) {
      // as the claw closes, ease the camera back + up so the swipe stays visible
      const back = BACK + p * 1.8;
      const height = HEIGHT + p * 0.8;
      // behind the hero (−T), shouldered, up — looking forward down the course
      this._desPos.set(
        ctx.heroX - tx * back + rx * SHOULDER,
        ctx.heroY + height,
        ctx.heroZ - tz * back + rz * SHOULDER,
      );
      // aim ahead of the hero (+T) + up toward the horizon, with a little steer lead
      this._desAim.set(
        ctx.heroX + tx * LOOK_AHEAD + rx * ctx.steer * 2.0,
        ctx.heroY + LOOK_UP,
        ctx.heroZ + tz * LOOK_AHEAD + rz * ctx.steer * 2.0,
      );

      if (!this.inited) {
        this.pos.copy(this._desPos);
        this.aim.copy(this._desAim);
        this.inited = true;
      }
      const ap = 1 - Math.exp(-dt / CAM.tauPos);
      const ar = 1 - Math.exp(-dt / CAM.tauRot);
      this.pos.lerp(this._desPos, ap);
      this.aim.lerp(this._desAim, ar);
      camera.position.copy(this.pos);
      camera.lookAt(this.aim);

      // fov: base + speed ramp + a touch wider during a swipe (see more to dodge)
      const speedK = MathUtils.clamp((ctx.speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN), 0, 1);
      const fov = 62 + speedK * 6 + p * 4;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      ctx.shake.swayAmp = p > 0.6 ? ((p - 0.6) / 0.4) * ((0.5 * Math.PI) / 180) : 0;
    } else {
      // death-cam: swing beside + slightly below the hero, framing the predator
      // rearing over them as the claw slams down (small crane for a ~4m creature)
      const k = MathUtils.clamp(ctx.deathT / 0.9, 0, 1);
      this._desPos.set(
        ctx.heroX + rx * 4 + tx * 1.5,
        ctx.heroY + 1.0,
        ctx.heroZ + rz * 4 + tz * 1.5,
      );
      const ax = ctx.wardenX + (ctx.heroX - ctx.wardenX) * 0.5;
      const az = ctx.wardenZ + (ctx.heroZ - ctx.wardenZ) * 0.5;
      this._desAim.set(ax, ctx.heroY + 1.6 + k * 2.4, az);
      const fov = 66;
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

    // shake offset added last (rides on the smoothed rig)
    ctx.shake.apply(camera, dt, this._off);
  }
}
