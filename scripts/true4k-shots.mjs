// Screenshots the True 4K explainer (every step), the hero pill and the teaser at desktop and phone sizes.
// Needs the dev server. Usage: node scripts/true4k-shots.mjs [baseUrl] [desktop|mobile]
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
const only = process.argv[3];
const dir = 'screenshots/true4k';
fs.mkdirSync(dir, { recursive: true });
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
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text().slice(0, 200)}`));

  // hero pill and teaser on the light page
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/${s.name}-hero.png` });
  await page.locator('.tk-teaser').scrollIntoViewIfNeeded();
  await page.waitForTimeout(4500);
  await page.locator('.tk-teaser').screenshot({ path: `${dir}/${s.name}-teaser.png` });

  // open from the hero pill
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
  await page.locator('.card--intro .tk-open').click();
  await page.waitForTimeout(600);
  const hash = await page.evaluate(() => location.hash);
  for (let k = 0; k < 5; k++) {
    await page.waitForTimeout(k === 3 ? 3200 : 3800);
    await page.screenshot({ path: `${dir}/${s.name}-step${k + 1}.png` });
    if (k === 3) {
      // the 2 MP check, zoomed: line pairs and the tag's small print on both sides of the divider
      await page.locator('.tk-stage canvas').screenshot({ path: `${dir}/${s.name}-step4-canvas.png` });
      for (const mp of ['5 MP', '8.3 MP']) {
        await page.getByRole('button', { name: mp, exact: true }).click();
        await page.waitForTimeout(500);
        await page.locator('.tk-stage canvas').screenshot({ path: `${dir}/${s.name}-step4-${mp.replace(/\W/g, '')}.png` });
      }
      await page.getByRole('button', { name: '2 MP', exact: true }).click();
      if (s.mobile) {
        // touch loupe: press and hold on the line pairs, left of the divider
        await page.locator('.tk-stage canvas').evaluate((c) => {
          const r = c.getBoundingClientRect();
          const o = { bubbles: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: r.left + r.width * 0.4, clientY: r.top + r.height * 0.78 };
          c.dispatchEvent(new PointerEvent('pointerdown', o));
          c.dispatchEvent(new PointerEvent('pointermove', o));
        });
        await page.waitForTimeout(300);
        await page.locator('.tk-stage canvas').screenshot({ path: `${dir}/${s.name}-step4-touch.png` });
        await page.locator('.tk-stage canvas').evaluate((c) => c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 7 })));
      }
    }
    if (k < 4) await page.locator('.tk-nav .tk-btn:not(.tk-btn--ghost)').click();
  }
  // Esc closes and returns focus to the pill
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ hash: location.hash, open: !!document.querySelector('.tk'), focus: document.activeElement?.className }));
  console.log(s.name, { openedHash: hash, ...after, errors });
  await ctx.close();
}
await browser.close();
