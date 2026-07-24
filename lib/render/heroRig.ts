/**
 * Hero render rig (DESIGN §5) — a stylized faceted runner assembled from box /
 * capsule segments (no rigged GLTF; PROJECT.md §3). Motion IS the character: a
 * procedural run cycle drives leg/arm swing, steering rolls the torso (lean-into-
 * turn), slide tucks, jump curls, a graze stumbles. Bone off-white catches the
 * warm back-light rim; a single muted-amber accent is the only warmth on the
 * hero (the eye's anchor). flatShading hides the segment joints.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { HERO_BONE, HERO_AMBER } from '../constants';
import type { Hero } from '../hero';
import type { Frame } from '../course';

export interface HeroParts {
  group: Group;
  root: Group; // holds vertical bob + slide crouch
  torso: Group;
  legL: Group;
  legR: Group;
  armL: Group;
  armR: Group;
}

function limb(mat: MeshStandardMaterial, w: number, h: number, d: number, pivotY: number, x: number): Group {
  const g = new Group();
  g.position.set(x, pivotY, 0);
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.y = -h / 2; // hang below the pivot
  m.castShadow = true;
  g.add(m);
  return g;
}

export function buildHeroRig(): HeroParts {
  const bone = new MeshStandardMaterial({
    color: new Color(HERO_BONE),
    roughness: 0.7,
    metalness: 0,
    flatShading: true,
  });
  const amber = new MeshStandardMaterial({
    color: new Color(HERO_AMBER),
    roughness: 0.6,
    metalness: 0,
    flatShading: true,
  });

  const group = new Group();
  group.name = 'hero';
  const root = new Group();
  group.add(root);

  const torso = new Group();
  torso.position.y = 1.05;
  const torsoMesh = new Mesh(new CapsuleGeometry(0.34, 0.7, 3, 8), bone);
  torsoMesh.scale.set(1, 1, 0.7);
  torsoMesh.position.y = 0.15;
  torsoMesh.castShadow = true;
  torso.add(torsoMesh);
  // head
  const head = new Mesh(new BoxGeometry(0.36, 0.4, 0.36), bone);
  head.position.y = 0.75;
  head.castShadow = true;
  torso.add(head);
  // amber scarf/band — the single warm accent
  const scarf = new Mesh(new BoxGeometry(0.46, 0.16, 0.46), amber);
  scarf.position.y = 0.5;
  torso.add(scarf);
  // small backpack accent (also amber-adjacent warmth, catches rim)
  const pack = new Mesh(new BoxGeometry(0.34, 0.44, 0.22), amber);
  pack.position.set(0, 0.2, -0.32);
  pack.castShadow = true;
  torso.add(pack);
  root.add(torso);

  const legL = limb(bone, 0.24, 0.92, 0.26, 0.92, -0.2);
  const legR = limb(bone, 0.24, 0.92, 0.26, 0.92, 0.2);
  const armL = limb(bone, 0.2, 0.66, 0.2, 1.5, -0.44);
  const armR = limb(bone, 0.2, 0.66, 0.2, 1.5, 0.44);
  root.add(legL, legR, armL, armR);

  return { group, root, torso, legL, legR, armL, armR };
}

/** Face a direction in XZ (default forward is -Z). */
function facingY(tx: number, tz: number): number {
  return Math.atan2(-tx, -tz);
}

export function applyHeroPose(parts: HeroParts, hero: Hero, frame: Frame, worldX: number, worldZ: number) {
  const { group, root, torso, legL, legR, armL, armR } = parts;
  group.position.set(worldX, hero.yJump, worldZ);
  group.rotation.y = facingY(frame.tx, frame.tz);

  const cycle = hero.phase * Math.PI * 2;
  const running = hero.grounded && !hero.sliding;
  const swingAmp = running ? 0.95 : 0.35;

  // legs alternate; arms counter-swing
  legL.rotation.x = Math.sin(cycle) * swingAmp;
  legR.rotation.x = Math.sin(cycle + Math.PI) * swingAmp;
  armL.rotation.x = Math.sin(cycle + Math.PI) * swingAmp * 0.8;
  armR.rotation.x = Math.sin(cycle) * swingAmp * 0.8;

  // torso lean into the turn (roll) + slight forward pitch when running
  torso.rotation.z = -hero.lean;
  root.rotation.z = -hero.lean * 0.35;
  let pitch = running ? 0.14 : 0.0;

  // slide: crouch the root, tuck legs forward, pitch torso down
  if (hero.sliding) {
    root.position.y = -0.55;
    pitch = 0.7;
    legL.rotation.x = 1.2;
    legR.rotation.x = 1.35;
    armL.rotation.x = -0.6;
    armR.rotation.x = -0.5;
  } else {
    root.position.y += (0 - root.position.y) * 0.4;
  }

  // airborne: curl legs up
  if (!hero.grounded) {
    legL.rotation.x = -0.6;
    legR.rotation.x = -0.9;
    armL.rotation.x = -1.1;
    armR.rotation.x = -1.0;
    pitch = -0.15;
  }

  // graze stumble: extra forward lurch
  if (hero.stumbleT > 0) {
    pitch += hero.stumbleT * 1.2;
    torso.rotation.z += Math.sin(hero.stumbleT * 40) * 0.15;
  }

  torso.rotation.x = pitch;
}
