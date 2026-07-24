/**
 * Chase camera — GIANT-FRONTAL reversed rig (user override v3, back to the reversed
 * direction). The camera sits AHEAD of the fleeing hero (down-course) and looks
 * BACK + slightly down, so the hero runs TOWARD us and the ~4m organic predator —
 * right on the hero's heels — bears down from the FRONT, its claw swipe reading big
 * as it comes at the lens. Because the hero runs toward the camera, the road it is
 * about to step onto sits in the LOWER-FOREGROUND (between hero and lens); the rig
 * is pulled far enough back + up that this foreground road shows with time to react
 * to obstacles (which read by form + natural shadow, no color paint). Left/right is
 * mapped to SCREEN space (the engine flips input under this reversed cam) so steering
 * never feels inverted. Framerate-independent exponential smoothing kills jitter; the
 * death-cam swings to a 3/4 angle as the claw slams down.
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
  steer: number; // smoothed (screen-space) steer for look-lead
  speed: number;
  proximity: number; // 0..1 incoming-swipe threat (drives a small pull-back)
  wardenX: number;
  wardenZ: number;
  dying: boolean;
  deathT: number; // seconds since death began
  shake: CameraShake;
}

const FRONT = 11.5; // camera this far AHEAD of the hero (+T, down-course) — foreground road
const HEIGHT = 5.0; // up enough to see the foreground road + the predator behind the hero
const SHOULDER = 1.9; // side offset -> 3/4 so the predator isn't perfectly hidden by the hero
const AIM_BACK = 2.4; // pull the aim back past the hero (−T) so the predator centres in frame
const LOOK_UP = 1.9; // lift the aim toward the predator's head/upper body (4m creature)

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
      // as the claw closes, ease the camera back + up + a touch wider so the whole
      // swipe (and the foreground road) stays readable
      const front = FRONT + p * 3.0;
      const height = HEIGHT + p * 1.8;
      // AHEAD of the hero (+T), shouldered, up — looking BACK at the incoming predator
      this._desPos.set(
        ctx.heroX + tx * front + rx * SHOULDER,
        ctx.heroY + height,
        ctx.heroZ + tz * front + rz * SHOULDER,
      );
      // aim back past the hero (−T) + up toward the predator, with screen-space steer lead
      this._desAim.set(
        ctx.heroX - tx * AIM_BACK + rx * ctx.steer * 2.0,
        ctx.heroY + LOOK_UP + p * 0.8,
        ctx.heroZ - tz * AIM_BACK + rz * ctx.steer * 2.0,
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
      const fov = 62 + speedK * 6 + p * 5;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      ctx.shake.swayAmp = p > 0.6 ? ((p - 0.6) / 0.4) * ((0.5 * Math.PI) / 180) : 0;
    } else {
      // death-cam: swing to a 3/4 side angle, framing the predator rearing over the
      // caught hero as the claw slams down (small crane for a ~4m creature)
      const k = MathUtils.clamp(ctx.deathT / 0.9, 0, 1);
      this._desPos.set(
        ctx.heroX + rx * 4.2 - tx * 2.0,
        ctx.heroY + 1.4,
        ctx.heroZ + rz * 4.2 - tz * 2.0,
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
