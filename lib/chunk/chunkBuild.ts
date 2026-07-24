/**
 * Build one course chunk (PROJECT.md §6). Deterministic from (seed, index): the
 * road+sidewalk ribbon follows the centerline, flanking blocks are placed by a
 * seed stream, and curated obstacles (parked vehicles, low barriers, overhead
 * signs, road gaps) are scattered in (s, lateral) space. Buildings are merged per
 * material family — ~a handful of draw calls per chunk (§10) — and each records
 * its vertex range so a warden strike can collapse it (zero-area triangles) while
 * the DebrisSystem spawns the physical rubble. The Ashen-Dusk palette is applied
 * straight from constants (DESIGN §3.2 regrade).
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  Euler,
} from 'three';
import {
  ASPHALT,
  LANE_FADED,
  SIDEWALK,
  FAMILY,
  LEAF_COLOR,
  TRUNK_COLOR,
  CHUNK_LEN,
  type MaterialFamily,
} from '../constants';
import { chunkRng } from '../rng';
import { Course, makeFrame, type Frame } from '../course';
import type { QualityPreset } from '../quality';
import type { Chunk, Obstacle, BuildingInfo } from './chunkTypes';

const STEP = 4; // ribbon sample step (m)

interface Accum {
  pos: number[];
  nor: number[];
  col: number[];
}
function newAccum(): Accum {
  return { pos: [], nor: [], col: [] };
}
function accToGeo(a: Accum): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(a.pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(a.nor, 3));
  g.setAttribute('color', new Float32BufferAttribute(a.col, 3));
  g.computeBoundingSphere();
  return g;
}

/** Append a flat ground quad (two triangles) with an up normal + flat color. */
function quad(
  acc: Accum,
  ax: number, az: number, bx: number, bz: number,
  cx: number, cz: number, dx: number, dz: number,
  y: number,
  col: Color,
) {
  const push = (x: number, z: number) => {
    acc.pos.push(x, y, z);
    acc.nor.push(0, 1, 0);
    acc.col.push(col.r, col.g, col.b);
  };
  // a-b-c, a-c-d
  push(ax, az); push(bx, bz); push(cx, cz);
  push(ax, az); push(cx, cz); push(dx, dz);
}

const _m4 = new Matrix4();
const _q = new Quaternion();
const _v = new Vector3();
const _e = new Euler();

/** Append an axis-aligned box (positioned via matrix) to a family accumulator. */
function appendBox(acc: Accum, w: number, h: number, d: number, m: Matrix4, col: Color): number {
  const bg = new BoxGeometry(w, h, d);
  const g = bg.toNonIndexed();
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const nm = new Matrix4().extractRotation(m);
  const start = acc.pos.length / 3;
  for (let i = 0; i < p.count; i++) {
    _v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m);
    acc.pos.push(_v.x, _v.y, _v.z);
    _v.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix4(nm).normalize();
    acc.nor.push(_v.x, _v.y, _v.z);
    acc.col.push(col.r, col.g, col.b);
  }
  g.dispose();
  bg.dispose();
  return start; // vertex start index (count is 36 for a box)
}

export function buildChunk(
  course: Course,
  seed: number,
  index: number,
  quality: QualityPreset,
): Chunk {
  const s0 = index * CHUNK_LEN;
  const s1 = s0 + CHUNK_LEN;
  const rng = chunkRng(seed, index, 3);
  const group = new Group();
  group.name = `chunk-${index}`;

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const fr: Frame = makeFrame();
  const fr2: Frame = makeFrame();

  // ---- road + sidewalk ribbon ----
  const roadAcc = newAccum();
  const laneAcc = newAccum();
  const walkAcc = newAccum();
  const cRoad = new Color(ASPHALT);
  const cLane = new Color(LANE_FADED);
  const cWalk = new Color(SIDEWALK);
  for (let s = s0; s < s1; s += STEP) {
    course.frame(s, fr);
    course.frame(Math.min(s1, s + STEP), fr2);
    const hw0 = fr.halfWidth;
    const hw1 = fr2.halfWidth;
    const walk0 = hw0 + 5;
    const walk1 = hw1 + 5;
    // road surface
    quad(
      roadAcc,
      fr.x - fr.rx * hw0, fr.z - fr.rz * hw0,
      fr.x + fr.rx * hw0, fr.z + fr.rz * hw0,
      fr2.x + fr2.rx * hw1, fr2.z + fr2.rz * hw1,
      fr2.x - fr2.rx * hw1, fr2.z - fr2.rz * hw1,
      0.02, cRoad,
    );
    // faded centre lane dashes (every other step)
    if (((s / STEP) | 0) % 2 === 0) {
      const lw = 0.35;
      quad(
        laneAcc,
        fr.x - fr.rx * lw, fr.z - fr.rz * lw,
        fr.x + fr.rx * lw, fr.z + fr.rz * lw,
        fr2.x + fr2.rx * lw, fr2.z + fr2.rz * lw,
        fr2.x - fr2.rx * lw, fr2.z - fr2.rz * lw,
        0.05, cLane,
      );
    }
    // sidewalks (both sides)
    for (const sgn of [-1, 1]) {
      quad(
        walkAcc,
        fr.x + fr.rx * sgn * hw0, fr.z + fr.rz * sgn * hw0,
        fr.x + fr.rx * sgn * walk0, fr.z + fr.rz * sgn * walk0,
        fr2.x + fr2.rx * sgn * walk1, fr2.z + fr2.rz * sgn * walk1,
        fr2.x + fr2.rx * sgn * hw1, fr2.z + fr2.rz * sgn * hw1,
        0.01, cWalk,
      );
    }
  }
  const roadMat = track(new MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 }));
  const walkMat = track(new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }));
  const roadGeo = track(accToGeo(roadAcc));
  const laneGeo = track(accToGeo(laneAcc));
  const walkGeo = track(accToGeo(walkAcc));
  const roadMesh = new Mesh(roadGeo, roadMat);
  const laneMesh = new Mesh(laneGeo, roadMat);
  const walkMesh = new Mesh(walkGeo, walkMat);
  roadMesh.receiveShadow = walkMesh.receiveShadow = true;
  group.add(roadMesh, laneMesh, walkMesh);

  // ---- flanking buildings (merged per family) ----
  const families: MaterialFamily[] = ['glass', 'concrete', 'brick', 'panel'];
  const famAcc = new Map<MaterialFamily, Accum>();
  families.forEach((f) => famAcc.set(f, newAccum()));
  const roofAcc = newAccum();
  const buildings: BuildingInfo[] = [];
  const bodyRange = new Map<number, { fam: MaterialFamily; start: number; count: number }>();
  const roofRange = new Map<number, { start: number; count: number }>();

  let bid = index * 1000;
  for (const sgn of [-1, 1]) {
    let s = s0 + rng.range(2, 10);
    while (s < s1) {
      const w = rng.range(9, 18); // along-course footprint
      const gapAfter = rng.range(3, 9);
      course.frame(s + w / 2, fr);
      const hw = fr.halfWidth;
      const depth = rng.range(10, 20);
      const lateral = sgn * (hw + 5 + depth / 2 + rng.range(0.5, 3));
      const cx = fr.x + fr.rx * lateral;
      const cz = fr.z + fr.rz * lateral;
      // downtown-ish taller near the start bias removed; height from a weighted mix
      const fam = rng.weighted<MaterialFamily>([
        ['concrete', 0.4],
        ['glass', 0.24],
        ['brick', 0.24],
        ['panel', 0.12],
      ]);
      const h = fam === 'glass'
        ? rng.range(26, 60)
        : fam === 'concrete'
        ? rng.range(14, 34)
        : rng.range(6, 16);
      const color = jitter(rng, FAMILY[fam].variants[rng.int(0, FAMILY[fam].variants.length - 1)]);
      const facing = Math.atan2(-fr.tx, -fr.tz);
      _e.set(0, facing, 0);
      _q.setFromEuler(_e);
      _m4.compose(new Vector3(cx, h / 2 + 0.02, cz), _q, new Vector3(1, 1, 1));
      const acc = famAcc.get(fam)!;
      const start = acc.pos.length / 3;
      appendBox(acc, w, h, depth, _m4, new Color(color));
      bodyRange.set(bid, { fam, start, count: 36 });
      // roof cap (darker)
      _m4.compose(new Vector3(cx, h + 0.4, cz), _q, new Vector3(1, 1, 1));
      const rStart = roofAcc.pos.length / 3;
      appendBox(roofAcc, w * 0.98, 0.8, depth * 0.98, _m4, new Color(FAMILY.roof.variants[0]));
      roofRange.set(bid, { start: rStart, count: 36 });

      buildings.push({
        id: bid,
        center: [cx, 0, cz],
        size: [w, h, depth],
        color,
        alive: true,
        lateral,
        s: s + w / 2,
      });
      bid++;
      s += w + gapAfter;
    }
  }

  const famMesh = new Map<MaterialFamily, Mesh>();
  for (const f of families) {
    const acc = famAcc.get(f)!;
    if (acc.pos.length === 0) continue;
    const geo = track(accToGeo(acc));
    const mat = track(
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: FAMILY[f].roughness,
        metalness: FAMILY[f].metalness,
        flatShading: true,
      }),
    );
    const mesh = new Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // vertices get mutated on destruction
    group.add(mesh);
    famMesh.set(f, mesh);
  }
  let roofMesh: Mesh | null = null;
  if (roofAcc.pos.length > 0) {
    const geo = track(accToGeo(roofAcc));
    const mat = track(new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0, flatShading: true }));
    roofMesh = new Mesh(geo, mat);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    roofMesh.frustumCulled = false;
    group.add(roofMesh);
  }

  // ---- trees along the sidewalks (instanced) ----
  const treeN = Math.floor(rng.int(4, 9) * quality.treeFactor);
  if (treeN > 0) {
    const trunkGeo = track(new CylinderGeometry(0.3, 0.42, 2.2, 6));
    const trunkMat = track(new MeshStandardMaterial({ color: TRUNK_COLOR, roughness: 0.85, metalness: 0 }));
    const leafGeo = track(new ConeGeometry(1.4, 3.2, 6));
    const leafMat = track(new MeshStandardMaterial({ color: LEAF_COLOR, roughness: 0.86, metalness: 0, flatShading: true }));
    const trunks = new InstancedMesh(trunkGeo, trunkMat, treeN);
    const leaves = new InstancedMesh(leafGeo, leafMat, treeN);
    trunks.castShadow = leaves.castShadow = true;
    for (let i = 0; i < treeN; i++) {
      const s = rng.range(s0, s1);
      const sgn = rng.sign();
      course.frame(s, fr);
      const lateral = sgn * (fr.halfWidth + rng.range(1.5, 4));
      const x = fr.x + fr.rx * lateral;
      const z = fr.z + fr.rz * lateral;
      const sc = rng.range(1.1, 2.0);
      _e.set(0, rng.range(0, Math.PI * 2), 0);
      _q.setFromEuler(_e);
      _m4.compose(new Vector3(x, 1.1 * sc, z), _q, new Vector3(sc, sc, sc));
      trunks.setMatrixAt(i, _m4);
      _m4.compose(new Vector3(x, (2.2 + 1.6) * sc, z), _q, new Vector3(sc, sc, sc));
      leaves.setMatrixAt(i, _m4);
    }
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    group.add(trunks, leaves);
  }

  // No forward obstacle course in the foot-dodge core (reversed camera can't see
  // ahead): the hazard is the warden's stomping feet (engine). Empty by design.
  const obstacles: Obstacle[] = [];

  const destroyBuilding = (id: number) => {
    const info = buildings.find((b) => b.id === id);
    if (!info || !info.alive) return;
    info.alive = false;
    const at = new Vector3(info.center[0], info.center[1] + info.size[1] / 2, info.center[2]);
    const br = bodyRange.get(id);
    if (br) collapse(famMesh.get(br.fam), br.start, br.count, at);
    const rr = roofRange.get(id);
    if (rr) collapse(roofMesh, rr.start, rr.count, at);
  };

  const dispose = () => {
    for (const d of disposables) {
      try {
        d.dispose();
      } catch {
        /* noop */
      }
    }
    group.clear();
  };

  return { index, s0, s1, group, obstacles, buildings, destroyBuilding, dispose };
}

function collapse(mesh: Mesh | null | undefined, start: number, count: number, at: Vector3) {
  if (!mesh) return;
  const pos = mesh.geometry.getAttribute('position') as Float32BufferAttribute;
  for (let i = start; i < start + count; i++) pos.setXYZ(i, at.x, at.y, at.z);
  pos.needsUpdate = true;
}

function jitter(rng: { range: (a: number, b: number) => number }, hex: number): number {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const f = 1 + rng.range(-0.08, 0.08);
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (cl(r) << 16) | (cl(g) << 8) | cl(b);
}
