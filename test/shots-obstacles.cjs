/* eslint-disable */
// Ad-hoc capture: drive a run and grab several close frames to confirm the
// forward obstacles (cars, debris chunks, gap pits, low barriers, overhead bars)
// read clearly by FORM + natural shadow — no color paint. Not pass/fail.
const puppeteer = require('puppeteer-core');
const path = require('path');
const PORT = process.env.CR_PORT || '3191';
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
  await p.evaluate(() => window.__cr.begin());
  // drive straight-ish, dodging softly, and grab frames as obstacles approach
  for (let i = 0; i < 10; i++) {
    await p.evaluate((v) => window.__cr.steer(v), Math.sin(i * 0.7) * 0.5);
    if (i % 2 === 0) await p.evaluate(() => window.__cr.jump());
    await sleep(700);
    const s = await p.evaluate(() => window.__cr.stats());
    await p.screenshot({ path: path.join(OUT, `cr-obs-${i}.png`) });
    if (s.state !== 'running') break;
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(2); });
