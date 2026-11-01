// Screenshots every chapter at desktop and phone sizes. Needs the dev server running.
// Usage: npm run shots [-- http://localhost:5173]
import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173';
const only = process.argv[3]; // optional: "desktop" | "mobile"
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
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const range = await page.evaluate(() => document.getElementById('stage').offsetHeight - innerHeight);
  for (let k = 0; k <= 7; k++) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round((range * k) / 7));
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `screenshots/${s.name}-ch${k}.png` });
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `screenshots/${s.name}-footer.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(s.name, 'horizontal overflow px:', overflow, 'errors:', errors.slice(0, 5));
  await ctx.close();
}
await browser.close();
