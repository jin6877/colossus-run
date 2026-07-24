/**
 * Engine — the imperative orchestrator outside React state (PROJECT.md 임퍼러티브
 * 경계). React owns the Canvas + lighting; one <EngineRunner> calls
 * engine.update(delta, camera) inside useFrame. Everything high-frequency — the
 * fixed-step hero/warden sim, chunk streaming, warden-driven destruction, debris,
 * fx, camera — happens here and never triggers a React re-render.
 *
 * CORE (user override): the camera is REVERSED to face the looming warden, and
 * the hazard is its STOMPING FEET. Each stomp aims a foot at the hero's predicted
 * lane, a ground shadow telegraphs it, then it SLAMS: stand in the footprint =
 * crushed; the expanding shockwave must be hopped. Dodge left/right (+ jump).
 * No forward obstacle course, no color hazard paint — the shadow is the read.
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
import {
  buildWardenRig,
  applyWardenPose,
  type WardenParts,
  type StompPose,
} from './render/wardenRig';
import { DustWall } from './render/dustWall';
import { FootTelegraph } from './render/footTelegraph';
import { speedAt, stompIntervalAt, windupAt, leadTimeAt } from './difficulty';
import { InputManager } from './input';
import { CAM, SLOMO_SCALE } from './constants';
import type { QualityPreset } from './quality';

type RWorld = InstanceType<typeof RAPIER.World>;

export type GameState = 'title' | 'running' | 'dying' | 'gameover';
export type DeathReason = 'stomp' | 'shockwave' | 'caught';

const R_DESTROY = 40; // warden path-clear radius (spectacle)
const START_GAP = 13; // the warden looms this far behind at the start of a run
const TITLE_GAP = 22; // pulled back for the title portrait
const HOT = 0x7c2408; // warm ember hot-color on fresh debris
const DEATH_TIME = 2.4; // seconds of death-cam before the result card

const FOOT_R_LAT = 2.7; // stomp footprint half-width (lateral) — crush zone
const FOOT_R_S = 3.4; // stomp footprint half-length (along course)
const FOOT_TELE_R = 3.6; // telegraph shadow radius
const SHOCK_SPEED = 22; // shockwave ring expansion (m/s)
const SHOCK_MAX = 15; // shockwave outer radius (m)

interface Shock {
  cs: number;
  cl: number;
  t: number;
  hit: boolean;
}

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
  private footTele: FootTelegraph;

  private state: GameState = 'title';
  private simTime = 0;
  private timeScale = 1;
  private deathElapsed = 0;
  private fractureAcc = 0;
  private distance = 0;
  private bestDistance = 0;
  private caughtReason: DeathReason = 'stomp';
  hitFlash = 0; // spikes on a shockwave graze (HUD red flash + shake)
  private shocks: Shock[] = [];

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
    this.footTele = new FootTelegraph();
    this.root.add(this.heroRig.group);
    this.root.add(this.wardenRig.group);
    this.root.add(this.dustWall.mesh);
    this.root.add(this.footTele.group);
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
    this.footTele.hide();
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
    this.shocks.length = 0;
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
    this.hitFlash = 0;
    this.shocks.length = 0;
    this.footTele.hide();
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
    this.footTele.hide();
    if (this.distance > this.bestDistance) this.bestDistance = this.distance;
    this.onStateChange?.('dying');
  }

  getState(): GameState {
    return this.state;
  }

  /** Force a death (verification harness only — deterministic death-cam). */
  forceDeath() {
    this.triggerDeath('stomp');
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
      stomping: this.warden.stomping,
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
    this.warden.attention += (0.5 - this.warden.attention) * (1 - Math.exp(-dt / 1));
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
      // reversed camera -> flip steer so screen-space left/right stays intuitive
      this._input.steer = -this._input.steer;
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
        stompIntervalAt(this.distance),
        windupAt(this.distance),
        leadTimeAt(this.distance),
        avenueHalf,
      );

      // a stomp lands: FX + shockwave + fracture + direct-hit crush check
      if (this.warden.slamEvent) this.onSlam();

      // expanding shockwaves — hop them or take a graze
      this.updateShocks(dt);

      // steady path-clear fracture (warden levels the flanking city — spectacle)
      this.fractureAcc += this.quality.wardenFractureRate * dt;
      const wf = course.worldAt(this.warden.s, this.warden.lateral, this._fr);
      while (this.fractureAcc >= 1) {
        this.fractureAcc -= 1;
        this.fractureAround(wf.x, wf.z, 0);
      }

      // proximity = incoming-slam threat (drives red vignette + camera punch-in)
      const target =
        this.warden.stompPhase === 'raise'
          ? this.warden.telegraphProgress
          : this.warden.stompPhase === 'slam'
          ? 1
          : 0;
      this.proximity += (target - this.proximity) * (1 - Math.exp(-dt / 0.12));

      chunks.update(this.hero.s);
      const hw = course.worldAt(this.hero.s, this.hero.lateral, this._fr2);
      this.ground!.follow(hw.x, hw.z);
    } else if (this.state === 'dying') {
      // the warden comes down over the hero (the pose reach drives the slam)
      this.warden.s += (this.hero.s - 4 - this.warden.s) * (1 - Math.exp(-dt / 0.45));
      this.warden.lateral += (this.hero.lateral - this.warden.lateral) * (1 - Math.exp(-dt / 0.4));
      this.warden.attention = 1;
      this.warden.emissiveSurge = Math.min(1, this.warden.emissiveSurge + dt);
    }

    world.step(this.eventQueue());
    this.debris?.update(this.simTime);
    this.fx.update(dt);
  }

  /** Resolve a foot slam: impact FX, shockwave, building fracture, crush check. */
  private onSlam() {
    const course = this.course!;
    const sp = course.worldAt(this.warden.targetS, this.warden.targetLat, this._fr3);
    this.fx.footfall([sp.x, 0.3, sp.z], 2.4, 1); // big warm dust + ground crack + cold flash
    this.fx.collapse([sp.x, 0.4, sp.z], 11); // warm-dust shockwave ring + bloom spike
    this.shake.add(0.55);
    this.fractureAround(sp.x, sp.z, 1); // the slam levels a nearby building
    this.shocks.push({ cs: this.warden.targetS, cl: this.warden.targetLat, t: 0, hit: false });

    // direct crush: standing in the footprint at slam = death
    const dLat = Math.abs(this.hero.lateral - this.warden.targetLat);
    const dS = Math.abs(this.hero.s - this.warden.targetS);
    if (dLat < FOOT_R_LAT && dS < FOOT_R_S) this.triggerDeath('stomp');
  }

  private updateShocks(dt: number) {
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const sh = this.shocks[i];
      sh.t += dt;
      const r = sh.t * SHOCK_SPEED;
      if (r > SHOCK_MAX) {
        this.shocks.splice(i, 1);
        continue;
      }
      if (sh.hit) continue;
      const dist = Math.hypot(this.hero.s - sh.cs, this.hero.lateral - sh.cl);
      // grounded hero caught by the ring edge takes a graze (hop to clear it)
      if (Math.abs(dist - r) < 1.2 && this.hero.yJump < 0.6) {
        sh.hit = true;
        this.grazeHit();
      }
    }
  }

  private grazeHit() {
    this.hero.graze();
    this.shake.add(0.4);
    this.hitFlash = 1;
  }

  private eventQueueInst: InstanceType<typeof RAPIER.EventQueue> | null = null;
  private eventQueue() {
    if (!this.eventQueueInst) this.eventQueueInst = new RAPIER.EventQueue(true);
    return this.eventQueueInst;
  }

  /** Fracture the nearest alive building within R_DESTROY of (x,z). */
  private fractureAround(x: number, z: number, footfall: number) {
    if (!this.debris || !this.chunks) return;
    this.chunks.buildingsNear(x, z, R_DESTROY, this._binfos);
    if (this._binfos.length === 0) return;
    let best: BuildingInfo | null = null;
    let bestD = Infinity;
    for (const b of this._binfos) {
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
    this._impact.set(info.center[0], Math.min(info.size[1] * 0.5, 8), info.center[2]);
    const tall = info.size[1] > 24;
    const desired = tall ? this.quality.chunksFine : this.quality.chunksCoarse;
    this.debris.fractureBuilding(
      info.center,
      info.size,
      info.color,
      this._impact,
      1.0 + footfall * 0.6,
      HOT,
      0.3,
      desired,
    );
    this.fx.collapse([info.center[0], info.size[1] * 0.5, info.center[2]], info.size[1] * 0.5 + 6);
    if (Math.random() < 0.25) this.fx.ignite([info.center[0], 1, info.center[2]], info.size[1] * 0.4);
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

    // stomp pose for the rig (aim the foot at the target lane + raise/slam it)
    let stomp: StompPose | null = null;
    if (this.state === 'running' && this.warden.stomping) {
      stomp = {
        leg: this.warden.stompLeg,
        rootX: clampR(this.warden.targetLat - this.warden.lateral, -7, 7),
        footZ: -(this.warden.targetS - this.warden.s),
        footY: this.warden.stompFootY(),
      };
      // telegraph shadow at the target lane
      const tp = course.worldAt(this.warden.targetS, this.warden.targetLat, this._fr3);
      const prog = this.warden.stompPhase === 'raise' ? this.warden.telegraphProgress : 1;
      this.footTele.update(tp.x, tp.z, FOOT_TELE_R, prog);
    } else {
      this.footTele.hide();
    }

    applyWardenPose(
      this.wardenRig,
      this.warden,
      this._fr2,
      ww.x,
      ww.z,
      hw.x,
      headY - 1.2,
      hw.z,
      this.simTime,
      reach,
      stomp,
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

  /** Slow cinematic title portrait of the looming warden (DESIGN §7.4). */
  private titleCam(camera: PerspectiveCamera, hx: number, hz: number, wx: number, wz: number) {
    const t = this.simTime;
    const fr = this._fr;
    const side = Math.sin(t * 0.12) * 11;
    camera.position.set(hx + fr.tx * 32 + fr.rx * side, 22, hz + fr.tz * 32 + fr.rz * side);
    camera.lookAt(wx, 37, wz);
    if (Math.abs(camera.fov - 48) > 0.01) {
      camera.fov = 48;
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
function clampR(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
