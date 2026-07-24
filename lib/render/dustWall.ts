/**
 * Chasing dust wall (DESIGN §축 3 / §3.4) — the dense curtain of ash the warden's
 * destruction pushes ahead of itself. A single soft billboard that rides just
 * behind the warden and yaw-faces the camera, so the warden "뚫고 솟는" (rises out
 * of) a glowing dust wall at close range and chunk pop-in behind it is hidden.
 * Warm ember tint at the base (fire behind the dust), fading to ashen dust up top.
 */
import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type PerspectiveCamera,
} from 'three';
import { DUST_WALL, DUST_WALL_FIRE } from '../constants';
import type { Course, Frame } from '../course';

function wallTexture(): CanvasTexture {
  const W = 256;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const dust = hex(DUST_WALL);
  const fire = hex(DUST_WALL_FIRE);
  // vertical: warm ember base -> ashen dust -> transparent top
  const g = ctx.createLinearGradient(0, H, 0, 0);
  g.addColorStop(0.0, `rgba(${fire},0.5)`);
  g.addColorStop(0.18, `rgba(${dust},0.72)`);
  g.addColorStop(0.6, `rgba(${dust},0.5)`);
  g.addColorStop(1.0, `rgba(${dust},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // horizontal edge fade (soft sides)
  const h = ctx.createLinearGradient(0, 0, W, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)');
  h.addColorStop(0.5, 'rgba(0,0,0,0)');
  h.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, W, H);
  // lumpy noise so the top edge isn't a clean line
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H * 0.6;
    const r = 8 + Math.random() * 26;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`;
    ctx.fill();
  }
  return new CanvasTexture(c);
}

function hex(n: number): string {
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export class DustWall {
  readonly mesh: Mesh;
  private _fr: Frame;
  constructor(frame: Frame) {
    this._fr = frame;
    const tex = wallTexture();
    const mat = new MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      opacity: 0.9,
      fog: true,
    });
    this.mesh = new Mesh(new PlaneGeometry(150, 90), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  update(course: Course, wardenS: number, camera: PerspectiveCamera, proximity: number) {
    const p = course.worldAt(wardenS - 16, 0, this._fr);
    this.mesh.position.set(p.x, 36, p.z);
    // yaw-face the camera (billboard around Y only)
    this.mesh.lookAt(camera.position.x, 36, camera.position.z);
    // denser as it closes in
    (this.mesh.material as MeshBasicMaterial).opacity = 0.6 + proximity * 0.35;
  }
}
