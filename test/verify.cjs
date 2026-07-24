/* eslint-disable */
/**
 * Headless end-to-end verification (system Chrome + SwiftShader software WebGL).
 * Proves: app loads with no page errors, the scene renders (title preview), the
 * run loop progresses (distance up, warden chases, proximity climbs), the warden
 * fractures the flanking city (debris/rubble appear), a catch triggers the
 * death-cam and result card, and a seed reproduces the same course.
 *
 * Run: node test/verify.cjs   (needs `next start` up; port via CR_PORT)
 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const PORT = process.env.CR_PORT || '3178';
const BASE = `http://localhost:${PORT}`;
const OUT =
  process.env.CR_OUT ||
  'C:/Users/jin68/AppData/Local/Temp/claude/c--dev-project-side-app/ca750ade-268c-4251-82ca-f03bab9bbc54/scratchpad';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let failures = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--window-size=1280,720',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  const waitReady = () =>
    page.waitForFunction('window.__cr && window.__cr.ready && window.__cr.ready()', {
      timeout: 60000,
      polling: 400,
    });

  // ---------- Phase A: load + title preview ----------
  await page.goto(`${BASE}/?seed=12345`, { waitUntil: 'domcontentloaded' });
  await waitReady();
  ok('app becomes ready (WASM + chunks built)', true);

  const renderer = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  console.log('      GPU renderer:', renderer);

  await sleep(1200);
  const s0 = await page.evaluate(() => window.__cr.stats());
  console.log('      title stats:', JSON.stringify(s0));
  ok('title state + chunks streamed', s0.state === 'title' && s0.chunks >= 3, `chunks=${s0.chunks}`);
  const fpA = await page.evaluate(() => window.__cr.fingerprint());
  await page.screenshot({ path: path.join(OUT, 'cr-title.png') });

  // ---------- Phase B: begin run + progression ----------
  await page.evaluate(() => window.__cr.begin());
  let maxDist = 0;
  let maxProx = 0;
  let maxDebris = 0;
  let maxRubble = 0;
  let sawRunning = false;
  let sawStomp = false;
  let ranShot = false;
  let dyingSeen = false;
  let overSeen = false;
  let deathProx = 0;
  // survive a while with a serpentine steer + periodic jump/slide/dash
  for (let i = 0; i < 26; i++) {
    const phase = i * 0.5;
    await page.evaluate((v) => window.__cr.steer(v), Math.sin(phase) * 0.8);
    if (i % 3 === 0) await page.evaluate(() => window.__cr.jump());
    if (i % 4 === 0) await page.evaluate(() => window.__cr.dash());
    if (i % 5 === 0) {
      await page.evaluate(() => window.__cr.slide(true));
      setTimeout(() => page.evaluate(() => window.__cr.slide(false)).catch(() => {}), 250);
    }
    await sleep(450);
    const s = await page.evaluate(() => window.__cr.stats());
    if (s.state === 'running') sawRunning = true;
    if (s.stomping) sawStomp = true;
    if (s.state === 'dying' && !dyingSeen) {
      dyingSeen = true;
      deathProx = s.proximity;
      await page.screenshot({ path: path.join(OUT, 'cr-death.png') });
    }
    if (s.state === 'gameover') overSeen = true;
    maxDist = Math.max(maxDist, s.distance);
    maxProx = Math.max(maxProx, s.proximity);
    maxDebris = Math.max(maxDebris, s.debris);
    maxRubble = Math.max(maxRubble, s.rubble);
    if (!ranShot && s.distance > 25) {
      await page.screenshot({ path: path.join(OUT, 'cr-run.png') });
      ranShot = true;
    }
    if (s.state !== 'running') break;
  }
  console.log(
    `      progression: maxDist=${maxDist} maxProx=${maxProx.toFixed(2)} debris=${maxDebris} rubble=${maxRubble} stomp=${sawStomp}`,
  );
  ok('run entered running state', sawRunning);
  ok('hero made forward progress (distance > 0)', maxDist > 0, `maxDist=${maxDist}`);
  ok('warden fractured the city (debris or rubble appeared)', maxDebris + maxRubble > 0, `debris=${maxDebris} rubble=${maxRubble}`);
  ok('warden foot-stomp hazard fires (telegraph active)', sawStomp, `stomp=${sawStomp}`);

  // ---------- Phase C: looming shot, then death-cam -> result ----------
  await page.evaluate(() => window.__cr.steer(0));
  await page.evaluate(() => window.__cr.slide(false));

  // reversed-camera looming shot: the warden fills the frame by default now, so
  // just grab a running frame (watch a stomp telegraph if we catch one)
  const stC = await page.evaluate(() => window.__cr.stats());
  if (stC.state === 'running') {
    for (let j = 0; j < 6; j++) {
      await sleep(250);
      const sj = await page.evaluate(() => window.__cr.stats());
      maxProx = Math.max(maxProx, sj.proximity);
      if (sj.stomping || j === 5) {
        await page.screenshot({ path: path.join(OUT, 'cr-proximity.png') });
        break;
      }
      if (sj.state !== 'running') {
        if (sj.state === 'dying') dyingSeen = true;
        if (sj.state === 'gameover') overSeen = true;
        break;
      }
    }
  }

  // deterministically trigger the catch, so the death-cam + result card are
  // exercised without depending on SwiftShader wall-clock timing
  if (!dyingSeen && !overSeen) {
    await page.evaluate(() => window.__cr.kill());
  }
  for (let i = 0; i < 40 && !overSeen; i++) {
    await sleep(400);
    const s = await page.evaluate(() => window.__cr.stats());
    if (s.state === 'dying' && !dyingSeen) {
      dyingSeen = true;
      deathProx = s.proximity;
      await page.screenshot({ path: path.join(OUT, 'cr-death.png') });
    }
    if (s.state === 'gameover') overSeen = true;
  }
  await sleep(600);
  const result = await page.evaluate(() => window.__cr.result());
  console.log('      result:', JSON.stringify(result), 'maxProx=', maxProx.toFixed(2));
  ok('slam-telegraph threat registered (proximity rose)', maxProx > 0.25, `maxProx=${maxProx.toFixed(2)}`);
  ok('death-cam triggered (dying state)', dyingSeen, `proxAtDeath=${deathProx.toFixed(2)}`);
  ok('reached game over + result card', overSeen && result && result.distance >= 0, `dist=${result && result.distance}`);
  // the result card is a DOM overlay
  const hasCard = await page.evaluate(() =>
    Array.from(document.querySelectorAll('*')).some((e) => /m 생존/.test(e.textContent || '')),
  );
  ok('result card rendered (○○m 생존)', hasCard);
  await page.screenshot({ path: path.join(OUT, 'cr-result.png') });

  // ---------- Phase D: seed reproducibility ----------
  await page.goto(`${BASE}/?seed=12345`, { waitUntil: 'domcontentloaded' });
  await waitReady();
  await sleep(500);
  const fpB = await page.evaluate(() => window.__cr.fingerprint());
  ok('same seed reproduces the same course', Math.abs(fpA - fpB) < 1e-6, `${fpA} vs ${fpB}`);

  await page.goto(`${BASE}/?seed=999`, { waitUntil: 'domcontentloaded' });
  await waitReady();
  await sleep(500);
  const fp999 = await page.evaluate(() => window.__cr.fingerprint());
  ok('different seed -> different course', Math.abs(fpA - fp999) > 1e-6, `${fpA} vs ${fp999}`);

  // invalid seed falls back gracefully (hostile input)
  await page.goto(`${BASE}/?seed=notanumber`, { waitUntil: 'domcontentloaded' });
  await waitReady();
  const okState = await page.evaluate(() => window.__cr.state());
  ok('invalid seed falls back (no crash)', okState === 'title');

  // ---------- error report ----------
  const benign = consoleErrors.filter(
    (t) => !/pretendard|font|favicon|Failed to load resource|manifest/i.test(t),
  );
  console.log('      pageErrors:', pageErrors.length, 'consoleErrors(non-benign):', benign.length);
  if (pageErrors.length) console.log('        ', pageErrors.slice(0, 5).join('\n         '));
  if (benign.length) console.log('        ', benign.slice(0, 5).join('\n         '));
  ok('no uncaught page errors', pageErrors.length === 0);
  ok('no non-benign console errors', benign.length === 0);

  await browser.close();
  console.log(failures === 0 ? '\nVERIFY: ALL PASS' : `\nVERIFY: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('VERIFY CRASHED:', e);
  process.exit(2);
});
