/**
 * Warden render rig (DESIGN §2, re-proportioned per the user override) — a ~4m
 * AGILE PORCELAIN PREDATOR, not a 50m titan. Each segment is still built from
 * angular cracked-porcelain PLATES with cold glowing crack SEAMS and an eyeless
 * funeral mask, but the 50m "monumental" distortions (tiny head, absurdly long
 * limbs) are dropped for a lean, forward-stooped stalker on athletic legs with
 * long clawing arms. Two-bone leg IK drives a fast lope; the head look-at always
 * turns to the hero (the intelligence cue, §2.3); one arm rears back and RAKES a
 * claw across the hero's lane (the new core attack). flatShading hides the joints.
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

// H ≈ 4m (DESIGN §2.1 override). Segment lengths below sum to ~that.
const L_THIGH = 1.05;
const L_SHIN = 1.05;
const PELVIS_Y = L_THIGH + L_SHIN; // hip height ~2.1
const LEG_SPREAD = 0.55;
const STRIDE = 1.4;
const LIFT = 0.5;
const STOOP = 0.42; // ~24° forward stalking lean

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
  const seam = (len: number, thick = 0.03, mat: MeshStandardMaterial = core) => {
    const m = new Mesh(new BoxGeometry(thick, len, thick), mat);
    m.castShadow = false;
    return m;
  };

  const group = new Group();
  group.name = 'warden';
  const bob = new Group();
  group.add(bob);

  // ============ BODY (stooped): lean tapering plates + chest core ============
  const body = new Group();
  body.position.y = PELVIS_Y;
  body.rotation.x = STOOP;
  bob.add(body);

  const pelvis = plate(ceramic, 0.9, 0.5, 0.6);
  body.add(pelvis);
  const hipL = plate(groove, 0.34, 0.42, 0.56);
  hipL.position.set(-0.34, -0.04, 0);
  hipL.rotation.z = 0.16;
  const hipR = plate(groove, 0.34, 0.42, 0.56);
  hipR.position.set(0.34, -0.04, 0);
  hipR.rotation.z = -0.12;
  body.add(hipL, hipR);

  const lower = plate(ceramic, 0.74, 0.92, 0.5);
  lower.position.y = 0.62;
  const lowerPlate = plate(groove, 0.46, 0.7, 0.08);
  lowerPlate.position.set(0, 0.62, 0.27);
  body.add(lower, lowerPlate);

  const chestCore = plate(core, 0.34, 0.6, 0.24);
  chestCore.position.set(0, 1.14, 0.14);
  const chestL = plate(ceramic, 0.36, 0.82, 0.42);
  chestL.position.set(-0.26, 1.2, 0);
  chestL.rotation.z = 0.12;
  const chestR = plate(ceramic, 0.36, 0.82, 0.42);
  chestR.position.set(0.26, 1.2, 0);
  chestR.rotation.z = -0.1;
  body.add(chestCore, chestL, chestR);

  const upper = plate(ceramic, 0.5, 0.56, 0.4);
  upper.position.y = 1.62;
  body.add(upper);
  const chestSeam = seam(1.5, 0.045);
  chestSeam.position.set(0, 1.0, 0.26);
  body.add(chestSeam);
  if (full) {
    const crackA = seam(0.5, 0.03);
    crackA.position.set(-0.22, 0.78, 0.27);
    crackA.rotation.z = 0.5;
    const crackB = seam(0.42, 0.03);
    crackB.position.set(0.2, 1.34, 0.24);
    crackB.rotation.z = -0.7;
    body.add(crackA, crackB);
  }

  // asymmetric shoulders (right rides higher), angular pauldron plates
  const shoulderL = new Group();
  shoulderL.position.set(-0.42, 1.5, 0);
  const shoulderR = new Group();
  shoulderR.position.set(0.42, 1.58, 0);
  const paulL = plate(ceramic, 0.42, 0.36, 0.42);
  paulL.rotation.z = 0.25;
  shoulderL.add(paulL);
  const paulR = plate(ceramic, 0.42, 0.36, 0.42);
  paulR.rotation.z = -0.3;
  shoulderR.add(paulR);

  const makeArm = (parent: Group) => {
    const upA = plate(ceramic, 0.26, 0.9, 0.26);
    upA.position.y = -0.45;
    parent.add(upA);
    const elbow = plate(core, 0.2, 0.14, 0.2);
    elbow.position.y = -0.9;
    parent.add(elbow);

    const lowerPivot = new Group();
    lowerPivot.position.y = -0.9;
    const foreA = plate(ceramic, 0.21, 0.78, 0.21);
    foreA.position.y = -0.42;
    lowerPivot.add(foreA);
    if (full) {
      const foreSeam = seam(0.72, 0.028);
      foreSeam.position.set(0, -0.42, 0.12);
      lowerPivot.add(foreSeam);
    }
    // big blunt clawed hand
    const hand = plate(ceramic, 0.34, 0.34, 0.42);
    hand.position.y = -0.95;
    lowerPivot.add(hand);
    const nClaws = full ? 3 : 1;
    for (let f = 0; f < nClaws; f++) {
      const claw = new Mesh(new ConeGeometry(0.06, 0.4, 4), full ? ceramic : ceramic);
      claw.position.set(full ? (f - 1) * 0.11 : 0, -1.18, 0.16);
      claw.rotation.x = 1.9; // point forward-down (raking claws)
      claw.castShadow = true;
      lowerPivot.add(claw);
    }
    parent.add(lowerPivot);
    return lowerPivot;
  };
  const armLowerL = makeArm(shoulderL);
  const armLowerR = makeArm(shoulderR);
  body.add(shoulderL, shoulderR);

  // ============ NECK + EYELESS MASK ============
  const neck = new Group();
  neck.position.y = 1.62;
  const neckMesh = plate(groove, 0.18, 0.36, 0.18);
  neckMesh.position.y = 0.18;
  neck.add(neckMesh);

  const headYaw = new Group();
  headYaw.position.y = 0.38;
  const headPitch = new Group();
  headPitch.rotation.z = 0.06; // subtle cock (uncanny asymmetry)

  const maskMesh = new Mesh(new ConeGeometry(0.24, 0.5, 5), mask);
  maskMesh.rotation.x = Math.PI + 0.35; // flat face forward-down (funeral mask)
  maskMesh.rotation.y = Math.PI / 5;
  maskMesh.castShadow = true;
  headPitch.add(maskMesh);
  const brow = plate(ceramic, 0.38, 0.13, 0.18);
  brow.position.set(0, 0.09, 0.15);
  brow.rotation.x = -0.3;
  const jaw = plate(groove, 0.22, 0.17, 0.16);
  jaw.position.set(0, -0.18, 0.13);
  headPitch.add(brow, jaw);
  const maskSeam = new Mesh(new BoxGeometry(0.03, 0.44, 0.03), mask);
  maskSeam.position.set(0, 0, 0.19);
  headPitch.add(maskSeam);
  headYaw.add(headPitch);
  neck.add(headYaw);
  body.add(neck);

  // ============ LEGS (children of bob, not the stooped body) ============
  const buildLeg = (side: number): LegRig => {
    const root = new Group();
    root.position.set(side * LEG_SPREAD, PELVIS_Y, 0);

    const thigh = new Group();
    const thA = plate(ceramic, 0.32, L_THIGH * 0.62, 0.32);
    thA.position.y = -L_THIGH * 0.31;
    const thB = plate(groove, 0.27, L_THIGH * 0.5, 0.27);
    thB.position.y = -L_THIGH * 0.76;
    thigh.add(thA, thB);
    if (full) {
      const thSeam = seam(L_THIGH * 0.8, 0.03);
      thSeam.position.set(0, -L_THIGH * 0.5, 0.16);
      thigh.add(thSeam);
    }
    root.add(thigh);

    const shin = new Group();
    shin.position.y = -L_THIGH;
    const knee = plate(core, 0.26, 0.12, 0.26);
    shin.add(knee);
    const shA = plate(ceramic, 0.24, L_SHIN * 0.62, 0.24);
    shA.position.y = -L_SHIN * 0.36;
    const shB = plate(groove, 0.2, L_SHIN * 0.5, 0.2);
    shB.position.y = -L_SHIN * 0.78;
    shin.add(shA, shB);
    if (full) {
      const shSeam = seam(L_SHIN * 0.7, 0.026);
      shSeam.position.set(0, -L_SHIN * 0.45, 0.12);
      shin.add(shSeam);
    }
    thigh.add(shin);

    const foot = plate(ceramic, 0.4, 0.16, 0.66);
    foot.position.set(0, -L_SHIN + 0.08, -0.14);
    shin.add(foot);
    const toe = plate(groove, 0.38, 0.12, 0.2);
    toe.position.set(0, -L_SHIN + 0.06, -0.42);
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
  const min = Math.abs(L_THIGH - L_SHIN) + 0.02;
  const max = L_THIGH + L_SHIN - 0.02;
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

  // legs: fast lope (2-bone IK)
  const gaitR = footGait(warden.gaitPhase);
  const gaitL = footGait((warden.gaitPhase + 0.5) % 1);
  solveLeg(legR, -gaitR.fo, gaitR.lift);
  solveLeg(legL, -gaitL.fo, gaitL.lift);
  legL.root.position.x += (-LEG_SPREAD - legL.root.position.x) * 0.5;
  legR.root.position.x += (LEG_SPREAD - legR.root.position.x) * 0.5;

  const gp = warden.gaitPhase * Math.PI * 2;
  bob.position.y = Math.abs(Math.sin(gp)) * 0.12 - 0.06;
  body.rotation.z = Math.sin(gp) * 0.04;
  body.rotation.x = STOOP;

  // default arm swing (loping, reaching predator)
  const swing = Math.sin(gp) * 0.6;
  shoulderR.rotation.set(swing, 0, 0);
  shoulderL.rotation.set(-swing, 0, 0);
  armLower.R.rotation.set(0.5 + Math.max(0, Math.sin(gp)) * 0.5, 0, 0);
  armLower.L.rotation.set(0.5 + Math.max(0, -Math.sin(gp)) * 0.5, 0, 0);

  // ---- claw swipe override on the active arm (the core attack) ----
  if (warden.attacking && reach === 0) {
    const armSign = warden.swipeArm === 'R' ? 1 : -1;
    const sh = warden.swipeArm === 'R' ? shoulderR : shoulderL;
    const fore = warden.swipeArm === 'R' ? armLower.R : armLower.L;
    // reach across toward the locked lane, mapped to a lateral shoulder tilt
    const reachX = warden.targetLat - warden.lateral;
    const reachTilt = Math.max(-1.0, Math.min(1.0, reachX * 0.5));
    if (warden.swipePhase === 'windup') {
      const w = warden.swipeProgress;
      sh.rotation.x = -1.35 * w; // rear the arm up + back
      sh.rotation.z = armSign * (0.35 + 0.55 * w); // cock outward across the body
      fore.rotation.x = 0.6 + 1.1 * w; // curl the claw ready
    } else {
      // strike: whip the arm down + across, raking through the locked band
      const p = warden.swipeProgress;
      sh.rotation.x = -1.35 + 2.7 * p;
      sh.rotation.z = armSign * 0.9 - (armSign * 0.9 + reachTilt) * p;
      fore.rotation.x = 1.7 - 0.9 * p;
    }
  }

  // head look-at hero (always) — the intelligence cue
  const dx = heroX - worldX;
  const dz = heroZ - worldZ;
  const cos = Math.cos(ry);
  const sin = Math.sin(ry);
  const lx = dx * cos + dz * sin;
  const lz = -dx * sin + dz * cos;
  let yaw = Math.atan2(-lx, -lz);
  yaw = Math.max(-1.4, Math.min(1.4, yaw));
  headYaw.rotation.y += (yaw - headYaw.rotation.y) * 0.25;
  const horiz = Math.hypot(lx, lz);
  const headWorldY = PELVIS_Y + 1.9;
  let pitch = Math.atan2(headWorldY - heroY, Math.max(0.3, horiz));
  pitch = Math.max(-0.4, Math.min(1.0, pitch));
  headPitch.rotation.x += (pitch - headPitch.rotation.x) * 0.25;

  // death reach: rear up + slam the claw down over the caught hero
  if (reach > 0) {
    body.rotation.x = STOOP - reach * 0.5; // rear back
    bob.position.y = -reach * 0.4;
    shoulderR.rotation.set(-1.4 + reach * 2.8, -0.2, 0);
    armLower.R.rotation.set(0.3 + reach * 1.2, 0, 0);
    shoulderL.rotation.set(-0.5 - reach * 0.5, 0, 0);
  }

  // cold glow: slow pulse (0.8↔1.6 @0.2Hz) + swipe/telegraph surge
  const pulse = 1.2 + 0.4 * Math.sin(t * Math.PI * 2 * 0.2);
  const surge = warden.emissiveSurge * 1.8;
  parts.ceramic.emissiveIntensity = 0.16 + surge * 0.25;
  parts.core.emissiveIntensity = pulse + 0.6 + surge;
  parts.mask.emissiveIntensity = 1.4 + warden.attention * 1.0 + surge;
}
