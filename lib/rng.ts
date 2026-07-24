/**
 * Deterministic seeded PRNG (reused from meteor-city, PROJECT.md 부록 A).
 * Every gameplay-affecting random value — course bends, block placement,
 * obstacles, forks, warden corner-cut decisions — is pulled from a stream keyed
 * by `hash(seed, chunkIndex)` in a FIXED order, so a given ?seed= reproduces the
 * exact same course on every device, framerate-independent (PROJECT.md §0 결정론).
 * three has no place here — this stays a pure module so determinism is testable.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small deterministic string->seed hash (used if a string ever seeds a stream). */
export function hashStringToSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Mix a base seed with one or two integer sub-keys into a fresh 32-bit seed.
 * This is how each chunk (and each fork branch) gets its own independent yet
 * fully reproducible RNG stream: `hash(seed, chunkIndex)` / `hash(seed, i, br)`.
 */
export function hash(seed: number, a: number, b = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (a >>> 0), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (b >>> 0), 0x27d4eb2f) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Thin ergonomic wrapper over a mulberry32 stream. */
export class Rng {
  private next01: () => number;
  constructor(seed: number) {
    this.next01 = mulberry32(seed >>> 0);
  }
  /** [0,1) */
  next(): number {
    return this.next01();
  }
  /** [min,max) float */
  range(min: number, max: number): number {
    return min + (max - min) * this.next01();
  }
  /** [min,max] integer */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  /** true with probability p */
  chance(p: number): boolean {
    return this.next01() < p;
  }
  /** uniform element */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next01() * arr.length)];
  }
  /** weighted element; weights need not sum to 1 */
  weighted<T>(entries: readonly [T, number][]): T {
    let total = 0;
    for (const [, w] of entries) total += w;
    let r = this.next01() * total;
    for (const [v, w] of entries) {
      r -= w;
      if (r <= 0) return v;
    }
    return entries[entries.length - 1][0];
  }
  /** -1 or +1 */
  sign(): number {
    return this.next01() < 0.5 ? -1 : 1;
  }
}

/** Convenience: a fresh Rng for a given (seed, chunkIndex[, branch]). */
export function chunkRng(seed: number, chunkIndex: number, branch = 0): Rng {
  return new Rng(hash(seed, chunkIndex, branch));
}
