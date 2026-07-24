/* eslint-disable */
// Ad-hoc: capture running frames of the over-shoulder claw-dodge core so I can
// eyeball the framing (forward road + hero low/back + 4m predator on the heels +
// claw telegraph rake + forward obstacles). Not pass/fail.
const puppeteer = require('puppeteer-core');
const path = require('path');
const PORT = process.env.CR_PORT || '3195';
const OUT = 'C:/Users/jin68/AppData/Local/Temp/claude/c--dev-project-side-app/ca750ade-268c-4251-82ca-f03bab9bbc54/scratchpad';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1280,720'],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await p.goto(`http://localhost:${PORT}/?seed=7`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction('window.__cr && window.__cr.ready && window.__cr.ready()', { timeout: 60000, polling: 400 });
  await sleep(600);
  await p.screenshot({ path: path.join(OUT, 'cx-title.png') });
  await p.evaluate(() => window.__cr.begin());
  let shot = 0;
  let teleShot = false;
  for (let i = 0; i < 18; i++) {
    await p.evaluate((v) => window.__cr.steer(v), Math.sin(i * 0.9) * 0.7);
    if (i % 3 === 0) await p.evaluate(() => window.__cr.jump());
    await sleep(300);
    const s = await p.evaluate(() => window.__cr.stats());
    if (s.state === 'running') {
      await p.screenshot({ path: path.join(OUT, `cx-run-${shot++}.png`) });
      if (s.attacking && !teleShot) { await p.screenshot({ path: path.join(OUT, 'cx-telegraph.png') }); teleShot = true; }
    } else {
      await p.screenshot({ path: path.join(OUT, 'cx-death.png') });
      break;
    }
    if (shot >= 8) break;
  }
  await b.close();
  console.log('done shots');
})().catch((e) => { console.error(e); process.exit(2); });
