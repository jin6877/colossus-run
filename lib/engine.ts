/**
 * Engine — the imperative orchestrator outside React state (PROJECT.md 임퍼러티브
 * 경계). React owns the Canvas + lighting; one <EngineRunner> calls
 * engine.update(delta, camera) inside useFrame. Everything high-frequency — the
 * fixed-step hero/warden sim, chunk streaming, warden-driven destruction, debris,
 * fx, camera — happens here and never triggers a React re-render.
 *
 * CORE (user override): a ~4m AGILE PREDATOR chases on the hero's heels under a
 * 3/4 over-shoulder camera that shows the road AHEAD. Two tensions run at once:
 *   1. dodge the FORWARD obstacles (cars, debris, gaps, barriers) — read by form
 *      + natural shadow, no color paint;
 *   2. juke the warden's CLAW SWIPE — it locks a lane band, telegraphs a ground
 *      rake, then strikes: stand in the band (i.e. run straight) and you die.
 * Missing an obstacle grazes you → the predator closes → the claw lands. Running
 * straight is lethal by design.
 */
import { Group, Vector3, PerspectiveCamera } from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { initRapier, makeWorld, GroundPlate, FixedStepper } from './physics/world';
import { DebrisSystem } from './physics/debrisPool';
import { FXManager } from './fx/fx';
import { CameraShake } from './fx/cameraShake';
import { ChaseCamera } from './chaseCamera';
import { Course, makeFrame, type Frame } from './course';
import { ChunkManager } from './chunk/chunkManager';
import type { BuildingInfo } from './chunk/chunkTypes';
import { Hero, type HeroInput } from './hero';
import { Warden } from './warden';
import { buildHeroRig, applyHeroPose, type HeroParts } from './render/heroRig';
import { buildWardenRig, applyWardenPose, type WardenParts } from './render/wardenRig';
import { DustWall } from './render/dustWall';
import { ClawTelegraph } from './render/clawTelegraph';
import { speedAt, swipeIntervalAt, windupAt, leadTimeAt } from './difficulty';
import { InputManager } from './input';
import { CAM, SLOMO_SCALE } from './constants';
import type { QualityPreset } from './quality';

type RWorld = InstanceType<typeof RAPIER.World>;

export type GameState = 'title' | 'running' | 'dying' | 'gameover';
export type DeathReason = 'claw' | 'fall' | 'caught';

const R_DESTROY = 20; // warden street-clearing radius (only LOW structures — no tower topples)
const LOW_BUILDING_H = 14; // a 4m predator only shatters street-level structures below this
const START_GAP = 6; // the predator starts this close behind (eases onto the heels)
const TITLE_GAP = 6; // portrait framing
const HOT = 0x7c2408; // warm ember hot-color on fresh debris
const DEATH_TIME = 2.4; // seconds of death-cam before the result card

const SWIPE_HALF = 2.5; // lateral half-width of the claw kill band (matches the telegraph)
const HERO_HALF_W = 0.6; // hero lateral half-width for obstacle overlap
const STRIDE_DUST = 3.5; // warden kicks warm dust every this many metres it charges

export class Engine {
  readonly root = new Group();
  readonly fx: FXManager;
  readonly shake = new CameraShake();
  readonly bloom = { value: 0.25 };
  readonly input = new InputManager();

  heroPos = new Vector3();
  tangent = { x: 0, z: -1 };
  proximity = 0;

  private quality: QualityPreset;
  private world: RWorld | null = null;
  private ground: GroundPlate | null = null;
  private debris: DebrisSystem | null = null;
  private stepper = new FixedStepper();

  private course: Course | null = null;
  private chunks: ChunkManager | null = null;
  private hero = new Hero();
  private warden = new Warden();
  private heroRig: HeroParts;
  private wardenRig: WardenParts;
  private dustWall: DustWall;
  private clawTele: ClawTelegraph;

  private state: GameState = 'title';
  private simTime = 0;
  private timeScale = 1;
  private deathElapsed = 0;
  private fractureAcc = 0;
  private strideAcc = 0;
  private strideKick = false;
  private distance = 0;
  private bestDistance = 0;
  private caughtReason: DeathReason = 'claw';
  hitFlash = 0; // spikes on an obstacle graze (HUD red flash + shake)

  private _fr: Frame = makeFrame();
  private _fr2: Frame = makeFrame();
  private _fr3: Frame = makeFrame();
  private _input: HeroInput = { steer: 0, jump: false, slideHeld: false, dash: false };
  private _binfos: BuildingInfo[] = [];
  private _impact = new Vector3();
  private chase = new ChaseCamera();

  ready = false;
  seed = 0;
  onStateChange: ((s: GameState) => void) | null = null;

  constructor(quality: QualityPreset) {
    this.quality = quality;
    this.fx = new FXManager({ lowTier: quality.tier === 'low' });
    this.root.name = 'engine-root';
    this.root.add(this.fx.group);
    this.heroRig = buildHeroRig();
    this.wardenRig = buildWardenRig(quality.proceduralBoneQuality);
    this.dustWall = new DustWall(makeFrame());
    this.clawTele = new ClawTelegraph();
    this.root.add(this.heroRig.group);
    this.root.add(this.wardenRig.group);
    this.root.add(this.dustWall.mesh);
    this.root.add(this.clawTele.group);
  }

  async init() {
    await initRapier();
    this.world = makeWorld();
    this.ground = new GroundPlate(this.world);
    this.debris = new DebrisSystem(this.world, {
      activeCap: this.quality.activeCap,
      rubbleCap: this.quality.rubbleCap,
      castShadow: this.quality.debrisShadows,
    });
    this.root.add(this.debris.group);
    this.ready = true;
  }

  // ---- lifecycle ----
  setSeed(seed: number, best = 0) {
    this.seed = seed >>> 0;
    this.bestDistance = best;
    if (this.chunks) {
      this.root.remove(this.chunks.group);
      this.chunks.dispose();
    }
    this.debris?.reset();
    this.fx.clear();
    this.clawTele.hide();
    this.course = new Course(this.seed);
    this.chunks = new ChunkManager(this.course, this.seed, this.quality);
    this.root.add(this.chunks.group);
    this.chunks.preload(3);
    this.hero.reset();
    this.warden.reset(TITLE_GAP);
    this.state = 'title';
    this.timeScale = 1;
    this.deathElapsed = 0;
    this.distance = 0;
    this.proximity = 0;
    this.simTime = 0;
    this.hitFlash = 0;
    this.strideAcc = 0;
    this.stepper.reset();
  }

  preloadedChunks(): number {
    return this.chunks?.loadedCount ?? 0;
  }

  beginRun() {
    if (!this.course) return;
    this.hero.reset();
    this.warden.reset(START_GAP);
    this.input.enabled = true;
    this.state = 'running';
    this.timeScale = 1;
    this.deathElapsed = 0;
    this.fractureAcc = 0;
    this.strideAcc = 0;
    this.hitFlash = 0;
    this.clawTele.hide();
    this.onStateChange?.('running');
  }

  private triggerDeath(reason: DeathReason) {
    if (this.state !== 'running') return;
    this.caughtReason = reason;
    this.state = 'dying';
    this.timeScale = SLOMO_SCALE;
    this.deathElapsed = 0;
    this.input.enabled = false;
    this.shake.add(0.8);
    this.clawTele.hide();
    if (this.distance > this.bestDistance) this.bestDistance = this.distance;
    this.onStateChange?.('dying');
  }

  getState(): GameState {
    return this.state;
  }

  /** Force a death (verification harness only — deterministic death-cam). */
  forceDeath() {
    this.triggerDeath('claw');
  }

  getHud() {
    return {
      state: this.state,
      distance: this.distance,
      speedKmh: Math.round(this.hero.speed * 3.6),
      proximity: this.proximity,
      dashReady: this.hero.dashReady,
      stamina: this.hero.stamina,
      hitFlash: this.hitFlash,
    };
  }

  getResult() {
    return {
      distance: this.distance,
      best: this.bestDistance,
      seed: this.seed,
      reason: this.caughtReason,
      newBest: this.distance >= this.bestDistance,
    };
  }

  courseFingerprint(): number {
    if (!this.course) return 0;
    let acc = 0;
    for (let s = 0; s <= 2000; s += 50) {
      this.course.frame(s, this._fr);
      acc += this._fr.x * 1.7 + this._fr.z * 2.3 + this._fr.halfWidth * 5 + this._fr.heading * 11;
    }
    return Math.round(acc * 1000) / 1000;
  }

  getStats() {
    return {
      ready: this.ready,
      state: this.state,
      distance: this.distance,
      gap: this.warden.gapTo(this.hero.s),
      proximity: this.proximity,
      attacking: this.warden.attacking,
      chunks: this.chunks?.loadedCount ?? 0,
      debris: this.debris?.count ?? 0,
      rubble: this.debris?.rubble ?? 0,
    };
  }

  // ---- main loop ----
  update(delta: number, camera: PerspectiveCamera) {
    if (!this.ready || !this.course || !this.chunks) return;
    const d = Math.min(delta, 0.05);

    if (this.state === 'title') {
      this.updateTitle(d);
    } else {
      this.stepper.step(delta, this.timeScale, (dt) => this.fixedStep(dt));
      if (this.state === 'dying') {
        this.deathElapsed += d;
        if (this.deathElapsed >= DEATH_TIME) {
          this.state = 'gameover';
          this.onStateChange?.('gameover');
        }
      }
    }

    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - d / 0.35);
    this.renderActors(camera, d);
    this.bloom.value = Math.max(0.25, this.fx.bloomEnergy);
  }

  private updateTitle(dt: number) {
    this.simTime += dt;
    this.hero.s = 0;
    this.hero.phase = (this.hero.phase + 0.15 * dt) % 1;
    this.warden.s = -TITLE_GAP;
    this.warden.gaitPhase = (this.warden.gaitPhase + 0.28 * dt) % 1;
    this.warden.attention += (0.6 - this.warden.attention) * (1 - Math.exp(-dt / 1));
    this.warden.emissiveSurge = Math.max(0, this.warden.emissiveSurge - dt / 0.4);
    this.proximity = 0.12;
    this.chunks!.update(0);
  }

  private fixedStep(dt: number) {
    const course = this.course!;
    const chunks = this.chunks!;
    const world = this.world!;
    this.simTime += dt;

    if (this.state === 'running') {
      this.input.consume(this._input);
      // 3/4 over-shoulder camera looks forward, so screen-space steering is direct
      // again (no reversed-cam flip)
      this.distance = Math.floor(this.hero.s);
      const base = speedAt(this.distance);
      this.hero.update(dt, this._input, course, base);

      const avenueHalf = course.halfWidth(this.hero.s);
      this.warden.update(
        dt,
        this.hero.s,
        this.hero.lateral,
        this.hero.lateralVelocity,
        this.hero.speed,
        swipeIntervalAt(this.distance),
        windupAt(this.distance),
        leadTimeAt(this.distance),
        avenueHalf,
      );

      // a claw swipe connects: resolve the lateral-band kill (or a whiff + FX)
      if (this.warden.strikeEvent) this.resolveSwipe();

      // forward obstacle collisions (juke or graze; gaps are fatal)
      this.checkObstacles();

      // the charging predator kicks warm dust + shatters street-level structures it
      // plows past (4m scale: no tower topples — low buildings, props, debris)
      const wf = course.worldAt(this.warden.s, this.warden.lateral, this._fr);
      this.strideAcc += this.warden.speed * dt;
      if (this.strideAcc >= STRIDE_DUST) {
        this.strideAcc = 0;
        this.fx.strideDust([wf.x, 0.15, wf.z]);
        // every other stride, kick a chunk of street debris forward — the predator
        // plows through the road clutter (reliable 4m-scale destruction spectacle)
        this.strideKick = !this.strideKick;
        if (this.strideKick && this.debris) {
          this._impact.set(wf.x - this._fr.tx * 2, -1, wf.z - this._fr.tz * 2);
          this.debris.spawnFlyingChunk([wf.x, 0.35, wf.z], 0.55, 0x6b6660, this._impact);
        }
      }
      this.fractureAcc += this.quality.wardenFractureRate * dt;
      while (this.fractureAcc >= 1) {
        this.fractureAcc -= 1;
        this.fractureLowNear(wf.x, wf.z);
      }

      // proximity = incoming-swipe threat (drives the red vignette + camera ease-back)
      const target =
        this.warden.swipePhase === 'windup'
          ? this.warden.swipeProgress
          : this.warden.swipePhase === 'strike'
          ? 1
          : 0;
      this.proximity += (target - this.proximity) * (1 - Math.exp(-dt / 0.12));

      chunks.update(this.hero.s);
      const hw = course.worldAt(this.hero.s, this.hero.lateral, this._fr2);
      this.ground!.follow(hw.x, hw.z);
    } else if (this.state === 'dying') {
      // the predator rears over the caught hero (the pose reach drives the slash)
      this.warden.s += (this.hero.s - 1.6 - this.warden.s) * (1 - Math.exp(-dt / 0.35));
      this.warden.lateral += (this.hero.lateral - this.warden.lateral) * (1 - Math.exp(-dt / 0.3));
      this.warden.attention = 1;
      this.warden.emissiveSurge = Math.min(1, this.warden.emissiveSurge + dt);
    }

    world.step(this.eventQueue());
    this.debris?.update(this.simTime);
    this.fx.update(dt);
  }

  /** Resolve a claw swipe: kill if the hero is in the locked lane band un-dodged. */
  private resolveSwipe() {
    const course = this.course!;
    const dLat = Math.abs(this.hero.lateral - this.warden.targetLat);
    const sp = course.worldAt(this.hero.s, this.warden.targetLat, this._fr3);
    // claw rakes the ground: dust + a shallow rake decal + cold bloom spike
    this.fx.footfall([sp.x, 0.25, sp.z], 0.7, this.proximity);
    this.fx.coldSpike(1.1);
    this.shake.add(0.4);
    if (dLat < SWIPE_HALF) {
      // in the band — a mode-appropriate evade can still save you: mode 1 (low
      // rake) is hopped, mode 2 (high rake) is ducked; mode 0 is lateral-only
      const airborne = this.hero.yJump > 0.8;
      const sliding = this.hero.sliding;
      const dodged =
        (this.warden.swipeMode === 1 && airborne) || (this.warden.swipeMode === 2 && sliding);
      if (!dodged) this.triggerDeath('claw');
    }
  }

  /** Forward obstacle collisions in (s, lateral) space (PROJECT.md §3/§5). */
  private checkObstacles() {
    const hs = this.hero.s;
    const hl = this.hero.lateral;
    const yj = this.hero.yJump;
    this.chunks!.forEachObstacle((o) => {
      if (o.resolved) return;
      if (hs < o.sMin - 0.3 || hs > o.sMax + 0.3) return;
      if (Math.abs(hl - o.latCenter) > o.latHalf + HERO_HALF_W) return;
      switch (o.kind) {
        case 'gap':
          // a pit: grounded over it = you fall in (jump across to clear)
          if (yj < 0.5) {
            o.resolved = true;
            this.triggerDeath('fall');
          }
          break;
        case 'slide':
          // overhead bar / fallen beam: slide under it
          if (!this.hero.sliding && yj < 0.2) {
            o.resolved = true;
            this.grazeHit();
          }
          break;
        default:
          // vehicle / block / rubble / jump barrier — solid; clear its height or graze
          if (yj < o.yClear) {
            o.resolved = true;
            this.grazeHit();
          }
          break;
      }
    });
  }

  private grazeHit() {
    this.hero.graze();
    this.shake.add(0.35);
    this.hitFlash = 1;
  }

  private eventQueueInst: InstanceType<typeof RAPIER.EventQueue> | null = null;
  private eventQueue() {
    if (!this.eventQueueInst) this.eventQueueInst = new RAPIER.EventQueue(true);
    return this.eventQueueInst;
  }

  /** Shatter the nearest alive LOW building within R_DESTROY (street-level only). */
  private fractureLowNear(x: number, z: number) {
    if (!this.debris || !this.chunks) return;
    this.chunks.buildingsNear(x, z, R_DESTROY, this._binfos);
    if (this._binfos.length === 0) return;
    let best: BuildingInfo | null = null;
    let bestD = Infinity;
    for (const b of this._binfos) {
      if (b.size[1] > LOW_BUILDING_H) continue; // no tower topples at 4m scale
      const dx = b.center[0] - x;
      const dz = b.center[2] - z;
      const dd = dx * dx + dz * dz;
      if (dd < bestD) {
        bestD = dd;
        best = b;
      }
    }
    if (!best) return;
    const info = best;
    this.chunks.destroyBuilding(info.id);
    this._impact.set(info.center[0], Math.min(info.size[1] * 0.5, 6), info.center[2]);
    this.debris.fractureBuilding(
      info.center,
      info.size,
      info.color,
      this._impact,
      1.2,
      HOT,
      0.3,
      this.quality.chunksCoarse,
    );
    this.fx.collapse([info.center[0], info.size[1] * 0.5, info.center[2]], info.size[1] * 0.5 + 4);
    if (Math.random() < 0.2) this.fx.ignite([info.center[0], 1, info.center[2]], info.size[1] * 0.4);
  }

  private renderActors(camera: PerspectiveCamera, dt: number) {
    const course = this.course!;
    const hw = course.worldAt(this.hero.s, this.hero.lateral, this._fr);
    const headY = CAM.headY + this.hero.yJump;
    applyHeroPose(this.heroRig, this.hero, this._fr, hw.x, hw.z);
    this.heroPos.set(hw.x, headY, hw.z);
    this.tangent.x = this._fr.tx;
    this.tangent.z = this._fr.tz;

    const ww = course.worldAt(this.warden.s, this.warden.lateral, this._fr2);
    const dyingFrame = this.state === 'dying' || this.state === 'gameover';
    const reach = dyingFrame ? clamp01(this.deathElapsed / 0.9) : 0;

    // claw telegraph: a ground rake across the locked lane band, at the hero's row
    if (this.state === 'running' && this.warden.attacking) {
      const tp = course.worldAt(this.hero.s, this.warden.targetLat, this._fr3);
      const facing = Math.atan2(-this._fr3.tx, -this._fr3.tz);
      const prog = this.warden.swipePhase === 'windup' ? this.warden.swipeProgress : 1;
      this.clawTele.update(tp.x, tp.z, facing, SWIPE_HALF, prog);
    } else {
      this.clawTele.hide();
    }

    applyWardenPose(
      this.wardenRig,
      this.warden,
      this._fr2,
      ww.x,
      ww.z,
      hw.x,
      headY,
      hw.z,
      this.simTime,
      reach,
    );

    this.dustWall.update(course, this.warden.s, camera, this.proximity);

    if (this.state === 'title') {
      this.titleCam(camera, hw.x, hw.z, ww.x, ww.z);
    } else {
      this.chase.update(camera, dt, {
        frame: this._fr,
        heroX: hw.x,
        heroZ: hw.z,
        heroY: headY,
        steer: this.hero.steerVis,
        speed: this.hero.speed,
        proximity: this.proximity,
        wardenX: ww.x,
        wardenZ: ww.z,
        dying: dyingFrame,
        deathT: this.deathElapsed,
        shake: this.shake,
      });
    }
  }

  /** Slow side-on title portrait: the idle hero with the predator looming behind. */
  private titleCam(camera: PerspectiveCamera, hx: number, hz: number, wx: number, wz: number) {
    const t = this.simTime;
    const fr = this._fr;
    const midX = (hx + wx) / 2;
    const midZ = (hz + wz) / 2;
    const side = 6.5 + Math.sin(t * 0.12) * 1.5;
    camera.position.set(midX + fr.rx * side + fr.tx * 1.5, 2.6, midZ + fr.rz * side + fr.tz * 1.5);
    camera.lookAt(midX, 1.9, midZ);
    if (Math.abs(camera.fov - 44) > 0.01) {
      camera.fov = 44;
      camera.updateProjectionMatrix();
    }
  }

  dispose() {
    this.input.detach();
    if (this.chunks) {
      this.root.remove(this.chunks.group);
      this.chunks.dispose();
    }
    this.debris?.dispose();
    this.fx.dispose();
    this.world = null;
    this.ready = false;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
