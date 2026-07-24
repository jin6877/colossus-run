/**
 * Warden render rig (DESIGN §2) — "a giant wearing a porcelain funeral mask".
 * Assembled from box / capsule / angular segments (no rigged GLTF; PROJECT.md
 * §4.2). H≈50m with DELIBERATELY distorted proportions so it reads as monumental:
 * tiny head, long gaunt torso, unnaturally long arms (knuckle-plant range), long
 * legs on broad flat feet. Two-bone leg IK (hip→knee→foot) drives a slow loping
 * gait; the head look-at ALWAYS turns to the hero (the "intelligence" cue, §2.3);
 * the crack seams glow cold cyan — the one cold light in the world — pulsing
 * slowly and surging on footfalls/telegraphs. flatShading facets hide the joints.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
} from 'three';
import {
  WARDEN_CERAMIC,
  WARDEN_COLD,
  WARDEN_CORE,
  WARDEN_HEIGHT,
} from '../constants';
import type { Warden } from '../warden';
import type { Frame } from '../course';

const H = WARDEN_HEIGHT; // 50m
const L_THIGH = 12;
const L_SHIN = 11;
const PELVIS_Y = L_THIGH + L_SHIN; // hip height ~23
const LEG_SPREAD = 3.4;
const STRIDE = 16;
const LIFT = 3.6;
const STOOP = 0.3; // ~17° forward stoop (DESIGN §2.1)

export interface WardenParts {
  group: Group;
  bob: Group;
  body: Group; // stooped torso + arms + head
  neck: Group;
  headYaw: Group;
  headPitch: Group;
  shoulderL: Group;
  shoulderR: Group;
  armLower: { L: Group; R: Group }; // forearm pivots
  legL: LegRig;
  legR: LegRig;
  ceramic: MeshStandardMaterial;
  core: MeshStandardMaterial;
  mask: MeshStandardMaterial;
}

interface LegRig {
  root: Group;
  thigh: Group;
  shin: Group;
}

function ceramicMesh(mat: MeshStandardMaterial, geo: BoxGeometry | CapsuleGeometry | ConeGeometry | OctahedronGeometry): Mesh {
  const m = new Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

function buildLeg(ceramic: MeshStandardMaterial, core: MeshStandardMaterial, side: number): LegRig {
  const root = new Group();
  root.position.set(side * LEG_SPREAD, PELVIS_Y, 0);

  const thigh = new Group();
  const thighMesh = ceramicMesh(ceramic, new BoxGeometry(2.4, L_THIGH, 2.4));
  thighMesh.position.y = -L_THIGH / 2;
  thigh.add(thighMesh);
  root.add(thigh);

  const shin = new Group();
  shin.position.y = -L_THIGH;
  const shinMesh = ceramicMesh(ceramic, new BoxGeometry(1.9, L_SHIN, 1.9));
  shinMesh.position.y = -L_SHIN / 2;
  shin.add(shinMesh);
  // knee seam glow
  const knee = ceramicMesh(core, new BoxGeometry(2.0, 0.8, 2.0));
  shin.add(knee);
  thigh.add(shin);

  // broad flat foot
  const foot = ceramicMesh(ceramic, new BoxGeometry(3.8, 1.3, 6.2));
  foot.position.set(0, -L_SHIN + 0.6, -1.4);
  shin.add(foot);

  return { root, thigh, shin };
}

export function buildWardenRig(boneQuality: 'full' | 'lite' = 'full'): WardenParts {
  const ceramic = new MeshStandardMaterial({
    color: new Color(WARDEN_CERAMIC),
    roughness: 0.66,
    metalness: 0,
    flatShading: true,
    emissive: new Color(WARDEN_COLD),
    emissiveIntensity: 0.35, // faint whole-body bleed from the cracks
  });
  const core = new MeshStandardMaterial({
    color: new Color(WARDEN_CERAMIC),
    roughness: 0.6,
    metalness: 0,
    flatShading: true,
    emissive: new Color(WARDEN_CORE),
    emissiveIntensity: 2.0, // chest / seam cores
  });
  const mask = new MeshStandardMaterial({
    color: new Color(WARDEN_CERAMIC),
    roughness: 0.55,
    metalness: 0,
    flatShading: true,
    emissive: new Color(WARDEN_COLD),
    emissiveIntensity: 1.4, // attention glow ramps this up
  });

  const group = new Group();
  group.name = 'warden';
  const bob = new Group();
  group.add(bob);

  // ---- body (stooped) ----
  const body = new Group();
  body.position.y = PELVIS_Y;
  body.rotation.x = STOOP;
  bob.add(body);

  // pelvis
  const pelvis = ceramicMesh(ceramic, new BoxGeometry(6, 3.4, 4));
  body.add(pelvis);

  // lower torso -> upper torso (tapers up = gaunt)
  const lower = ceramicMesh(ceramic, new BoxGeometry(5, 8, 3.4));
  lower.position.y = 6;
  body.add(lower);
  const chestCore = ceramicMesh(core, new BoxGeometry(3.4, 4.5, 2.6));
  chestCore.position.y = 9.5;
  body.add(chestCore);
  const upper = ceramicMesh(ceramic, new BoxGeometry(3.6, 7, 2.8));
  upper.position.y = 13.5;
  body.add(upper);

  // shoulders (asymmetric: right rides higher — DESIGN §2.1 의도된 비대칭)
  const shoulderL = new Group();
  shoulderL.position.set(-2.6, 16.4, 0);
  const shoulderR = new Group();
  shoulderR.position.set(2.6, 17.0, 0);

  const makeArm = (parent: Group, sign: number) => {
    const upperArm = ceramicMesh(ceramic, new BoxGeometry(1.8, 13, 1.8));
    upperArm.position.y = -13 / 2;
    parent.add(upperArm);
    const lowerPivot = new Group();
    lowerPivot.position.y = -13;
    const fore = ceramicMesh(ceramic, new BoxGeometry(1.5, 12, 1.5));
    fore.position.y = -12 / 2;
    lowerPivot.add(fore);
    // blunt angular hand (DESIGN §2.1 크고 뭉툭)
    const hand = ceramicMesh(ceramic, new BoxGeometry(2.8, 3.2, 3.6));
    hand.position.y = -12 - 1.0;
    lowerPivot.add(hand);
    if (boneQuality === 'full') {
      for (let f = 0; f < 3; f++) {
        const finger = ceramicMesh(ceramic, new BoxGeometry(0.7, 2.4, 0.7));
        finger.position.set((f - 1) * 0.9 * sign || (f - 1) * 0.9, -12 - 2.6, 1.2);
        lowerPivot.add(finger);
      }
    }
    parent.add(lowerPivot);
    return lowerPivot;
  };
  const armLowerL = makeArm(shoulderL, -1);
  const armLowerR = makeArm(shoulderR, 1);
  body.add(shoulderL, shoulderR);

  // ---- neck + head (small mask; cocked slightly = uncanny) ----
  const neck = new Group();
  neck.position.y = 17.2;
  const neckMesh = ceramicMesh(ceramic, new BoxGeometry(1.2, 3.2, 1.2));
  neckMesh.position.y = 1.6;
  neck.add(neckMesh);
  const headYaw = new Group();
  headYaw.position.y = 3.6;
  const headPitch = new Group();
  headPitch.rotation.z = 0.06; // subtle cock
  // angular funeral mask: an octahedron squashed forward, no eyes
  const maskMesh = new Mesh(new OctahedronGeometry(1.6, 0), mask);
  maskMesh.scale.set(1.0, 1.35, 0.85);
  maskMesh.castShadow = true;
  headPitch.add(maskMesh);
  // thin cold seam down the mask
  const seam = ceramicMesh(core, new BoxGeometry(0.18, 2.6, 0.18));
  seam.position.z = 1.0;
  headPitch.add(seam);
  headYaw.add(headPitch);
  neck.add(headYaw);
  body.add(neck);

  // ---- legs (children of bob, NOT the stooped body) ----
  const legL = buildLeg(ceramic, core, -1);
  const legR = buildLeg(ceramic, core, 1);
  bob.add(legL.root, legR.root);

  return {
    group,
    bob,
    body,
    neck,
    headYaw,
    headPitch,
    shoulderL,
    shoulderR,
    armLower: { L: armLowerL, R: armLowerR },
    legL,
    legR,
    ceramic,
    core,
    mask,
  };
}

function facingY(tx: number, tz: number): number {
  return Math.atan2(-tx, -tz);
}

/** Gait for one foot: 60% planted stance, 40% lifted swing. */
function footGait(fp: number): { fo: number; lift: number } {
  if (fp < 0.6) {
    // stance: planted, sliding backward relative to the body
    return { fo: STRIDE / 2 - (fp / 0.6) * STRIDE, lift: 0 };
  }
  const t = (fp - 0.6) / 0.4;
  return { fo: -STRIDE / 2 + t * STRIDE, lift: Math.sin(t * Math.PI) * LIFT };
}

/** Solve a 2-bone chain in the sagittal (z,y) plane; knee bends forward (-z). */
function solveLeg(leg: LegRig, footZ: number, footY: number) {
  // foot target relative to hip (leg.root is at pelvis)
  const fz = footZ;
  const fy = footY - PELVIS_Y;
  let D = Math.hypot(fz, fy);
  const min = Math.abs(L_THIGH - L_SHIN) + 0.05;
  const max = L_THIGH + L_SHIN - 0.05;
  D = Math.max(min, Math.min(max, D));
  const gamma = Math.atan2(-fz, -fy); // direction to foot as an X-rotation
  const cosA = (L_THIGH * L_THIGH + D * D - L_SHIN * L_SHIN) / (2 * L_THIGH * D);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const aThigh = gamma - A;
  const kz = -L_THIGH * Math.sin(aThigh);
  const ky = -L_THIGH * Math.cos(aThigh);
  const shinAbs = Math.atan2(-(fz - kz), -(fy - ky));
  leg.thigh.rotation.x = aThigh;
  leg.shin.rotation.x = shinAbs - aThigh;
}

export function applyWardenPose(
  parts: WardenParts,
  warden: Warden,
  frame: Frame,
  worldX: number,
  worldZ: number,
  heroX: number,
  heroY: number,
  heroZ: number,
  t: number,
) {
  const { group, bob, headYaw, headPitch, legL, legR, armLower, shoulderL, shoulderR } = parts;
  const ry = facingY(frame.tx, frame.tz);
  group.position.set(worldX, 0, worldZ);
  group.rotation.y = ry;

  // ---- legs: alternate gait, IK to ground ----
  const gaitR = footGait(warden.gaitPhase);
  const gaitL = footGait((warden.gaitPhase + 0.5) % 1);
  solveLeg(legR, -gaitR.fo, gaitR.lift); // forward is -z
  solveLeg(legL, -gaitL.fo, gaitL.lift);

  // ---- body bob + sway synced to gait ----
  const gp = warden.gaitPhase * Math.PI * 2;
  bob.position.y = Math.sin(gp * 2) * 0.6 - 0.6; // drop as feet plant
  parts.body.rotation.z = Math.sin(gp) * 0.03; // spine sway

  // ---- arms: loping counter-swing + lunge telegraph ----
  const swing = Math.sin(gp) * 0.5;
  shoulderR.rotation.x = swing;
  shoulderL.rotation.x = -swing;
  armLower.R.rotation.x = 0.4 + Math.max(0, Math.sin(gp)) * 0.5;
  armLower.L.rotation.x = 0.4 + Math.max(0, -Math.sin(gp)) * 0.5;
  if (warden.lungeT > 0) {
    // windup (pull the right arm/shoulder back) then sweep forward
    const w = warden.lungeT / 0.9;
    const strike = 1 - w; // 0 windup -> 1 strike
    shoulderR.rotation.x = -1.1 * w + 1.4 * strike * strike;
    armLower.R.rotation.x = 0.2 + 1.2 * strike;
  }

  // ---- head look-at hero (always) ----
  const dx = heroX - worldX;
  const dz = heroZ - worldZ;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  // rotate (dx,dz) by -ry into warden-local
  const lx = dx * cos + dz * sin;
  const lz = -dx * sin + dz * cos;
  let yaw = Math.atan2(-lx, -lz); // local forward is -Z
  yaw = Math.max(-1.4, Math.min(1.4, yaw));
  headYaw.rotation.y += (yaw - headYaw.rotation.y) * 0.2;
  const horiz = Math.hypot(lx, lz);
  const headWorldY = PELVIS_Y + 20.8; // approx head height in world
  let pitch = Math.atan2(headWorldY - heroY, horiz); // look down toward the hero
  pitch = Math.max(-0.2, Math.min(1.2, pitch));
  headPitch.rotation.x += (pitch - headPitch.rotation.x) * 0.2;

  // ---- cold glow: slow pulse (0.8↔1.6 @0.2Hz) + footfall/telegraph surge ----
  const pulse = 1.2 + 0.4 * Math.sin(t * Math.PI * 2 * 0.2);
  const surge = warden.emissiveSurge * 1.8;
  parts.ceramic.emissiveIntensity = 0.3 + surge * 0.25;
  parts.core.emissiveIntensity = pulse + 0.6 + surge;
  parts.mask.emissiveIntensity = 1.4 + warden.attention * 1.0 + surge;
}

/** World position of a warden foot (for footfall FX / destruction triggers). */
export function wardenFootWorld(
  warden: Warden,
  frame: Frame,
  worldX: number,
  worldZ: number,
  side: 'L' | 'R',
): [number, number, number] {
  const fp = side === 'R' ? warden.gaitPhase : (warden.gaitPhase + 0.5) % 1;
  const g = footGait(fp);
  const localZ = -g.fo; // forward is -z
  const localX = (side === 'R' ? 1 : -1) * LEG_SPREAD;
  // rotate local (localX, localZ) by facing into world
  const ry = facingY(frame.tx, frame.tz);
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const wx = worldX + localX * cos - localZ * sin;
  const wz = worldZ + localX * sin + localZ * cos;
  return [wx, 0.2, wz];
}
