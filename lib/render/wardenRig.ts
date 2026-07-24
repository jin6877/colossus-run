/**
 * Warden render rig (DESIGN §2 override v3) — a ~4m AGILE ORGANIC PREDATOR. The old
 * cracked-porcelain PLATES, mechanical glowing SEAMS and eyeless funeral MASK are
 * GONE: this is a living, breathing thing built from smooth flesh masses, muscle,
 * sinew and hide (soft-shaded spheres + capsules, joint spheres hiding the IK
 * bends), with real curved CLAWS, a gaping TOOTHED MAW that breathes and gapes when
 * it strikes, and forward-set watching EYES that brighten when locked on the hero
 * (the "it sees you" cue, §2.3 — organic, warm, never a robot glow). Two-bone leg
 * IK drives a fast lope; the head look-at always turns to the hero; one arm rears
 * back and RAKES a claw across the hero's lane (the core attack). Warm subsurface
 * lift + a wet sheen keep it alive in the Ashen Dusk world; no cold cyan anywhere.
 */
import {
  CapsuleGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import {
  WARDEN_CLAW,
  WARDEN_EYE,
  WARDEN_EYE_GLOW,
  WARDEN_HIDE,
  WARDEN_HIDE_DARK,
  WARDEN_MAW,
  WARDEN_MAW_GLOW,
  WARDEN_SINEW,
  WARDEN_TOOTH,
} from '../constants';
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
  breath: Group; // ribcage/belly — scaled subtly so the creature breathes
  neck: Group;
  headYaw: Group;
  headPitch: Group;
  jaw: Group; // lower jaw — idles slightly, gapes wide on a swipe/death
  shoulderL: Group;
  shoulderR: Group;
  armLower: { L: Group; R: Group };
  legL: LegRig;
  legR: LegRig;
  hide: MeshPhysicalMaterial; // flesh/hide — faint warm subsurface lift
  maw: MeshStandardMaterial; // wet throat glow (breathes, flares on a strike)
  eye: MeshStandardMaterial; // watching eyes (attention-driven brighten)
}

interface LegRig {
  root: Group;
  thigh: Group;
  shin: Group;
}

export function buildWardenRig(boneQuality: 'full' | 'lite' = 'full'): WardenParts {
  const full = boneQuality === 'full';
  const seg = full ? 16 : 9;
  const cap = full ? 5 : 3;

  // --- materials: living flesh, not ceramic ---
  const hide = new MeshPhysicalMaterial({
    color: new Color(WARDEN_HIDE),
    roughness: 0.74,
    metalness: 0,
    // a faint wet sheen (moist hide) — not chrome/plastic
    sheen: 0.6,
    sheenRoughness: 0.55,
    sheenColor: new Color(WARDEN_SINEW),
    clearcoat: 0.12,
    clearcoatRoughness: 0.6,
    // warm subsurface lift so it never reads as a dead robot in shadow
    emissive: new Color(WARDEN_SINEW),
    emissiveIntensity: 0.1,
    flatShading: false,
  });
  const hideDark = new MeshStandardMaterial({
    color: new Color(WARDEN_HIDE_DARK),
    roughness: 0.82,
    metalness: 0,
    flatShading: false,
  });
  const sinew = new MeshStandardMaterial({
    color: new Color(WARDEN_SINEW),
    roughness: 0.66,
    metalness: 0,
    flatShading: false,
  });
  const maw = new MeshStandardMaterial({
    color: new Color(WARDEN_MAW),
    roughness: 0.5,
    metalness: 0,
    emissive: new Color(WARDEN_MAW_GLOW),
    emissiveIntensity: 0.8,
    flatShading: false,
  });
  const eye = new MeshStandardMaterial({
    color: new Color(WARDEN_EYE),
    roughness: 0.32,
    metalness: 0,
    emissive: new Color(WARDEN_EYE_GLOW),
    emissiveIntensity: 1.0,
    flatShading: false,
  });
  const claw = new MeshStandardMaterial({
    color: new Color(WARDEN_CLAW),
    roughness: 0.5,
    metalness: 0,
    flatShading: false,
  });
  const tooth = new MeshStandardMaterial({
    color: new Color(WARDEN_TOOTH),
    roughness: 0.45,
    metalness: 0,
    flatShading: false,
  });
  const pupil = new MeshStandardMaterial({ color: new Color(0x0b0906), roughness: 0.3 });

  // --- geometry helpers (organic masses) ---
  /** A smooth ellipsoid flesh mass (scaled sphere). */
  const mass = (
    mat: MeshStandardMaterial | MeshPhysicalMaterial,
    rx: number,
    ry: number,
    rz: number,
    shadow = true,
  ) => {
    const m = new Mesh(new SphereGeometry(1, seg, Math.max(6, seg - 4)), mat);
    m.scale.set(rx, ry, rz);
    m.castShadow = shadow;
    return m;
  };
  /** A limb muscle (capsule along Y). total length ≈ len; radius r. */
  const muscle = (mat: MeshStandardMaterial | MeshPhysicalMaterial, r: number, len: number) => {
    const m = new Mesh(new CapsuleGeometry(r, Math.max(0.02, len - 2 * r), cap, seg), mat);
    m.castShadow = true;
    return m;
  };
  /** A curved-ish claw / tooth / horn (elongated cone). */
  const spike = (mat: MeshStandardMaterial, r: number, len: number, s = 6) => {
    const m = new Mesh(new ConeGeometry(r, len, s), mat);
    m.castShadow = true;
    return m;
  };

  const group = new Group();
  group.name = 'warden';
  const bob = new Group();
  group.add(bob);

  // ============ BODY (stooped): fleshy trunk on a forward lean ============
  const body = new Group();
  body.position.y = PELVIS_Y;
  body.rotation.x = STOOP;
  bob.add(body);

  // hips / pelvis — a broad mass with asymmetric muscle bulges
  const pelvis = mass(hide, 0.6, 0.42, 0.5);
  body.add(pelvis);
  const hipL = mass(hide, 0.3, 0.34, 0.34);
  hipL.position.set(-0.34, -0.05, 0);
  const hipR = mass(hide, 0.28, 0.32, 0.32);
  hipR.position.set(0.35, -0.02, 0);
  body.add(hipL, hipR);

  // breathing trunk: belly + ribcage swell (scaled at runtime so it BREATHES)
  const breath = new Group();
  body.add(breath);
  const belly = mass(hideDark, 0.5, 0.58, 0.46);
  belly.position.set(0, 0.55, 0.08);
  breath.add(belly);
  const ribcage = mass(hide, 0.56, 0.82, 0.5);
  ribcage.position.set(0, 1.16, 0);
  breath.add(ribcage);
  // a sinew sternum stripe (exposed muscle down the chest)
  const sternum = mass(sinew, 0.1, 0.6, 0.12);
  sternum.position.set(0.02, 1.05, 0.3);
  breath.add(sternum);
  // exposed rib ridges on the flanks (high detail only)
  if (full) {
    for (let i = 0; i < 3; i++) {
      const y = 0.85 + i * 0.28;
      const rr = 0.5 - i * 0.05;
      for (const side of [-1, 1]) {
        const rib = new Mesh(new CapsuleGeometry(0.045, 0.34, 3, 6), sinew);
        rib.position.set(side * (rr - 0.02), y, 0.16);
        rib.rotation.z = side * (0.7 - i * 0.05);
        rib.rotation.x = 0.2;
        rib.castShadow = true;
        breath.add(rib);
      }
    }
  }
  // dorsal spine ridge — a row of bony bumps up the back (beast read)
  const nSpine = full ? 5 : 3;
  for (let i = 0; i < nSpine; i++) {
    const t = i / (nSpine - 1);
    const s = spike(claw, 0.06 + 0.03 * (1 - t), 0.22 + 0.16 * (1 - Math.abs(t - 0.4) * 2), 5);
    s.position.set((i % 2 ? 0.03 : -0.03) * (full ? 1 : 0), 0.5 + t * 1.15, -0.42 + t * 0.05);
    s.rotation.x = -2.5; // point up-and-back along the spine
    breath.add(s);
  }

  // ---- asymmetric shoulders (right rides higher), fleshy deltoids ----
  const shoulderL = new Group();
  shoulderL.position.set(-0.46, 1.5, 0);
  const shoulderR = new Group();
  shoulderR.position.set(0.48, 1.6, 0);
  const deltL = mass(hide, 0.32, 0.3, 0.32);
  shoulderL.add(deltL);
  const deltR = mass(hide, 0.34, 0.32, 0.34);
  shoulderR.add(deltR);

  const makeArm = (parent: Group) => {
    // upper arm (deltoid -> elbow at y≈-0.9)
    const upA = muscle(hide, 0.15, 0.92);
    upA.position.y = -0.45;
    parent.add(upA);
    const elbow = mass(hide, 0.16, 0.16, 0.16);
    elbow.position.y = -0.9;
    parent.add(elbow);

    const lowerPivot = new Group();
    lowerPivot.position.y = -0.9;
    const foreA = muscle(hide, 0.13, 0.82);
    foreA.position.y = -0.42;
    lowerPivot.add(foreA);
    const wrist = mass(hide, 0.13, 0.12, 0.13);
    wrist.position.y = -0.86;
    lowerPivot.add(wrist);
    // gnarled clawed hand: a palm mass + long raking claws
    const palm = mass(hide, 0.17, 0.14, 0.2);
    palm.position.y = -0.98;
    lowerPivot.add(palm);
    const nClaws = full ? 4 : 2;
    for (let f = 0; f < nClaws; f++) {
      const off = full ? (f - 1.5) * 0.1 : (f - 0.5) * 0.16;
      // a knuckle then a curved claw
      const knuck = mass(hide, 0.05, 0.05, 0.06);
      knuck.position.set(off, -1.06, 0.12);
      lowerPivot.add(knuck);
      const c = spike(claw, 0.05, 0.42, 5);
      c.position.set(off, -1.2, 0.2);
      c.rotation.x = 2.15; // hook forward-down (raking claws)
      lowerPivot.add(c);
    }
    parent.add(lowerPivot);
    return lowerPivot;
  };
  const armLowerL = makeArm(shoulderL);
  const armLowerR = makeArm(shoulderR);
  body.add(shoulderL, shoulderR);

  // ============ NECK + ORGANIC HEAD (skull + gaping toothed maw + eyes) ============
  const neck = new Group();
  neck.position.y = 1.6;
  neck.rotation.x = -0.3; // crane forward
  const neckMesh = muscle(hide, 0.17, 0.46);
  neckMesh.position.y = 0.2;
  neck.add(neckMesh);

  const headYaw = new Group();
  headYaw.position.y = 0.42;
  const headPitch = new Group();
  headPitch.rotation.z = 0.05; // subtle cock (uncanny asymmetry)

  // cranium — elongated skull, snout projecting FORWARD (-Z, where look-at aims)
  const cranium = mass(hide, 0.29, 0.27, 0.34);
  cranium.position.set(0, 0.05, 0.02);
  headPitch.add(cranium);
  // brow ridge over the eyes
  const brow = mass(hide, 0.28, 0.1, 0.16);
  brow.position.set(0, 0.16, -0.18);
  brow.rotation.x = -0.25;
  headPitch.add(brow);
  // upper snout + wet upper gum (maw interior visible when it gapes)
  const snout = mass(hide, 0.2, 0.15, 0.26);
  snout.position.set(0, -0.04, -0.28);
  headPitch.add(snout);
  const upperGum = mass(maw, 0.16, 0.08, 0.22, false);
  upperGum.position.set(0, -0.12, -0.3);
  headPitch.add(upperGum);
  // upper teeth (point down)
  const nTeeth = full ? 5 : 3;
  for (let i = 0; i < nTeeth; i++) {
    const x = (i - (nTeeth - 1) / 2) * 0.09;
    const tt = spike(tooth, 0.028, 0.16 + (i % 2 ? 0.05 : 0), 4);
    tt.position.set(x, -0.2, -0.34 - Math.abs(x) * 0.1);
    tt.rotation.x = Math.PI; // point down
    headPitch.add(tt);
  }

  // lower jaw — hinged group that gapes
  const jaw = new Group();
  jaw.position.set(0, -0.14, -0.02);
  const jawMesh = mass(hide, 0.18, 0.12, 0.26);
  jawMesh.position.set(0, -0.04, -0.24);
  jaw.add(jawMesh);
  const lowerGum = mass(maw, 0.14, 0.07, 0.2, false);
  lowerGum.position.set(0, 0.02, -0.26);
  jaw.add(lowerGum);
  // deep throat (glows warm from within when the maw opens)
  const throat = mass(maw, 0.13, 0.1, 0.14, false);
  throat.position.set(0, 0.02, -0.08);
  jaw.add(throat);
  for (let i = 0; i < nTeeth; i++) {
    const x = (i - (nTeeth - 1) / 2) * 0.09;
    const tt = spike(tooth, 0.026, 0.14 + (i % 2 ? 0 : 0.04), 4);
    tt.position.set(x, 0.06, -0.3 - Math.abs(x) * 0.1);
    // default cone points +Y (up) — correct for lower teeth
    jaw.add(tt);
  }
  headPitch.add(jaw);

  // eyes — forward-set, watching. two mains + a couple small uncanny ones (full)
  const addEye = (x: number, y: number, z: number, r: number) => {
    const e = new Mesh(new SphereGeometry(r, 10, 8), eye);
    e.position.set(x, y, z);
    headPitch.add(e);
    const p = new Mesh(new SphereGeometry(r * 0.5, 8, 6), pupil);
    p.position.set(x, y, z - r * 0.7);
    headPitch.add(p);
  };
  addEye(-0.17, 0.08, -0.16, 0.075);
  addEye(0.18, 0.06, -0.16, 0.08); // slightly uneven (asymmetry)
  if (full) {
    addEye(-0.22, -0.02, -0.05, 0.035);
    addEye(0.24, 0.12, -0.04, 0.03);
    addEye(0.05, 0.19, -0.12, 0.03);
  }
  // a pair of small back-swept horns
  for (const side of [-1, 1]) {
    const h = spike(claw, 0.05, 0.34, 5);
    h.position.set(side * 0.16, 0.24, 0.14);
    h.rotation.set(-2.4, 0, side * 0.3);
    headPitch.add(h);
  }

  headYaw.add(headPitch);
  neck.add(headYaw);
  body.add(neck);

  // ============ LEGS (children of bob, not the stooped body) ============
  const buildLeg = (side: number): LegRig => {
    const root = new Group();
    root.position.set(side * LEG_SPREAD, PELVIS_Y, 0);

    const thigh = new Group();
    const hipJoint = mass(hide, 0.2, 0.2, 0.2);
    thigh.add(hipJoint);
    const thM = muscle(hide, 0.19, L_THIGH);
    thM.position.y = -L_THIGH * 0.5;
    thigh.add(thM);
    root.add(thigh);

    const shin = new Group();
    shin.position.y = -L_THIGH;
    const knee = mass(hide, 0.16, 0.16, 0.16);
    shin.add(knee);
    const shM = muscle(hide, 0.14, L_SHIN * 0.95);
    shM.position.y = -L_SHIN * 0.48;
    shin.add(shM);
    thigh.add(shin);

    // ankle + a splayed clawed foot
    const ankle = mass(hide, 0.13, 0.13, 0.13);
    ankle.position.y = -L_SHIN;
    shin.add(ankle);
    const foot = mass(hide, 0.18, 0.1, 0.32);
    foot.position.set(0, -L_SHIN + 0.02, -0.16);
    shin.add(foot);
    const nToes = full ? 3 : 2;
    for (let i = 0; i < nToes; i++) {
      const x = (i - (nToes - 1) / 2) * 0.14;
      const toe = spike(claw, 0.05, 0.28, 5);
      toe.position.set(x, -L_SHIN + 0.0, -0.36);
      toe.rotation.x = 2.4; // point forward-down (dig into the ground)
      shin.add(toe);
    }

    return { root, thigh, shin };
  };
  const legL = buildLeg(-1);
  const legR = buildLeg(1);
  bob.add(legL.root, legR.root);

  return {
    group,
    bob,
    body,
    breath,
    neck,
    headYaw,
    headPitch,
    jaw,
    shoulderL,
    shoulderR,
    armLower: { L: armLowerL, R: armLowerR },
    legL,
    legR,
    hide,
    maw,
    eye,
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
  const { group, bob, body, breath, jaw, headYaw, headPitch, legL, legR, armLower, shoulderL, shoulderR } =
    parts;
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

  // breathing: the ribcage/belly swell + a subtle jaw idle (it's ALIVE)
  const breathe = Math.sin(t * Math.PI * 2 * 0.28);
  const bs = 1 + breathe * 0.035;
  breath.scale.set(bs, 1 + breathe * 0.02, bs);

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

  // maw gape: idle-breathe, wide during a swipe, widest on the death slam
  let jawOpen = 0.14 + breathe * 0.05;
  if (warden.attacking && reach === 0) jawOpen = 0.14 + warden.swipeProgress * 0.72;
  if (reach > 0) jawOpen = 0.35 + reach * 0.55;
  jaw.rotation.x += (jawOpen - jaw.rotation.x) * 0.4;

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

  // living glow (warm, organic — never a robot seam). Slow breathing pulse on the
  // throat + a hide subsurface lift; the eyes brighten when locked on the hero; a
  // swipe/telegraph surge flares throat + eyes (it's about to strike).
  const pulse = 1.0 + 0.3 * Math.sin(t * Math.PI * 2 * 0.2);
  const surge = warden.emissiveSurge * 1.3;
  parts.hide.emissiveIntensity = 0.09 + surge * 0.1; // faint warm subsurface
  parts.maw.emissiveIntensity = 0.55 * pulse + 0.3 + surge * 1.0; // wet throat, breathes + flares
  parts.eye.emissiveIntensity = 0.8 + warden.attention * 1.15 + surge * 0.7; // "it sees you"
}
