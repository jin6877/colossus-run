/**
 * Chase camera — REVERSED (user override of the rear-cam design). The camera now
 * sits AHEAD of the fleeing hero and looks BACK + UP, so the warden fills the
 * frame, huge and overwhelming, looming over the hero who runs toward us. This
 * makes the giant the star and its stomping feet fully readable (the new core).
 * Left/right input is flipped by the engine so screen-space steering stays
 * intuitive. Framerate-independent exponential smoothing kills jitter; the
 * death-cam cranes UP the colossus as the foot/hand comes down.
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
  steer: number; // smoothed steer (screen-space) for look-lead
  speed: number;
  proximity: number; // 0..1 threat intensity (drives a little punch-in)
  wardenX: number;
  wardenZ: number;
  dying: boolean;
  deathT: number; // seconds since death began
  shake: CameraShake;
}

const FRONT_DIST = 10.5; // camera this far AHEAD of the fleeing hero (down-course)
const CAM_HEIGHT = 5.5; // up enough to see the hero + landing ground + the giant
const SHOULDER = 2.8; // side offset -> 3/4 view so the giant's legs don't hide the hero
const LOOK_UP = 3.8; // aim just above the hero (keeps it off the bottom edge), giant fills above
const AIM_BACK = 4; // pull the aim back toward the giant (behind the hero)

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
      // during a stomp the giant LUNGES in, so pull the camera BACK + UP + widen
      // the fov so the hero, the foot and the telegraph all stay in frame to dodge
      const back = FRONT_DIST + p * 7;
      const camH = CAM_HEIGHT + p * 4;
      // camera AHEAD of the hero (+T), up, shouldered — looking back at the giant
      this._desPos.set(
        head.x + tx * back + rx * SHOULDER,
        head.y + camH,
        head.z + tz * back + rz * SHOULDER,
      );
      // aim above + behind the hero (−T) so the looming warden centres in-frame;
      // steer lead is screen-space (engine already flipped input)
      this._desAim.set(
        head.x - tx * AIM_BACK + rx * ctx.steer * 1.4,
        head.y + LOOK_UP + p * 3,
        head.z - tz * AIM_BACK + rz * ctx.steer * 1.4,
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

      // fov: base + speed ramp + widen during a stomp (see more to dodge)
      const speedK = MathUtils.clamp((ctx.speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN), 0, 1);
      const fov = 64 + speedK * 6 + p * 7;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      ctx.shake.swayAmp = p > 0.6 ? (p - 0.6) / 0.4 * (0.5 * Math.PI / 180) : 0;
    } else {
      // death-cam: low, beside the hero, craning UP the colossus as it comes down
      const k = MathUtils.clamp(ctx.deathT / 0.9, 0, 1);
      this._desPos.set(head.x + rx * 5 + tx * 3, head.y + 1.6, head.z + rz * 5 + tz * 3);
      const ax = ctx.wardenX + (ctx.heroX - ctx.wardenX) * 0.4;
      const az = ctx.wardenZ + (ctx.heroZ - ctx.wardenZ) * 0.4;
      this._desAim.set(ax, head.y + 4 + k * 26, az);
      const fov = 74;
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
