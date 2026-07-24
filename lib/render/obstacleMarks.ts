/**
 * Obstacle danger telegraphs (live-play feedback: "무엇을 피하는지 모르겠다").
 * Every hazard gets a flat road decal + a contact shadow so it (a) reads as a
 * real object sitting on the ground and (b) tells the player at a glance WHAT to
 * do — color + icon are the code (warm = danger, DESIGN §1 축1; cold cyan stays
 * the warden's only):
 *   steer/block/vehicle/rubble → red diagonal hazard stripes  (go around)
 *   jump / gap                 → amber up-chevrons             (hop it / leap)
 *   slide                      → amber down-chevrons           (duck under)
 *   gap                        → dark pit under the red rim    (a hole, jump it)
 * Textures are generated once and shared. All decals are addit-safe alpha planes
 * that draw just above the road (polygonOffset) — no z-fighting.
 */
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Texture,
} from 'three';
import { HAZARD_RED, HAZARD_AMBER } from '../constants';
import type { ObstacleKind } from '../chunk/chunkTypes';

function rgba(hex: number, a: number): string {
  const c = new Color(hex);
  return `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},${a})`;
}

let _shadow: Texture | null = null;
const _stripes = new Map<number, Texture>();
const _chevron = new Map<string, Texture>();
let _pit: Texture | null = null;

function softShadowTex(): Texture {
  if (_shadow) return _shadow;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.32)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  _shadow = new CanvasTexture(c);
  return _shadow;
}

function stripesTex(hex: number): Texture {
  const cached = _stripes.get(hex);
  if (cached) return cached;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  // soft edge fade so the zone melts into the road
  const fade = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.62);
  fade.addColorStop(0, rgba(hex, 0.5));
  fade.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, S, S);
  // diagonal hazard bars
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.5, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = rgba(hex, 0.85);
  ctx.lineWidth = 12;
  for (let x = -S; x < S * 2; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + S, S);
    ctx.stroke();
  }
  ctx.restore();
  const t = new CanvasTexture(c);
  _stripes.set(hex, t);
  return t;
}

function chevronTex(hex: number, up: boolean): Texture {
  const key = `${hex}_${up}`;
  const cached = _chevron.get(key);
  if (cached) return cached;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const fade = ctx.createLinearGradient(0, 0, 0, S);
  fade.addColorStop(0, rgba(hex, up ? 0.05 : 0.5));
  fade.addColorStop(0.5, rgba(hex, 0.32));
  fade.addColorStop(1, rgba(hex, up ? 0.5 : 0.05));
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = rgba(hex, 0.95);
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const y = 30 + i * 30;
    ctx.beginPath();
    if (up) {
      ctx.moveTo(30, y + 16);
      ctx.lineTo(S / 2, y - 8);
      ctx.lineTo(S - 30, y + 16);
    } else {
      ctx.moveTo(30, y - 16);
      ctx.lineTo(S / 2, y + 8);
      ctx.lineTo(S - 30, y - 16);
    }
    ctx.stroke();
  }
  const t = new CanvasTexture(c);
  _chevron.set(key, t);
  return t;
}

function pitTex(): Texture {
  if (_pit) return _pit;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(4,4,5,0.96)');
  g.addColorStop(0.62, 'rgba(6,6,7,0.9)');
  g.addColorStop(0.74, rgba(HAZARD_RED, 0.85)); // hot rim
  g.addColorStop(0.9, rgba(HAZARD_RED, 0.15));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  _pit = new CanvasTexture(c);
  return _pit;
}

function decalMesh(tex: Texture, w: number, d: number, y = 0.06): Mesh {
  const m = new Mesh(
    new PlaneGeometry(w, d),
    new MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.renderOrder = 3;
  return m;
}

/**
 * Build the danger telegraph for an obstacle in WORLD space. Returns a group
 * (already positioned + yawed to the course) to add to the chunk. `solid` adds a
 * contact shadow so blocks/vehicles/rubble don't look like they float.
 */
export function obstacleMark(
  kind: ObstacleKind,
  x: number,
  z: number,
  facing: number,
  latHalf: number,
): Group {
  const g = new Group();
  g.position.set(x, 0, z);
  g.rotation.y = facing;

  const w = latHalf * 2 + 2.4;
  const zone =
    kind === 'gap'
      ? decalMesh(pitTex(), w, latHalf * 2 + 2, 0.05)
      : kind === 'jump'
      ? decalMesh(chevronTex(HAZARD_AMBER, true), w, 7)
      : kind === 'slide'
      ? decalMesh(chevronTex(HAZARD_AMBER, false), w, 7)
      : decalMesh(stripesTex(HAZARD_RED), w, 5.5);
  // lead-in: nudge the zone toward the approaching player (+Z is behind, since
  // forward is -Z) so it's spotted early
  zone.position.z = 1.5;
  g.add(zone);

  // gaps also get red up-chevrons over the pit (jump cue)
  if (kind === 'gap') {
    const cue = decalMesh(chevronTex(HAZARD_RED, true), w, 6, 0.07);
    cue.position.z = 3.5;
    g.add(cue);
  }

  // contact shadow for solids
  if (kind === 'block' || kind === 'vehicle' || kind === 'rubble' || kind === 'slide') {
    const sh = decalMesh(softShadowTex(), latHalf * 2 + 2, latHalf * 2 + 3, 0.04);
    (sh.material as MeshBasicMaterial).polygonOffsetFactor = -3;
    g.add(sh);
  }
  return g;
}
