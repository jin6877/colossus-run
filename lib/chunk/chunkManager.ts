/**
 * Chunk streaming window (PROJECT.md §6). Keeps a rolling set of built chunks
 * around the player: one behind (the warden + its forward-cast shadow live here)
 * and `streamAhead` ahead (~480m of visible road). Crossing a boundary builds the
 * next chunk and disposes the one that fell off the back (mesh dispose + its
 * obstacles/buildings go with it). Everything is keyed by integer chunk index so
 * it stays framerate- and path-independent — a shared ?seed= streams identically.
 */
import { Group, type Object3D } from 'three';
import { Course } from '../course';
import { CHUNK_LEN } from '../constants';
import type { QualityPreset } from '../quality';
import { buildChunk } from './chunkBuild';
import type { Chunk, Obstacle, BuildingInfo } from './chunkTypes';

const BACK = 1;

export class ChunkManager {
  readonly group = new Group();
  private chunks = new Map<number, Chunk>();
  private course: Course;
  private seed: number;
  private quality: QualityPreset;
  private lastCenter = -9999;

  constructor(course: Course, seed: number, quality: QualityPreset) {
    this.course = course;
    this.seed = seed;
    this.quality = quality;
    this.group.name = 'chunks';
  }

  chunkIndexForS(s: number): number {
    return Math.floor(s / CHUNK_LEN);
  }

  /** Ensure the window around the player's chunk is loaded; dispose the rest. */
  update(playerS: number) {
    const center = this.chunkIndexForS(playerS);
    if (center === this.lastCenter) return;
    this.lastCenter = center;
    const lo = center - BACK;
    const hi = center + this.quality.streamAhead;
    // build missing
    for (let i = Math.max(0, lo); i <= hi; i++) {
      if (!this.chunks.has(i)) {
        const c = buildChunk(this.course, this.seed, i, this.quality);
        this.chunks.set(i, c);
        this.group.add(c.group);
      }
    }
    // dispose out-of-window
    for (const [i, c] of this.chunks) {
      if (i < lo || i > hi) {
        this.group.remove(c.group);
        c.dispose();
        this.chunks.delete(i);
      }
    }
  }

  /** Force-build the initial chunks (loading screen) and report how many. */
  preload(n: number): number {
    for (let i = 0; i < n; i++) {
      if (!this.chunks.has(i)) {
        const c = buildChunk(this.course, this.seed, i, this.quality);
        this.chunks.set(i, c);
        this.group.add(c.group);
      }
    }
    this.lastCenter = -9999;
    return this.chunks.size;
  }

  forEachObstacle(fn: (o: Obstacle) => void) {
    for (const c of this.chunks.values()) for (const o of c.obstacles) fn(o);
  }

  buildingsNear(x: number, z: number, r: number, out: BuildingInfo[]): BuildingInfo[] {
    const r2 = r * r;
    out.length = 0;
    for (const c of this.chunks.values()) {
      for (const b of c.buildings) {
        if (!b.alive) continue;
        const dx = b.center[0] - x;
        const dz = b.center[2] - z;
        if (dx * dx + dz * dz <= r2) out.push(b);
      }
    }
    return out;
  }

  destroyBuilding(id: number) {
    const chunkIndex = Math.floor(id / 1000);
    this.chunks.get(chunkIndex)?.destroyBuilding(id);
  }

  /** Add a promoted rubble obstacle (+ its mesh) to the chunk that owns s. */
  addObstacleAt(s: number, o: Obstacle, mesh?: Object3D): boolean {
    const i = this.chunkIndexForS(s);
    const c = this.chunks.get(i);
    if (!c) return false;
    c.obstacles.push(o);
    if (mesh) c.group.add(mesh); // disposes with the chunk
    return true;
  }

  chunkGroup(s: number): Group | null {
    return this.chunks.get(this.chunkIndexForS(s))?.group ?? null;
  }

  get loadedCount(): number {
    return this.chunks.size;
  }

  dispose() {
    for (const c of this.chunks.values()) {
      this.group.remove(c.group);
      c.dispose();
    }
    this.chunks.clear();
  }
}
