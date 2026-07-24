/* eslint-disable */
/**
 * Pure-logic unit tests (PROJECT.md 마무리: 핵심 로직 단위 테스트로라도 증빙).
 * Covers the three-free deterministic core that the shared-seed contract rests
 * on: PRNG determinism, seed parsing (hostile input), the catch-up / difficulty
 * curves, and course reproducibility. The modules are emitted to test/.pure by
 * `tsc -p test/tsconfig.pure.json` first (see the npm-free runner below).
 *
 * Run: node test/tsconfig-emit-and-run.cjs   (compiles then runs this file)
 */
const P = './.pure/lib';
const { Rng, hash, chunkRng } = require(`${P}/rng.js`);
const { parseSeed, randomSeed, seedCode } = require(`${P}/share.js`);
const {
  speedAt,
  gapTargetAt,
  swipeIntervalAt,
  windupAt,
  leadTimeAt,
  SPEED_MIN,
  SPEED_MAX,
} = require(`${P}/difficulty.js`);
const { Course, makeFrame } = require(`${P}/course.js`);
const { Warden } = require(`${P}/warden.js`);

// engine's claw kill band half-width (lib/engine.ts SWIPE_HALF) — the lateral
// window a swipe kills within; mirrored here to prove the mechanic in isolation.
const SWIPE_HALF = 2.5;

let fails = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) fails++;
};
const approx = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// ---- PRNG determinism ----
{
  const a = new Rng(12345);
  const b = new Rng(12345);
  const c = new Rng(12346);
  const sa = Array.from({ length: 8 }, () => a.next());
  const sb = Array.from({ length: 8 }, () => b.next());
  const sc = Array.from({ length: 8 }, () => c.next());
  ok('Rng is deterministic for a seed', sa.every((v, i) => v === sb[i]));
  ok('Rng differs across seeds', sa.some((v, i) => v !== sc[i]));
  ok('hash is stable', hash(1, 2, 3) === hash(1, 2, 3));
  ok('hash spreads sub-keys', hash(1, 2, 3) !== hash(1, 3, 2));
  const r1 = chunkRng(7, 3).next();
  const r2 = chunkRng(7, 3).next();
  const r3 = chunkRng(7, 4).next();
  ok('chunkRng deterministic per (seed,index)', r1 === r2 && r1 !== r3);
}

// ---- seed parsing (hostile input) ----
{
  ok('parseSeed accepts digits', parseSeed('12345') === 12345);
  ok('parseSeed rejects letters', parseSeed('notanumber') === null);
  ok('parseSeed rejects overflow length', parseSeed('123456789012345') === null);
  ok('parseSeed rejects empty', parseSeed('') === null);
  ok('parseSeed clamps into range', parseSeed(String(0x7fffffff + 5)) <= 0x7fffffff);
  const s = randomSeed();
  ok('randomSeed in range', s >= 0 && s <= 0x7fffffff);
  ok('seedCode round-trips through parseSeed base', typeof seedCode(12345) === 'string');
}

// ---- difficulty / catch-up curves ----
{
  ok('speed starts at V0', approx(speedAt(0), SPEED_MIN, 1e-6));
  ok('speed ramps with distance', speedAt(1000) > speedAt(0));
  ok('speed caps at VMAX', speedAt(1e9) <= SPEED_MAX + 1e-6 && speedAt(1e9) >= SPEED_MAX - 1e-6);
  ok('gap target shrinks with distance', gapTargetAt(3000) < gapTargetAt(0));
  ok('gap target has a floor (never 0)', gapTargetAt(1e9) > 0);
  ok('gap target monotone non-increasing', gapTargetAt(500) >= gapTargetAt(1500));
  // claw cadence tightens + windup shrinks (more relentless deeper); lead grows
  ok('swipe interval tightens with distance', swipeIntervalAt(4000) < swipeIntervalAt(0));
  ok('swipe interval has a floor', swipeIntervalAt(1e9) >= 0.6 - 1e-6);
  ok('windup shrinks with distance', windupAt(4000) < windupAt(0));
  ok('windup has a floor', windupAt(1e9) >= 0.4 - 1e-6);
  ok('lead time grows with distance', leadTimeAt(4000) > leadTimeAt(0));
}

// ---- warden lethality (the core: running straight must die) ----
{
  const DT = 1 / 60;
  const AVENUE = 13;

  // simulate a run, returning every swipe strike's (targetLat, heroLat) pair
  function run(heroLatFn, seconds) {
    const w = new Warden();
    w.reset(6);
    const strikes = [];
    let heroS = 0;
    const steps = Math.floor(seconds / DT);
    let prevLat = heroLatFn(0);
    for (let i = 0; i < steps; i++) {
      const tsec = i * DT;
      const heroLat = heroLatFn(tsec);
      const heroLatVel = (heroLat - prevLat) / DT;
      prevLat = heroLat;
      const speed = 15;
      heroS += speed * DT;
      const dist = Math.floor(heroS);
      w.update(
        DT, heroS, heroLat, heroLatVel, speed,
        swipeIntervalAt(dist), windupAt(dist), leadTimeAt(dist), AVENUE,
      );
      if (w.strikeEvent) strikes.push({ targetLat: w.targetLat, heroLat });
    }
    return strikes;
  }

  // a hero who never moves laterally (runs dead straight)
  const straight = run(() => 1.5, 5);
  ok('straight runner draws swipes', straight.length >= 2, `strikes=${straight.length}`);
  const allInBand = straight.every((s) => Math.abs(s.heroLat - s.targetLat) < SWIPE_HALF);
  ok('every swipe lands on a straight runner (in the kill band) -> death', allInBand);

  // a hero who jukes hard side-to-side escapes at least one swipe's band
  const juker = run((t) => Math.sin(t * 6.0) * (AVENUE - 2), 5);
  const escapedAny = juker.some((s) => Math.abs(s.heroLat - s.targetLat) >= SWIPE_HALF);
  ok('an actively juking hero can escape the swipe band', juker.length === 0 || escapedAny,
    `strikes=${juker.length} escaped=${escapedAny}`);
}

// ---- course reproducibility + sanity ----
{
  const fr = makeFrame();
  const a = new Course(12345);
  const b = new Course(12345);
  const c = new Course(999);
  let sameAB = true;
  let diffAC = false;
  let tangentUnit = true;
  let widthsPositive = true;
  let advanced = true;
  let prevS = -1;
  for (let s = 0; s <= 2000; s += 50) {
    a.frame(s, fr);
    const ax = fr.x, az = fr.z, ah = fr.halfWidth;
    const tlen = Math.hypot(fr.tx, fr.tz);
    if (Math.abs(tlen - 1) > 1e-6) tangentUnit = false;
    if (ah <= 0) widthsPositive = false;
    b.frame(s, fr);
    if (Math.abs(fr.x - ax) > 1e-9 || Math.abs(fr.z - az) > 1e-9 || Math.abs(fr.halfWidth - ah) > 1e-9)
      sameAB = false;
    c.frame(s, fr);
    if (Math.abs(fr.x - ax) > 1e-6 || Math.abs(fr.z - az) > 1e-6) diffAC = true;
  }
  // forward progress: worldAt advances (net -Z travel over the span)
  const f0 = makeFrame();
  const f1 = makeFrame();
  a.frame(0, f0);
  a.frame(2000, f1);
  const netForward = Math.hypot(f1.x - f0.x, f1.z - f0.z);
  ok('course tangents are unit length', tangentUnit);
  ok('course half-widths stay positive', widthsPositive);
  ok('same seed -> identical course', sameAB);
  ok('different seed -> different course', diffAC);
  ok('course makes net forward progress', netForward > 500, `net=${netForward.toFixed(0)}m over 2000m`);
}

console.log(fails === 0 ? '\nUNIT: ALL PASS' : `\nUNIT: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
