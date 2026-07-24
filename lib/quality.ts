/**
 * GPU quality tiers (PROJECT.md §10). We detect a coarse tier from the WebGL
 * renderer string + device signals, then hand back a preset that scales the
 * heavy knobs. Adapted from meteor-city with colossus-run fields added:
 * streamAhead / wardenFractureRate / obstaclePromoteCap / proceduralBoneQuality.
 * Low tier is the mobile / iGPU fallback — still runs, just degraded.
 */

export type Tier = 'high' | 'low';

export interface QualityPreset {
  tier: Tier;
  activeCap: number; // max ACTIVE (physics) debris chunks at once
  rubbleCap: number; // max persistent static rubble instances (ring buffer)
  maxFractureBuildings: number; // per fracture-pulse fully-fractured building cap
  chunksCoarse: number; // voxel-chunk target for small/far buildings
  chunksFine: number; // voxel-chunk target for large/near buildings
  treeFactor: number; // multiplier on generated tree count per road chunk
  // colossus-run additions (PROJECT.md §10)
  streamAhead: number; // loaded chunks ahead of the player
  wardenFractureRate: number; // max building fractures/sec the warden may trigger
  obstaclePromoteCap: number; // max rubble piles promoted to blocking obstacles at once
  proceduralBoneQuality: 'full' | 'lite'; // warden IK detail
  shadows: boolean;
  shadowMapSize: number;
  dpr: [number, number];
  bloom: boolean;
  ao: boolean;
  chromaticAberration: boolean;
  vignette: boolean;
  debrisShadows: boolean;
}

const HIGH: QualityPreset = {
  tier: 'high',
  activeCap: 320,
  rubbleCap: 1400,
  maxFractureBuildings: 3,
  chunksCoarse: 7,
  chunksFine: 14,
  treeFactor: 1,
  streamAhead: 5,
  wardenFractureRate: 5,
  obstaclePromoteCap: 10,
  proceduralBoneQuality: 'full',
  shadows: true,
  shadowMapSize: 4096,
  dpr: [1, 2],
  bloom: true,
  ao: true,
  chromaticAberration: true,
  vignette: true,
  debrisShadows: true,
};

const LOW: QualityPreset = {
  tier: 'low',
  activeCap: 120,
  rubbleCap: 520,
  maxFractureBuildings: 2,
  chunksCoarse: 6,
  chunksFine: 9,
  treeFactor: 0.5,
  streamAhead: 3,
  wardenFractureRate: 3,
  obstaclePromoteCap: 6,
  proceduralBoneQuality: 'lite',
  shadows: true,
  shadowMapSize: 2048,
  dpr: [1, 1.5],
  bloom: true,
  ao: false, // N8AO is the biggest cost — drop it first on low tier
  chromaticAberration: false,
  vignette: true,
  debrisShadows: false,
};

function getRendererString(): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
    return String(gl.getParameter(gl.RENDERER) || '');
  } catch {
    return '';
  }
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const coarse =
    typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  return coarse || ua;
}

let cached: QualityPreset | null = null;

export function detectQuality(forced?: Tier): QualityPreset {
  if (forced) return forced === 'high' ? HIGH : LOW;
  if (cached) return cached;

  const renderer = getRendererString().toLowerCase();
  let tier: Tier = 'high';

  if (isMobile()) tier = 'low';

  const weak = [
    'swiftshader',
    'llvmpipe',
    'software',
    'intel',
    'apple gpu',
    'mali',
    'adreno',
    'powervr',
    'uhd graphics',
    'hd graphics',
  ];
  if (weak.some((w) => renderer.includes(w))) tier = 'low';

  const strong = ['rtx', 'geforce', 'radeon rx', 'radeon pro', 'quadro', 'arc a'];
  if (strong.some((s) => renderer.includes(s))) tier = 'high';

  cached = tier === 'high' ? HIGH : LOW;
  return cached;
}

export function presetForTier(tier: Tier): QualityPreset {
  return tier === 'high' ? HIGH : LOW;
}

export function isMobileDevice(): boolean {
  return isMobile();
}
