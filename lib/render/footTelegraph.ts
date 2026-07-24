/**
 * Foot-slam telegraph (foot-dodge core) — a NATURAL ground shadow that marks
 * where the warden's raised foot will land. No color paint (user feedback): the
 * shadow itself is the death zone, so it reads on its own. As the foot descends
 * (progress 0→1) the shadow darkens + tightens and a faint dust ring contracts
 * to the footprint, giving urgency; on the slam it's replaced by the impact FX.
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

function shadowTex(): Texture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.72)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new CanvasTexture(c);
}
function ringTex(): Texture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.74, 'rgba(0,0,0,0)');
  g.addColorStop(0.84, 'rgba(214,201,178,0.5)'); // faint warm dust, not a bright color
  g.addColorStop(0.92, 'rgba(214,201,178,0.1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new CanvasTexture(c);
}

export class FootTelegraph {
  readonly group = new Group();
  private shadow: Mesh;
  private ring: Mesh;

  constructor() {
    this.group.name = 'foot-telegraph';
    const mk = (tex: Texture) => {
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
      m.renderOrder = 4;
      m.visible = false;
      return m;
    };
    this.shadow = mk(shadowTex());
    this.ring = mk(ringTex());
    this.group.add(this.shadow, this.ring);
  }

  hide() {
    this.shadow.visible = false;
    this.ring.visible = false;
  }

  /** progress 0 (foot raised) → 1 (about to land). */
  update(x: number, z: number, radius: number, progress: number) {
    const p = Math.max(0, Math.min(1, progress));
    this.shadow.visible = true;
    this.ring.visible = true;
    this.shadow.position.set(x, 0.06, z);
    this.ring.position.set(x, 0.07, z);
    // shadow tightens a touch + darkens as the foot nears
    const sScale = radius * 2 * (1.35 - 0.3 * p);
    this.shadow.scale.set(sScale, sScale, 1);
    (this.shadow.material as MeshBasicMaterial).opacity = 0.35 + 0.55 * p;
    // ring contracts toward the footprint (urgency)
    const rScale = radius * 2 * (2.4 - 1.4 * p);
    this.ring.scale.set(rScale, rScale, 1);
    (this.ring.material as MeshBasicMaterial).opacity = 0.25 + 0.5 * p;
  }
}
