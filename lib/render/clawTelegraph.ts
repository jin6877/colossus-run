/**
 * Claw-swipe telegraph (the ~4m predator core) — a NATURAL ground streak that
 * marks the lane band the warden's claw is about to rake across. No color paint
 * (user feedback): a soft dark swipe-shadow plus a few faint warm dust rake lines
 * are the whole read — the shadow IS the death band, so you juke out of it. As the
 * windup fills (progress 0→1) the streak darkens + sharpens and the rake lines
 * bite in, giving urgency; the strike replaces it with the impact dust FX. The
 * streak is oriented to the course so its WIDTH spans the lateral kill band.
 */
import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type Texture,
} from 'three';

/** Soft dark swipe shadow (an elongated band across the lane). */
function shadowTex(): Texture {
  const W = 256;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.42)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // squash vertically so it reads as a broad lateral band, not a disc
  ctx.globalCompositeOperation = 'destination-in';
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.5, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return new CanvasTexture(c);
}

/** A few faint warm claw-rake lines running along the sweep (lateral). */
function rakeTex(): Texture {
  const W = 256;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = 'rgba(214,201,178,0.55)'; // faint warm dust, not a bright color
  ctx.lineCap = 'round';
  const lines = [0.36, 0.5, 0.64];
  for (const yy of lines) {
    const y = yy * H;
    ctx.lineWidth = 3;
    ctx.beginPath();
    // slight arc so it reads as a swept rake, not a ruler line
    ctx.moveTo(W * 0.14, y + 6);
    ctx.quadraticCurveTo(W * 0.5, y - 10, W * 0.86, y + 6);
    ctx.stroke();
  }
  // fade the ends
  ctx.globalCompositeOperation = 'destination-in';
  const h = ctx.createLinearGradient(0, 0, W, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.5, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, W, H);
  return new CanvasTexture(c);
}

export class ClawTelegraph {
  readonly group = new Group();
  private yaw = new Group();
  private shadow: Mesh;
  private rake: Mesh;

  constructor() {
    this.group.name = 'claw-telegraph';
    this.group.add(this.yaw);
    const mk = (tex: Texture, order: number) => {
      const m = new Mesh(
        new PlaneGeometry(1, 1),
        new MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          side: DoubleSide,
          opacity: 0,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = order;
      m.visible = false;
      return m;
    };
    this.shadow = mk(shadowTex(), 3);
    this.rake = mk(rakeTex(), 4);
    this.yaw.add(this.shadow, this.rake);
  }

  hide() {
    this.shadow.visible = false;
    this.rake.visible = false;
  }

  /**
   * Place the swipe band at (x,z), oriented to the course (facingY), spanning
   * `halfWidth` laterally. progress 0 (windup start) → 1 (about to strike).
   */
  update(x: number, z: number, facingY: number, halfWidth: number, progress: number) {
    const p = Math.max(0, Math.min(1, progress));
    this.group.position.set(x, 0.05, z);
    this.yaw.rotation.y = facingY;
    this.shadow.visible = true;
    this.rake.visible = true;
    // width spans the lateral kill band (+ margin); depth is a shallow strip
    const wLat = halfWidth * 2 + 1.0;
    const depth = 2.6;
    this.shadow.scale.set(wLat, depth, 1);
    this.rake.scale.set(wLat * 0.94, depth * 0.9, 1);
    // darken + sharpen as the claw nears
    (this.shadow.material as MeshBasicMaterial).opacity = 0.3 + 0.5 * p;
    (this.rake.material as MeshBasicMaterial).opacity = 0.15 + 0.55 * p;
  }
}
