/**
 * Engine — the imperative orchestrator outside React state (PROJECT.md 임퍼러티브
 * 경계). React owns the Canvas + lighting; one <EngineRunner> calls
 * engine.update(delta, camera) inside useFrame. Everything high-frequency — the
 * fixed-step hero/warden sim, chunk streaming, warden-driven destruction, debris,
 * fx, chase camera — happens here with raw three/rapier and never triggers a
 * React re-render. This is the game loop + state machine (title/running/dying/
 * gameover) that stitches the reused engine (debris/fx) to the new systems
 * (course streaming, hero, warden, chase camera).
 */
import { Group, Vector3, PerspectiveCamera, Color, Mesh, BoxGeometry, MeshStandardMaterial, type Object3D } from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { initRapier, makeWorld, GroundPlate, FixedStepper } from './physics/world';
import { DebrisSystem } from './physics/debrisPool';
import { FXManager } from './fx/fx';
import { CameraShake } from './fx/cameraShake';
import { ChaseCamera } from './chaseCamera';
import { Course, makeFrame, type Frame } from './course';
import { ChunkManager } from './chunk/chunkManager';
import type { BuildingInfo, Obstacle } from './chunk/chunkTypes';
import { Hero, type HeroInput } from './hero';
import { Warden } from './warden';
import { buildHeroRig, applyHeroPose, type HeroParts } from './render/heroRig';
import { buildWardenRig, applyWardenPose, wardenFootWorld, type WardenParts } from './render/wardenRig';
import { DustWall } from './render/dustWall';
import { obstacleMark } from './render/obstacleMarks';
import { speedAt, gapTargetAt } from './difficulty';
import { InputManager } from './input';
import { CAM, SLOMO_SCALE } from './constants';
import type { QualityPreset } from './quality';

type RWorld = InstanceType<typeof RAPIER.World>;

export type GameState = 'title' | 'running' | 'dying' | 'gameover';

const R_DESTROY = 42; // warden path-clear radius (PROJECT.md §5)
const START_GAP = 26; // warden starts this far behind (looming, then eases to G*)
const TITLE_GAP = 22;
const HOT = 0x7c2408; // warm ember hot-color on fresh debris
const DEATH_TIME = 2.4; // seconds of death-cam before the result card

export class Engine {
  readonly root = new Group();
  readonly fx: FXManager;
  readonly shake = new CameraShake();
  readonly bloom = { value: 0.25 };
  readonly input = new InputManager();

  // live state read by React (light follow / PostFX / HUD) — no re-render
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

  private state: GameState = 'title';
  private simTime = 0;
  private timeScale = 1;
  private deathElapsed = 0;
  private catchTimer = 0;
  private fractureAcc = 0;
  private promoteBudget = 0;
  private distance = 0;
  private bestDistance = 0;
  private caughtReason: 'caught' | 'block' | 'gap' = 'caught';
  hitFlash = 0; // spikes on a graze (HUD red flash + shake feedback)
  private dropping: { mesh: Object3D; y0: number; y1: number; t: number; dur: number; x: number; z: number }[] = [];

  private _fr: Frame = makeFrame();
  private _fr2: Frame = makeFrame();
  private _input: HeroInput = { steer: 0, jump: false, slideHeld: false, dash: false };
  private _binfos: BuildingInfo[] = [];
  private _impact = new Vector3();

  ready = false;
  seed = 0;
  debugLoom = false; // verify-only: pin the warden at near-framing distance
  onStateChange: ((s: GameState) => void) | null = null;

  constructor(quality: QualityPreset) {
    this.quality = quality;
    this.fx = new FXManager({ lowTier: quality.tier === 'low' });
    this.root.name = 'engine-root';
    this.root.add(this.fx.group);
    this.heroRig = buildHeroRig();
    this.wardenRig = buildWardenRig(quality.proceduralBoneQuality);
    this.dustWall = new DustWall(makeFrame());
    this.root.add(this.heroRig.group);
    this.root.add(this.wardenRig.group);
    this.root.add(this.dustWall.mesh);
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
    this.course = new Course(this.seed);
    this.chunks = new ChunkManager(this.course, this.seed, this.quality);
    this.root.add(this.chunks.group);
    this.chunks.preload(3);
    this.hero.reset();
    this.warden.reset(TITLE_GAP);
    this.state = 'title';
    this.timeScale = 1;
    this.deathElapsed = 0;
    this.catchTimer = 0;
    this.distance = 0;
    this.proximity = 0;
    this.simTime = 0;
    this.hitFlash = 0;
    this.dropping.length = 0;
    this.stepper.reset();
  }

  /** Number of chunks currently preloaded (for the loading screen / verify). */
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
    this.catchTimer = 0;
    this.fractureAcc = 0;
    this.promoteBudget = this.quality.obstaclePromoteCap;
    this.hitFlash = 0;
    this.dropping.length = 0;
    this.onStateChange?.('running');
  }

  private triggerDeath(reason: 'caught' | 'block' | 'gap') {
    if (this.state !== 'running') return;
    this.caughtReason = reason;
    this.state = 'dying';
    this.timeScale = SLOMO_SCALE;
    this.deathElapsed = 0;
    this.input.enabled = false;
    this.shake.add(0.7);
    if (this.distance > this.bestDistance) this.bestDistance = this.distance;
    this.onStateChange?.('dying');
  }

  getState(): GameState {
    return this.state;
  }

  /** Force a catch (verification harness only — deterministic death-cam). */
  forceDeath() {
    this.triggerDeath('caught');
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

  /** Deterministic fingerprint of the course geometry (seed reproducibility). */
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
        this.deathElapsed += d; // real time (unscaled) so the cut times out
        if (this.deathElapsed >= DEATH_TIME) {
          this.state = 'gameover';
          this.onStateChange?.('gameover');
        }
      }
    }

    // ---- render-rate updates (poses + camera) ----
    this.updateDrops(d);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - d / 0.35);
    this.renderActors(camera, d);
    this.bloom.value = Math.max(0.25, this.fx.bloomEnergy);
  }

  private updateTitle(dt: number) {
    // slow preview: hero idles at the start, the warden looms + slow-gaits behind
    this.simTime += dt;
    this.hero.s = 0;
    this.hero.phase = (this.hero.phase + 0.15 * dt) % 1;
    this.warden.s = -TITLE_GAP;
    this.warden.gaitPhase = (this.warden.gaitPhase + 0.28 * dt) % 1;
    this.warden.attention += (0.4 - this.warden.attention) * (1 - Math.exp(-dt / 1));
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
      this.distance = Math.floor(this.hero.s);
      const base = speedAt(this.distance);
      this.hero.update(dt, this._input, course, base);

      const gapTarget = gapTargetAt(this.distance);
      this.warden.update(
        dt,
        this.hero.s,
        this.hero.lateral,
        this.hero.speed,
        this.hero.dashing,
        gapTarget,
      );

      // footfalls: fx + shake + destruction pulse at the foot
      const wf = course.worldAt(this.warden.s, this.warden.lateral, this._fr);
      for (const ff of this.warden.pending) {
        const foot = wardenFootWorld(this.warden, this._fr, wf.x, wf.z, ff.side);
        const p = this.proximity;
        this.fx.footfall(foot, 1 + p, p);
        this.shake.add(0.12 + 0.55 * p);
        this.warden.footSurge();
        this.fractureAround(foot[0], foot[2], 1);
      }

      // steady path-clear fracture budget (warden mows the flanking city)
      this.fractureAcc += this.quality.wardenFractureRate * dt;
      while (this.fractureAcc >= 1) {
        this.fractureAcc -= 1;
        this.fractureAround(wf.x, wf.z, 0);
      }

      // verify-only: pin the warden at near-framing distance to inspect looming
      if (this.debugLoom) this.warden.s = this.hero.s - 9;

      // obstacle resolution + catch check
      this.resolveObstacles();
      const gap = this.warden.gapTo(this.hero.s);
      this.proximity = clamp01((CAM.farGap - gap) / (CAM.farGap - CAM.nearGap));
      if (gap <= CAM.catchGap) {
        this.catchTimer += dt;
        if (this.catchTimer > 0.15) this.triggerDeath('caught');
      } else {
        this.catchTimer = 0;
      }

      chunks.update(this.hero.s);
      const hw = course.worldAt(this.hero.s, this.hero.lateral, this._fr2);
      this.ground!.follow(hw.x, hw.z);
    } else if (this.state === 'dying') {
      // warden lunges onto the hero; hero frozen
      this.warden.s += (this.hero.s - 5 - this.warden.s) * (1 - Math.exp(-dt / 0.5));
      this.warden.lateral += (this.hero.lateral - this.warden.lateral) * (1 - Math.exp(-dt / 0.4));
      this.warden.gaitPhase = (this.warden.gaitPhase + 0.3 * dt) % 1;
      this.warden.attention = 1;
      this.warden.emissiveSurge = Math.min(1, this.warden.emissiveSurge + dt);
    }

    // debris + fx always advance (slomo makes the death spectacle readable)
    world.step(this.eventQueue());
    this.debris?.update(this.simTime);
    this.fx.update(dt);
  }

  private _eq: InstanceType<typeof RAPIER.EventQueue> | null = null;
  private eventQueue() {
    if (!this._eq) this._eq = new RAPIER.EventQueue(true);
    return this._eq;
  }

  /** Fracture the nearest alive building within R_DESTROY of (x,z). */
  private fractureAround(x: number, z: number, footfall: number) {
    if (!this.debris || !this.chunks) return;
    this.chunks.buildingsNear(x, z, R_DESTROY, this._binfos);
    if (this._binfos.length === 0) return;
    // nearest
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
    if (Math.random() < 0.25) {
      this.fx.ignite([info.center[0], 1, info.center[2]], info.size[1] * 0.4);
    }
    this.maybePromote(info);
  }

  /** A felled building can drop rubble into the lane ahead (PROJECT.md §5 심장). */
  private maybePromote(info: BuildingInfo) {
    if (!this.chunks || !this.course || this.promoteBudget <= 0) return;
    if (this.state !== 'running') return;
    // only promote buildings whose debris lands ahead of the hero (avoidable)
    const ahead = info.s - this.hero.s;
    if (ahead < 22 || ahead > 130) return;
    if (Math.random() > 0.55) return;
    this.promoteBudget -= 1;
    this.course.frame(info.s, this._fr2);
    const hw = this._fr2.halfWidth;
    const lane = Math.max(-hw + 2, Math.min(hw - 2, info.lateral > 0 ? hw - 3 : -hw + 3));
    const wpos = this.course.worldAt(info.s, lane, this._fr);
    const facing = Math.atan2(-this._fr.tx, -this._fr.tz);

    // container: a ground telegraph (mark + shadow, DESIGN §2.4 착지 예고) that
    // appears immediately, and the rubble chunk that DROPS onto it (so the player
    // sees "그가 부순 것이 내 앞에 떨어진다").
    const container = new Group();
    container.add(obstacleMark('rubble', wpos.x, wpos.z, facing, 1.9));
    const mesh = new Mesh(
      new BoxGeometry(3.4, 1.8, 3.4),
      new MeshStandardMaterial({
        color: new Color(info.color).multiplyScalar(0.9),
        roughness: 0.9,
        metalness: 0,
        flatShading: true,
      }),
    );
    mesh.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(wpos.x, 22, wpos.z); // starts high, falls in
    container.add(mesh);
    this.dropping.push({ mesh, y0: 22, y1: 0.9, t: 0, dur: 0.55, x: wpos.x, z: wpos.z });

    const ob: Obstacle = {
      id: 900000 + ((info.id * 7) & 0xffff),
      kind: 'rubble',
      sMin: info.s - 2.2,
      sMax: info.s + 2.2,
      latCenter: lane,
      latHalf: 1.9,
      yClear: 1.8,
      resolved: false,
      promoted: true,
    };
    this.chunks.addObstacleAt(info.s, ob, container);
  }

  /** Advance falling promoted-rubble chunks; puff dust + shake on landing. */
  private updateDrops(dt: number) {
    for (let i = this.dropping.length - 1; i >= 0; i--) {
      const d = this.dropping[i];
      d.t += dt;
      const k = Math.min(1, d.t / d.dur);
      d.mesh.position.y = d.y1 + (d.y0 - d.y1) * (1 - k * k); // ease-in fall
      if (k >= 1) {
        d.mesh.position.y = d.y1;
        this.fx.footfall([d.x, 0.3, d.z], 0.7, this.proximity);
        this.shake.add(0.14);
        this.dropping.splice(i, 1);
      }
    }
  }

  /** Graze feedback: slow the hero, shake, and flash the screen red (readable hit). */
  private grazeHit() {
    this.hero.graze();
    this.shake.add(0.4);
    this.hitFlash = 1;
  }

  private resolveObstacles() {
    const hero = this.hero;
    const s = hero.s;
    this.chunks!.forEachObstacle((o) => {
      if (o.resolved) return;
      if (s > o.sMax + 1.5) {
        o.resolved = true;
        return;
      }
      if (s < o.sMin) return;
      const latDist = Math.abs(hero.lateral - o.latCenter);
      const within = latDist < o.latHalf + 0.6;
      if (!within) return; // dodged laterally
      switch (o.kind) {
        case 'block':
        case 'vehicle':
        case 'rubble': {
          o.resolved = true;
          if (latDist < o.latHalf - 0.2 && !hero.dashing) this.triggerDeath('block');
          else this.grazeHit();
          break;
        }
        case 'jump': {
          if (hero.yJump > 0.6) o.resolved = true;
          else {
            o.resolved = true;
            this.grazeHit();
            if (latDist < o.latHalf - 0.4) this.triggerDeath('block');
          }
          break;
        }
        case 'slide': {
          if (hero.sliding) o.resolved = true;
          else {
            o.resolved = true;
            this.triggerDeath('block');
          }
          break;
        }
        case 'gap': {
          if (hero.yJump > 0.3) o.resolved = true;
          else {
            o.resolved = true;
            this.triggerDeath('gap');
          }
          break;
        }
      }
    });
  }

  private renderActors(camera: PerspectiveCamera, dt: number) {
    const course = this.course!;
    // hero
    const hw = course.worldAt(this.hero.s, this.hero.lateral, this._fr);
    const headY = CAM.headY + this.hero.yJump;
    applyHeroPose(this.heroRig, this.hero, this._fr, hw.x, hw.z);
    this.heroPos.set(hw.x, headY, hw.z);
    this.tangent.x = this._fr.tx;
    this.tangent.z = this._fr.tz;

    // warden
    const ww = course.worldAt(this.warden.s, this.warden.lateral, this._fr2);
    const dyingFrame = this.state === 'dying' || this.state === 'gameover';
    const reach = dyingFrame ? clamp01(this.deathElapsed / 0.9) : 0;
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
    );

    // chasing dust wall rides behind the warden (updated before the camera read)
    this.dustWall.update(course, this.warden.s, camera, this.proximity);

    // camera: cinematic preview at the title, chase rig otherwise
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

  /** Slow cinematic title preview framing the looming warden (DESIGN §7.4). */
  private titleCam(camera: PerspectiveCamera, hx: number, hz: number, wx: number, wz: number) {
    const t = this.simTime;
    const fr = this._fr; // hero frame (filled by worldAt(hero) above)
    const side = Math.sin(t * 0.12) * 11;
    // pulled back + high, aimed up so the watching head/mask clears the frame top
    camera.position.set(hx + fr.tx * 32 + fr.rx * side, 22, hz + fr.tz * 32 + fr.rz * side);
    camera.lookAt(wx, 37, wz);
    if (Math.abs(camera.fov - 48) > 0.01) {
      camera.fov = 48;
      camera.updateProjectionMatrix();
    }
  }

  private chase = new ChaseCamera();

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
