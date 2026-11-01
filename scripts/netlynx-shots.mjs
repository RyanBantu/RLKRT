// Screenshots /netlynx before and after a search at desktop and phone sizes. Needs the dev server.
// Usage: node scripts/netlynx-shots.mjs [baseUrl] [zips comma-separated] [desktop|mobile]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
const zips = (process.argv[3] ?? '59801,54901,78201,00000').split(',');
const only = process.argv[4];
fs.mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sizes = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
].filter((s) => !only || s.name === only);

for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: s.mobile ? 2 : 1, isMobile: s.mobile, hasTouch: s.mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));
  await page.goto(`${base}/netlynx`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `screenshots/nl-${s.name}-before.png` });
  for (const zip of zips) {
    await page.goto(`${base}/netlynx`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.fill('#zip', zip);
    await page.click('.nl-hero button[type=submit]');
    await page.waitForTimeout(zip === '00000' ? 2500 : 9000);
    await page.screenshot({ path: `screenshots/nl-${s.name}-${zip}.png` });
    if (zip !== '00000') {
      await page.waitForTimeout(6000);
      if (s.mobile) {
        for (const [i, id] of ['conditions', 'game', 'terrain'].entries()) {
          await page.evaluate((x) => document.getElementById(`panel-${x}`)?.scrollIntoView(), id);
          await page.waitForTimeout(500);
          await page.screenshot({ path: `screenshots/nl-${s.name}-${zip}-p${i}.png` });
        }
      } else await page.screenshot({ path: `screenshots/nl-${s.name}-${zip}-full.png`, fullPage: true });
      const status = await page.evaluate(() => [...document.querySelectorAll('.panel')].map((p) => `${p.id}:${p.getAttribute('aria-busy') ? 'busy' : 'done'}:${p.querySelector('.panel-error')?.textContent ?? ''}`));
      console.log(s.name, zip, status.join(' | '));
    } else {
      console.log(s.name, zip, await page.evaluate(() => document.querySelector('.nl-error')?.textContent));
    }
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(s.name, 'overflow px:', overflow, 'errors:', [...new Set(errors)].slice(0, 6));
  await ctx.close();
}
await browser.close();
