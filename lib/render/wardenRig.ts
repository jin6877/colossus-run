/**
 * Warden render rig (DESIGN §2) — "a giant wearing a porcelain funeral mask".
 * NOT a box: each segment is built from several angular cracked-porcelain PLATES
 * with cold glowing crack SEAMS between them, on deliberately distorted
 * proportions so it reads as monumental (DESIGN §2.1): a tiny eyeless mask, a
 * long gaunt tapering torso, unnaturally long arms with big blunt hands, long
 * legs on broad flat feet, all stooped forward. Two-bone leg IK (hip→knee→foot)
 * drives a slow lope; the head look-at ALWAYS turns to the hero (the intelligence
 * cue, §2.3); crack seams glow cold cyan — the one cold light in the world —
 * pulsing slowly and surging on footfalls/telegraphs. flatShading hides joints.
 */
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { WARDEN_CERAMIC, WARDEN_COLD, WARDEN_CORE, WARDEN_GROOVE } from '../constants';
import type { Warden } from '../warden';
import type { Frame } from '../course';

// H ≈ 50m (DESIGN §2.1); segment lengths below sum to ~that.
const L_THIGH = 12;
const L_SHIN = 11;
const PELVIS_Y = L_THIGH + L_SHIN; // hip height ~23
const LEG_SPREAD = 3.3;
const STRIDE = 16;
const LIFT = 3.6;
const STOOP = 0.3; // ~17° forward stoop

export interface WardenParts {
  group: Group;
  bob: Group;
  body: Group;
  neck: Group;
  headYaw: Group;
  headPitch: Group;
  shoulderL: Group;
  shoulderR: Group;
  armLower: { L: Group; R: Group };
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

export function buildWardenRig(boneQuality: 'full' | 'lite' = 'full'): WardenParts {
  const full = boneQuality === 'full';

  const ceramic = new MeshStandardMaterial({
    color: new Color(WARDEN_CERAMIC),
    roughness: 0.66,
    metalness: 0,
    flatShading: true,
    emissive: new Color(WARDEN_COLD),
    emissiveIntensity: 0.16,
  });
  // darker facet-groove plates so the porcelain reads as many angular pieces
  const groove = new MeshStandardMaterial({
    color: new Color(WARDEN_GROOVE),
    roughness: 0.7,
    metalness: 0,
    flatShading: true,
  });
  const core = new MeshStandardMaterial({
    color: new Color(WARDEN_CORE),
    roughness: 0.6,
    metalness: 0,
    flatShading: true,
    emissive: new Color(WARDEN_CORE),
    emissiveIntensity: 2.0,
  });
  const mask = new MeshStandardMaterial({
    color: new Color(WARDEN_CERAMIC),
    roughness: 0.55,
    metalness: 0,
    flatShading: true,
    emissive: new Color(WARDEN_COLD),
    emissiveIntensity: 1.4,
  });

  const plate = (mat: MeshStandardMaterial, w: number, h: number, d: number) => {
    const m = new Mesh(new BoxGeometry(w, h, d), mat);
    m.castShadow = true;
    return m;
  };
  /** A glowing cold crack seam (thin bright strip proud of a plate). */
  const seam = (len: number, thick = 0.16, mat: MeshStandardMaterial = core) => {
    const m = new Mesh(new BoxGeometry(thick, len, thick), mat);
    m.castShadow = false;
    return m;
  };

  const group = new Group();
  group.name = 'warden';
  const bob = new Group();
  group.add(bob);

  // ============ BODY (stooped): gaunt tapering plates + chest core ============
  const body = new Group();
  body.position.y = PELVIS_Y;
  body.rotation.x = STOOP;
  bob.add(body);

  const pelvis = plate(ceramic, 6, 3.2, 4);
  body.add(pelvis);
  const hipL = plate(groove, 2.2, 2.6, 3.6);
  hipL.position.set(-2.2, -0.2, 0);
  hipL.rotation.z = 0.18;
  const hipR = plate(groove, 2.2, 2.6, 3.6);
  hipR.position.set(2.2, -0.2, 0);
  hipR.rotation.z = -0.14;
  body.add(hipL, hipR);

  const lower = plate(ceramic, 4.8, 8, 3.2);
  lower.position.y = 6;
  const lowerPlate = plate(groove, 3.0, 6.2, 0.5);
  lowerPlate.position.set(0, 6, 1.7);
  body.add(lower, lowerPlate);

  const chestCore = plate(core, 2.2, 4.2, 1.6);
  chestCore.position.set(0, 10, 1.0);
  const chestL = plate(ceramic, 2.4, 5.5, 2.6);
  chestL.position.set(-1.7, 10.5, 0);
  chestL.rotation.z = 0.12;
  const chestR = plate(ceramic, 2.4, 5.5, 2.6);
  chestR.position.set(1.7, 10.5, 0);
  chestR.rotation.z = -0.1;
  body.add(chestCore, chestL, chestR);

  const upper = plate(ceramic, 3.2, 6, 2.4);
  upper.position.y = 14.5;
  body.add(upper);
  const chestSeam = seam(13, 0.22);
  chestSeam.position.set(0, 9, 1.55);
  body.add(chestSeam);
  if (full) {
    const crackA = seam(4, 0.16);
    crackA.position.set(-1.4, 7, 1.55);
    crackA.rotation.z = 0.5;
    const crackB = seam(3.4, 0.16);
    crackB.position.set(1.3, 12, 1.4);
    crackB.rotation.z = -0.7;
    body.add(crackA, crackB);
  }

  // asymmetric shoulders (right rides higher), angular pauldron plates
  const shoulderL = new Group();
  shoulderL.position.set(-2.5, 16.2, 0);
  const shoulderR = new Group();
  shoulderR.position.set(2.5, 16.9, 0);
  const paulL = plate(ceramic, 3.2, 2.6, 3.2);
  paulL.rotation.z = 0.25;
  shoulderL.add(paulL);
  const paulR = plate(ceramic, 3.2, 2.6, 3.2);
  paulR.rotation.z = -0.3;
  shoulderR.add(paulR);

  const makeArm = (parent: Group) => {
    const upA = plate(ceramic, 1.9, 8, 1.9);
    upA.position.y = -4;
    const upB = plate(groove, 1.6, 6.5, 1.6);
    upB.position.y = -10;
    parent.add(upA, upB);
    const elbow = plate(core, 1.5, 1.0, 1.5);
    elbow.position.y = -14;
    parent.add(elbow);

    const lowerPivot = new Group();
    lowerPivot.position.y = -14;
    const foreA = plate(ceramic, 1.5, 7, 1.5);
    foreA.position.y = -3.5;
    const foreB = plate(ceramic, 1.35, 5.5, 1.35);
    foreB.position.y = -9.5;
    lowerPivot.add(foreA, foreB);
    if (full) {
      const foreSeam = seam(9, 0.14);
      foreSeam.position.set(0, -6, 0.8);
      lowerPivot.add(foreSeam);
    }
    const hand = plate(ceramic, 2.9, 3.0, 3.6);
    hand.position.y = -13.5;
    lowerPivot.add(hand);
    const knuckle = plate(groove, 3.0, 1.0, 1.2);
    knuckle.position.set(0, -12.2, 1.5);
    lowerPivot.add(knuckle);
    const nFingers = full ? 3 : 1;
    for (let f = 0; f < nFingers; f++) {
      const finger = plate(ceramic, full ? 0.8 : 2.6, 2.6, 0.8);
      finger.position.set(full ? (f - 1) * 1.0 : 0, -15.4, 1.3);
      lowerPivot.add(finger);
    }
    parent.add(lowerPivot);
    return lowerPivot;
  };
  const armLowerL = makeArm(shoulderL);
  const armLowerR = makeArm(shoulderR);
  body.add(shoulderL, shoulderR);

  // ============ NECK + SMALL EYELESS MASK ============
  const neck = new Group();
  neck.position.y = 16.8;
  const neckMesh = plate(groove, 1.1, 3.4, 1.1);
  neckMesh.position.y = 1.7;
  neck.add(neckMesh);

  const headYaw = new Group();
  headYaw.position.y = 3.6;
  const headPitch = new Group();
  headPitch.rotation.z = 0.06; // subtle cock (uncanny asymmetry)

  const maskMesh = new Mesh(new ConeGeometry(0.95, 1.9, 5), mask);
  maskMesh.rotation.x = Math.PI + 0.35; // flat face forward-down (funeral mask)
  maskMesh.rotation.y = Math.PI / 5;
  maskMesh.castShadow = true;
  headPitch.add(maskMesh);
  const brow = plate(ceramic, 1.5, 0.5, 0.7);
  brow.position.set(0, 0.35, 0.55);
  brow.rotation.x = -0.3;
  const jaw = plate(groove, 0.9, 0.7, 0.6);
  jaw.position.set(0, -0.7, 0.5);
  headPitch.add(brow, jaw);
  const maskSeam = new Mesh(new BoxGeometry(0.12, 1.7, 0.12), mask);
  maskSeam.position.set(0, 0, 0.72);
  headPitch.add(maskSeam);
  headYaw.add(headPitch);
  neck.add(headYaw);
  body.add(neck);

  // ============ LEGS (children of bob, not the stooped body) ============
  const buildLeg = (side: number): LegRig => {
    const root = new Group();
    root.position.set(side * LEG_SPREAD, PELVIS_Y, 0);

    const thigh = new Group();
    const thA = plate(ceramic, 2.5, L_THIGH * 0.6, 2.5);
    thA.position.y = -L_THIGH * 0.3;
    const thB = plate(groove, 2.1, L_THIGH * 0.5, 2.1);
    thB.position.y = -L_THIGH * 0.75;
    thigh.add(thA, thB);
    if (full) {
      const thSeam = seam(L_THIGH * 0.8, 0.16);
      thSeam.position.set(0, -L_THIGH * 0.5, 1.3);
      thigh.add(thSeam);
    }
    root.add(thigh);

    const shin = new Group();
    shin.position.y = -L_THIGH;
    const knee = plate(core, 2.0, 0.9, 2.0);
    shin.add(knee);
    const shA = plate(ceramic, 1.9, L_SHIN * 0.6, 1.9);
    shA.position.y = -L_SHIN * 0.35;
    const shB = plate(groove, 1.6, L_SHIN * 0.5, 1.6);
    shB.position.y = -L_SHIN * 0.78;
    shin.add(shA, shB);
    if (full) {
      const shSeam = seam(L_SHIN * 0.7, 0.14);
      shSeam.position.set(0, -L_SHIN * 0.45, 1.0);
      shin.add(shSeam);
    }
    thigh.add(shin);

    const foot = plate(ceramic, 3.8, 1.3, 5.4);
    foot.position.set(0, -L_SHIN + 0.6, -1.2);
    shin.add(foot);
    const toe = plate(groove, 3.6, 0.9, 1.6);
    toe.position.set(0, -L_SHIN + 0.5, -3.4);
    shin.add(toe);

    return { root, thigh, shin };
  };
  const legL = buildLeg(-1);
  const legR = buildLeg(1);
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
  if (fp < 0.6) return { fo: STRIDE / 2 - (fp / 0.6) * STRIDE, lift: 0 };
  const t = (fp - 0.6) / 0.4;
  return { fo: -STRIDE / 2 + t * STRIDE, lift: Math.sin(t * Math.PI) * LIFT };
}

/** Solve a 2-bone chain in the sagittal (z,y) plane; knee bends forward (-z). */
function solveLeg(leg: LegRig, footZ: number, footY: number) {
  const fz = footZ;
  const fy = footY - PELVIS_Y;
  let D = Math.hypot(fz, fy);
  const min = Math.abs(L_THIGH - L_SHIN) + 0.05;
  const max = L_THIGH + L_SHIN - 0.05;
  D = Math.max(min, Math.min(max, D));
  const gamma = Math.atan2(-fz, -fy);
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
  reach = 0,
) {
  const { group, bob, body, headYaw, headPitch, legL, legR, armLower, shoulderL, shoulderR } = parts;
  const ry = facingY(frame.tx, frame.tz);
  group.position.set(worldX, 0, worldZ);
  group.rotation.y = ry;

  const gaitR = footGait(warden.gaitPhase);
  const gaitL = footGait((warden.gaitPhase + 0.5) % 1);
  solveLeg(legR, -gaitR.fo, gaitR.lift);
  solveLeg(legL, -gaitL.fo, gaitL.lift);

  const gp = warden.gaitPhase * Math.PI * 2;
  bob.position.y = Math.sin(gp * 2) * 0.6 - 0.6;
  body.rotation.z = Math.sin(gp) * 0.03;

  const swing = Math.sin(gp) * 0.5;
  shoulderR.rotation.x = swing;
  shoulderL.rotation.x = -swing;
  armLower.R.rotation.x = 0.4 + Math.max(0, Math.sin(gp)) * 0.5;
  armLower.L.rotation.x = 0.4 + Math.max(0, -Math.sin(gp)) * 0.5;
  if (warden.lungeT > 0) {
    const w = warden.lungeT / 0.9;
    const strike = 1 - w;
    shoulderR.rotation.x = -1.1 * w + 1.4 * strike * strike;
    armLower.R.rotation.x = 0.2 + 1.2 * strike;
  }

  // head look-at hero (always)
  const dx = heroX - worldX;
  const dz = heroZ - worldZ;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const lx = dx * cos + dz * sin;
  const lz = -dx * sin + dz * cos;
  let yaw = Math.atan2(-lx, -lz);
  yaw = Math.max(-1.4, Math.min(1.4, yaw));
  headYaw.rotation.y += (yaw - headYaw.rotation.y) * 0.2;
  const horiz = Math.hypot(lx, lz);
  const headWorldY = PELVIS_Y + 20.4;
  let pitch = Math.atan2(headWorldY - heroY, horiz);
  pitch = Math.max(-0.2, Math.min(1.2, pitch));
  headPitch.rotation.x += (pitch - headPitch.rotation.x) * 0.2;

  // death reach: stoop down + slam an arm overhead toward the hero
  if (reach > 0) {
    body.rotation.x = STOOP + reach * 0.55;
    bob.position.y = -reach * 3;
    shoulderR.rotation.x = -1.2 + reach * 2.6;
    armLower.R.rotation.x = 0.3 + reach * 1.1;
    shoulderL.rotation.x = -0.4 - reach * 0.4;
  }

  // cold glow: slow pulse (0.8↔1.6 @0.2Hz) + footfall/telegraph surge
  const pulse = 1.2 + 0.4 * Math.sin(t * Math.PI * 2 * 0.2);
  const surge = warden.emissiveSurge * 1.8;
  parts.ceramic.emissiveIntensity = 0.16 + surge * 0.2;
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
  const localZ = -g.fo;
  const localX = (side === 'R' ? 1 : -1) * LEG_SPREAD;
  const ry = facingY(frame.tx, frame.tz);
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const wx = worldX + localX * cos - localZ * sin;
  const wz = worldZ + localX * sin + localZ * cos;
  return [wx, 0.2, wz];
}
