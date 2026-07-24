/**
 * Course — the infinite 1D centerline the whole game runs along (PROJECT.md §6).
 * Pure + deterministic: geometry is a function of (seed, arc-length s) ONLY, so a
 * shared ?seed= reproduces the exact same road on every device (PROJECT.md §0).
 * No three import — this is unit-testable.
 *
 * The centerline is an arc-length-parameterized wander: heading θ(s) integrates a
 * smooth seed-derived curvature with a gentle restoring pull toward "forward"
 * (-Z), so the road winds without ever spiraling back on itself (which would make
 * chunks overlap in world space). Samples are integrated forward at a fixed step
 * and cached, so frame(s) is O(1) after the first pass. `halfWidth(s)` encodes
 * pinch points (narrowing) whose frequency rises with distance — the world gets
 * tighter the deeper you go (PROJECT.md §8) while staying seed-deterministic.
 */
import { chunkRng } from './rng';
import { AVENUE_HALF, NODE_HEADING_MAX } from './constants';

const DS = 4; // integration / sample step (m)
const NODE_D = 90; // curvature control spacing (m)
const K_MAX = NODE_HEADING_MAX / NODE_D; // max curvature (rad/m) -> ≤22°/node
const K_RESTORE = 0.0016; // pull heading back toward 0 so the road never loops

export interface Frame {
  x: number;
  z: number;
  tx: number; // unit tangent (forward) x
  tz: number; // unit tangent (forward) z
  rx: number; // unit right (lateral +) x
  rz: number; // unit right (lateral +) z
  heading: number;
  halfWidth: number;
}

interface Sample {
  x: number;
  z: number;
  theta: number;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export class Course {
  readonly seed: number;
  private samples: Sample[] = [];
  private curvCache = new Map<number, number>();
  private pinchCache = new Map<number, number>();

  constructor(seed: number) {
    this.seed = seed >>> 0;
    // seed the first sample at the origin, facing -Z (heading 0)
    this.samples.push({ x: 0, z: 0, theta: 0 });
  }

  /** Seed-derived curvature control at node n (rad/m), with straight breathers. */
  private ctrlCurv(n: number): number {
    const c = this.curvCache.get(n);
    if (c !== undefined) return c;
    const r = chunkRng(this.seed, n, 7);
    let v: number;
    if (r.chance(0.33)) v = 0; // straight breather (avoid monotony, §8)
    else v = (r.next() * 2 - 1) * K_MAX;
    this.curvCache.set(n, v);
    return v;
  }

  /** Seed-derived half-width factor at node n. Pinches get more frequent deeper. */
  private ctrlPinch(n: number): number {
    const c = this.pinchCache.get(n);
    if (c !== undefined) return c;
    const r = chunkRng(this.seed, n, 11);
    const sAbs = n * NODE_D;
    const prob = 0.1 + Math.min(0.24, sAbs / 9000);
    let f = 1;
    if (sAbs > 240 && r.chance(prob)) f = r.range(0.5, 0.72); // narrowing
    else if (r.chance(0.08)) f = r.range(1.15, 1.4); // occasional plaza widening
    this.pinchCache.set(n, f);
    return f;
  }

  private curvatureAt(s: number): number {
    const n = Math.floor(s / NODE_D);
    const t = (s - n * NODE_D) / NODE_D;
    return this.ctrlCurv(n) + (this.ctrlCurv(n + 1) - this.ctrlCurv(n)) * smoothstep(t);
  }

  /** Grow the integrated sample cache until it covers arc-length s. */
  private ensure(s: number) {
    const need = Math.floor(s / DS) + 2;
    let last = this.samples[this.samples.length - 1];
    for (let k = this.samples.length; k <= need; k++) {
      const sPrev = (k - 1) * DS;
      const kappa = this.curvatureAt(sPrev);
      const theta = last.theta + (kappa - K_RESTORE * last.theta) * DS;
      const x = last.x + Math.sin(theta) * DS;
      const z = last.z - Math.cos(theta) * DS;
      const sample = { x, z, theta };
      this.samples.push(sample);
      last = sample;
    }
  }

  /** Half-width of the runnable avenue at arc-length s (pinches + plazas). */
  halfWidth(s: number): number {
    const n = Math.floor(s / NODE_D);
    const t = (s - n * NODE_D) / NODE_D;
    const f = this.ctrlPinch(n) + (this.ctrlPinch(n + 1) - this.ctrlPinch(n)) * smoothstep(t);
    return AVENUE_HALF * f;
  }

  /** Fill `out` with the moving frame at arc-length s (>=0). */
  frame(s: number, out: Frame): Frame {
    const ss = Math.max(0, s);
    this.ensure(ss);
    const k = Math.floor(ss / DS);
    const t = ss / DS - k;
    const a = this.samples[k];
    const b = this.samples[k + 1] ?? a;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    // interpolate heading (both samples are within ≤22°/node, no wrap issue)
    const theta = a.theta + (b.theta - a.theta) * t;
    out.x = x;
    out.z = z;
    out.heading = theta;
    out.tx = Math.sin(theta);
    out.tz = -Math.cos(theta);
    out.rx = Math.cos(theta);
    out.rz = Math.sin(theta);
    out.halfWidth = this.halfWidth(ss);
    return out;
  }

  /** World position for a point at arc-length s with a lateral offset (+ = right). */
  worldAt(s: number, lateral: number, out: Frame): { x: number; z: number } {
    this.frame(s, out);
    return { x: out.x + out.rx * lateral, z: out.z + out.rz * lateral };
  }
}

export function makeFrame(): Frame {
  return { x: 0, z: 0, tx: 0, tz: -1, rx: 1, rz: 0, heading: 0, halfWidth: AVENUE_HALF };
}
