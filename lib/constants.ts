/**
 * Palette + scene constants — values taken directly from docs/DESIGN.md §3.2 /
 * §10 (the "Ashen Dusk" regrade of meteor-city). Colors are hex ints (0xRRGGBB)
 * for direct THREE.Color use. Do not invent new hues here; every value below is
 * anchored to a DESIGN.md row. The collapse / fire / smoke physics knobs are the
 * meteor-city originals (PROJECT.md 부록 A: 거의 그대로).
 */

// ---- World scale (PROJECT.md §0) ----
export const GRAVITY = -26;
export const FIXED_DT = 1 / 60;
export const SLOMO_SCALE = 0.15; // DESIGN §4.6 death-cam timeScale
export const GROUND_Y = 0;

// ---- Course geometry (PROJECT.md §6) ----
export const CHUNK_LEN = 120; // arc-length span of one chunk (m)
export const AVENUE_HALF = 13; // runnable avenue half-width (~26m wide multi-lane)
export const SIDEWALK_HALF = 19; // avenue + sidewalk half-width (block face starts here)
export const NODE_HEADING_MAX = (22 * Math.PI) / 180; // max heading change per node

// ---- Sky / fog / dust (DESIGN §3.4 / §10) ----
export const SKY_TOP = 0x363b42; // cool slate zenith
export const SKY_HORIZON = 0x8f7c61; // warm ash-ochre horizon (no sun disk/flare)
export const FOG_COLOR = 0x7c7060; // warm ash gray
export const FOG_DENSITY = { high: 0.01, low: 0.014 } as const;
export const DUST_WALL = 0x6e5f4c; // chasing dust-wall base
export const DUST_WALL_FIRE = 0xb5602a; // warm fire tint inside the wall

// ---- Lighting (chase-relative back-light, DESIGN §3.3 / §10) ----
export const KEY_COLOR = 0xe4cfa6; // warm-pale, dust-filtered gold (NOT orange)
export const KEY_INTENSITY = 2.4;
export const HEMI_SKY = 0x474e57; // cool dim
export const HEMI_GROUND = 0x6a5d4b; // warm ash
export const HEMI_INTENSITY = 0.42;
export const ENV_INTENSITY = 0.35;
export const TONE_EXPOSURE = 0.92; // slightly under — heavy, headroom for flame/cold glow

// ---- Warden (DESIGN §2.2 / §10) — the only cold cyan in the world ----
export const WARDEN_CERAMIC = 0x979ba1; // cool ceramic gray (rough 0.66 / metal 0)
export const WARDEN_GROOVE = 0x585b60; // dark facet groove (never pure black)
export const WARDEN_SEAM = 0xaecbd6; // crack seam
export const WARDEN_CORE = 0xcfe6ee; // brightest crack core
export const WARDEN_COLD = 0xb7d6df; // cold emissive (creature signature — scene only)
export const WARDEN_RIM_WARM = 0xe4cfa6; // warm back-light rim on the mask
export const WARDEN_HEIGHT = 50; // total height H (m)

// ---- Hero (DESIGN §5 / §10) ----
export const HERO_BONE = 0xcec6b8; // bone off-white (catches warm rim)
export const HERO_AMBER = 0xc97b3c; // single warm accent (scarf/band)

// ---- City surfaces (DESIGN §3.2 regrade) ----
export const ASPHALT = 0x3e3d3a; // warm-dark road
export const LANE_FADED = 0x8e877a; // faded lane paint
export const SIDEWALK = 0x7c766b; // low contrast with road
export const BASE_BEVEL = 0x2a2926; // model base / substructure

// window: mostly UNLIT (city is dying); a rare few flicker weak warm
export const WINDOW_WARM = 0xb7a88e;

// ---- Trees ----
export const LEAF_COLOR = 0x4e5544; // dead olive-gray (never neon green)
export const TRUNK_COLOR = 0x5a4a3a;

// ---- Vehicles (dead grays only, DESIGN §3.2) ----
export const VEHICLE_COLORS = [0x6e6e6c, 0x55585c, 0x3a3c3e];

// ---- FX tones ----
export const SHOCK_RING = 0xf5ead8; // warm-dust white (no sci-fi cyan)
export const FOOTFALL_DUST = 0x8a7e6c; // warm dust puff
export const GROUND_CRACK = 0x26231f; // dark radial crack decal
export const CRACK_COLD_RIM = 0x8fb0ba; // faint cold rim that briefly bleeds into cracks

// ---- UI chrome tokens (DESIGN §7.3) ----
export const CHROME = {
  ink: '#EDE6D8',
  muted: '#9A9284',
  danger: '#C4402E',
  amber: '#C97B3C',
  scrim: '#0E0C0A',
} as const;

/**
 * Building material families (DESIGN §3.2). Low-variance variants keep the world
 * dead-but-not-identical. Per-building jitter is applied at chunk build time.
 */
export type MaterialFamily = 'glass' | 'concrete' | 'brick' | 'panel' | 'roof';

export interface FamilySpec {
  variants: number[];
  roughness: number;
  metalness: number;
}

export const FAMILY: Record<MaterialFamily, FamilySpec> = {
  glass: { variants: [0x6e757c, 0x666d74, 0x767d84], roughness: 0.22, metalness: 0.08 },
  concrete: { variants: [0x9e9a92, 0x93908a, 0xa6a29a], roughness: 0.8, metalness: 0.0 },
  brick: { variants: [0x7e5a4c, 0x744f43, 0x876353], roughness: 0.84, metalness: 0.0 },
  panel: { variants: [0x727c6e, 0x6a7367, 0x7a8476], roughness: 0.62, metalness: 0.03 },
  roof: { variants: [0x2e2f31, 0x343436, 0x28292b], roughness: 0.72, metalness: 0.0 },
};

// ---- Camera / proximity (DESIGN §4 / §10, PROJECT.md §7) ----
export const CAM = {
  farGap: 55,
  nearGap: 8,
  catchGap: 3,
  // rig interpolation endpoints (PROJECT.md §7.1–7.2). distanceBackNear must
  // exceed the near gap so the camera pulls BACK PAST the warden — otherwise the
  // 50m creature sits at the camera and can't be framed (DESIGN §4.5 목표 우선;
  // §7.2 seeds 11m, we widen to guarantee the looming top-third framing).
  distanceBackFar: 6.5,
  distanceBackNear: 16,
  heightFar: 3.0,
  heightNear: 7,
  pitchFar: (-7 * Math.PI) / 180,
  pitchNear: (13 * Math.PI) / 180,
  fovFar: 60,
  fovNear: 78,
  shoulder: 0.9,
  headY: 1.7,
  tauPos: 0.14,
  tauPosSnap: 0.06,
  tauRot: 0.1,
} as const;

// ---- Rising smoke (disaster pass, meteor-city original) ----
export const SMOKE = {
  color: 0x2b2824, // heavy warm-black (still not pure black)
  colorEnd: 0x5b554c, // lifts slightly as it thins (ashier than meteor-city)
  colorCool: 0x9aa2a4,
  count: { high: 560, low: 240 },
  rise: 3.4,
  riseJitter: 2.0,
  seedColumn: 4.0,
  spread: 1.6,
  drift: 0.55,
  buoyancyDamp: 0.09,
  life: 8.5,
  lifeJitter: 2.5,
  hold: 0.42,
  peakAlpha: 0.46,
  sizeStart: 8,
  sizeEnd: 24,
} as const;

// ---- Fire + embers (disaster pass) — mostly a background glow here (DESIGN §6) ----
export const FIRE = {
  hot: 0xffe8b0,
  mid: 0xff7a1e,
  deep: 0x7c2408,
  sites: { high: 12, low: 6 },
  flameCount: { high: 460, low: 200 },
  emberColor: 0xffb060,
  emberCount: { high: 200, low: 90 },
  life: 8.5,
  lifeJitter: 3.5,
  reignite: 1.5,
  radiusScale: 0.42,
  radiusMin: 3,
  radiusMax: 16,
  flameRate: 30,
  flameLife: 0.8,
  flameRise: 9.5,
  flameSizeStart: 11,
  flameSizeEnd: 3,
  emberRate: 8,
  emberLife: 2.2,
  emberRise: 11.5,
  emberGravity: 3.0,
  emberSize: 1.8,
  smokeRate: 4.6, // dust is the star here — feed the column a touch harder
} as const;

// ---- Progressive collapse (top-to-bottom pancaking; meteor-city original) ----
export const COLLAPSE = {
  layerDelay: 0.08,
  upStagger: 0.02,
  releaseBase: 0.06,
  scatter: 1.2,
  scatterImpact: 3.2,
  down: 1.6,
  ejecta: 3.4,
  spin: 3.0,
  restitution: 0.045,
  friction: 0.95,
  linDamp: 0.28,
  angDamp: 0.62,
  density: 2.0,
} as const;
