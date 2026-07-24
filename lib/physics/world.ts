/**
 * Rapier world lifecycle + fixed-timestep accumulator (reused from meteor-city,
 * PROJECT.md 부록 A). Physics is decoupled from render fps: we accumulate real
 * delta * timeScale and step in fixed 1/60 increments. Slow-mo is just a smaller
 * timeScale (death-cam). colossus-run only needs the world for spectacle debris
 * — the hero/warden are kinematic and game collision is curated AABBs (§3), so
 * the only static collider is a big ground plate that follows the player.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { GRAVITY, FIXED_DT } from '../constants';

type RWorld = InstanceType<typeof RAPIER.World>;
type RBody = InstanceType<typeof RAPIER.RigidBody>;

let inited = false;

/** Idempotent WASM init. Must resolve before any world/body is created. */
export async function initRapier(): Promise<void> {
  if (inited) return;
  await RAPIER.init();
  inited = true;
}

export function rapierReady(): boolean {
  return inited;
}

export function makeWorld(): RWorld {
  return new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
}

/**
 * A large fixed ground plate that debris rests on. Because the course runs
 * forward forever, we recenter it under the player each frame — a 4km plate is
 * always big enough to catch every active chunk in the load window.
 */
export class GroundPlate {
  private body: RBody;
  constructor(world: RWorld) {
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1, 0),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(2000, 1, 2000).setFriction(0.95).setRestitution(0.0),
      this.body,
    );
  }
  follow(x: number, z: number) {
    this.body.setTranslation({ x, y: -1, z }, false);
  }
}

const MAX_SUBSTEPS = 5;

/** Fixed-timestep accumulator. fn is invoked once per fixed sub-step. */
export class FixedStepper {
  private acc = 0;
  reset() {
    this.acc = 0;
  }
  step(delta: number, timeScale: number, fn: (dt: number) => void) {
    // clamp huge deltas (tab switch) to avoid the spiral of death
    this.acc += Math.min(delta, 0.1) * timeScale;
    let n = 0;
    while (this.acc >= FIXED_DT && n < MAX_SUBSTEPS) {
      fn(FIXED_DT);
      this.acc -= FIXED_DT;
      n++;
    }
    if (n >= MAX_SUBSTEPS) this.acc = 0;
  }
}
