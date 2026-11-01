// Generates the procedural textures used across the site:
//   public/textures/camo.png       seamless bark + fallen leaf camo (also used as a bump map)
//   public/textures/topo.png       faint tan topographic contour lines (transparent)
//   public/textures/torn-mask.svg  ragged-edge mask for the chapter rail strip
// Run with: npm run textures
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('public/textures');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

const result = await page.evaluate(() => {
  const N = 1024;
  let seed = 1337;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  // Value noise that tiles with independent periods on each axis.
  function lattice(px, py) {
    const g = new Float32Array(px * py);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const X0 = ((xi % px) + px) % px, X1 = (X0 + 1) % px;
      const Y0 = ((yi % py) + py) % py, Y1 = (Y0 + 1) % py;
      const a = g[Y0 * px + X0], b = g[Y0 * px + X1], c = g[Y1 * px + X0], d = g[Y1 * px + X1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  function fbm(cx, cy, oct) {
    const layers = [];
    for (let o = 0; o < oct; o++) layers.push({ n: lattice(cx << o, cy << o), f: 1 << o, a: 1 / (1 << o) });
    const norm = layers.reduce((s, l) => s + l.a, 0);
    return (x, y) => {
      let s = 0;
      for (const l of layers) s += l.n((x / N) * cx * l.f, (y / N) * cy * l.f) * l.a;
      return s / norm;
    };
  }
  const mix = (a, b, t) => a + (b - a) * t;
  const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const lerpC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

  // ---------- Bark ----------
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(N, N);
  const bark = fbm(36, 4, 6);
  const warp = fbm(4, 4, 3);
  const blotch = fbm(5, 5, 4);
  const lichen = fbm(40, 40, 4);
  const crack = fbm(6, 48, 3);
  const fine = fbm(128, 64, 2);
  const furrow = hex('#16130f'), barkMid = hex('#4f4940'), barkHi = hex('#837c6b'), lichenC = hex('#a9a390');
  const brown = hex('#59432f'), olive = hex('#55553a');
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const w = (warp(x, y) - 0.5) * 90;
      let n = bark(x + w, y + w * 0.3);
      n = sstep(0.3, 0.7, n);
      let col = n < 0.4 ? lerpC(furrow, barkMid, sstep(0.08, 0.4, n)) : lerpC(barkMid, barkHi, sstep(0.45, 1.0, n));
      // flaky lichen patches sit on the bark ridges
      const l = lichen(x + w * 0.5, y);
      col = lerpC(col, lichenC, sstep(0.56, 0.66, l) * sstep(0.3, 0.7, n) * 0.75);
      // short horizontal cracks across the plates
      col = lerpC(col, furrow, sstep(0.66, 0.74, crack(x, y + w)) * 0.7 * n);
      const b = blotch(x, y);
      col = lerpC(col, brown, sstep(0.55, 0.8, b) * 0.5);
      col = lerpC(col, olive, sstep(0.5, 0.25, b) * 0.3);
      const f = (fine(x, y) - 0.5) * 44;
      const i = (y * N + x) * 4;
      img.data[i] = col[0] + f; img.data[i + 1] = col[1] + f; img.data[i + 2] = col[2] + f; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // ---------- Leaves ----------
  function maplePath(s) {
    // Sugar-maple outline: three broad toothed lobes plus two small basal lobes.
    const pts = [];
    const lobes = [[-Math.PI / 2, 0.72], [-Math.PI / 2 - 1.05, 0.6], [-Math.PI / 2 + 1.05, 0.6], [-Math.PI / 2 - 2.05, 0.3], [-Math.PI / 2 + 2.05, 0.3]];
    for (let a = -Math.PI; a < Math.PI; a += 0.012) {
      let r = 0.3;
      for (const [la, len] of lobes) {
        const d = Math.atan2(Math.sin(a - la), Math.cos(a - la));
        r = Math.max(r, 0.3 + len * Math.pow(Math.max(0, Math.cos(d * 1.15)), 5.5));
      }
      const tooth = Math.abs(((a * 7.5) / Math.PI) % 1);
      r *= 1 + (tooth < 0.5 ? tooth : 1 - tooth) * 0.16;
      if (Math.abs(a - Math.PI / 2) < 0.18) r *= 0.75; // stem notch
      pts.push([Math.cos(a) * r * s * 0.8, Math.sin(a) * r * s * 0.8]);
    }
    return pts;
  }
  function oakPath(s) {
    const L = [], R = [];
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const lobe = 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 4.5));
      const w = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.7) * 0.32 * lobe;
      const y = (0.5 - t) * 1.0;
      L.push([-w * s, y * s]); R.push([w * s, y * s]);
    }
    return [...R, ...L.reverse()];
  }
  const leafCols = ['#6b4a30', '#7d5a3a', '#5a3f2a', '#8a7052', '#5c5b3c', '#77736a', '#4d3b2b', '#6c5a41'];
  const leaves = [];
  for (let i = 0; i < 40; i++) {
    leaves.push({ x: rand() * N, y: rand() * N, s: 70 + rand() * 80, r: rand() * Math.PI * 2, maple: rand() < 0.55, col: leafCols[Math.floor(rand() * leafCols.length)], dark: 0.25 + rand() * 0.3 });
  }
  for (const L of leaves) {
    const poly = L.maple ? maplePath(L.s) : oakPath(L.s * 1.15);
    for (let ox = -N; ox <= N; ox += N) for (let oy = -N; oy <= N; oy += N) {
      const cx = L.x + ox, cy = L.y + oy;
      if (cx < -L.s * 1.5 || cx > N + L.s * 1.5 || cy < -L.s * 1.5 || cy > N + L.s * 1.5) continue;
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(L.r);
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 7; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
      ctx.beginPath(); poly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      const g = ctx.createLinearGradient(0, -L.s / 2, 0, L.s / 2);
      g.addColorStop(0, L.col); g.addColorStop(1, `rgba(40,30,20,${L.dark})`);
      ctx.globalAlpha = 0.88; ctx.fillStyle = L.col; ctx.fill(); ctx.globalAlpha = 1;
      ctx.shadowColor = 'transparent';
      ctx.globalAlpha = 0.6; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
      // veins
      ctx.strokeStyle = 'rgba(30,22,15,0.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (L.maple) {
        for (const [a, k] of [[-Math.PI / 2, 0.75], [-Math.PI / 2 - 1.05, 0.65], [-Math.PI / 2 + 1.05, 0.65], [-Math.PI / 2 - 2.05, 0.38], [-Math.PI / 2 + 2.05, 0.38]]) {
          ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * L.s * k * 0.8, Math.sin(a) * L.s * k * 0.8);
        }
        ctx.moveTo(0, 0); ctx.lineTo(0, L.s * 0.42);
      } else {
        ctx.moveTo(0, L.s * 0.62); ctx.lineTo(0, -L.s * 0.5);
        for (let k = -2; k <= 2; k++) { ctx.moveTo(0, k * L.s * 0.18); ctx.lineTo(-L.s * 0.25, k * L.s * 0.18 - L.s * 0.12); ctx.moveTo(0, k * L.s * 0.18); ctx.lineTo(L.s * 0.25, k * L.s * 0.18 - L.s * 0.12); }
      }
      ctx.stroke();
      ctx.restore();
    }
  }
  // Re-apply a little bark grain over everything so leaves sit in the print.
  const over = ctx.getImageData(0, 0, N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4, f = (fine(x, y) - 0.5) * 30;
    over.data[i] += f; over.data[i + 1] += f; over.data[i + 2] += f;
    const m = sstep(0.55, 0.7, lichen(x * 1.7, y * 1.7)) * 26;
    over.data[i] -= m; over.data[i + 1] -= m; over.data[i + 2] -= m;
    // pull everything toward grey-brown, like printed bark camo
    const lum = over.data[i] * 0.3 + over.data[i + 1] * 0.59 + over.data[i + 2] * 0.11;
    for (let k = 0; k < 3; k++) over.data[i + k] = mix(over.data[i + k], lum, 0.35);
  }
  ctx.putImageData(over, 0, 0);
  const camo = c.toDataURL('image/png');

  // ---------- Topo contours ----------
  const t = document.createElement('canvas');
  t.width = t.height = N;
  const tctx = t.getContext('2d');
  const timg = tctx.createImageData(N, N);
  const height = fbm(3, 3, 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const h = height(x, y) * 16;
    const fr = h - Math.floor(h);
    const d = Math.min(fr, 1 - fr);
    const major = Math.floor(h + 0.5) % 4 === 0;
    const a = 1 - sstep(major ? 0.035 : 0.018, major ? 0.07 : 0.045, d);
    const i = (y * N + x) * 4;
    timg.data[i] = 203; timg.data[i + 1] = 180; timg.data[i + 2] = 149; timg.data[i + 3] = a * 255;
  }
  tctx.putImageData(timg, 0, 0);
  const topo = t.toDataURL('image/png');

  // ---------- Torn strip mask ----------
  const pts = [];
  const steps = 60;
  for (let k = 0; k <= steps; k++) pts.push([8 + rand() * 18, (k / steps) * 1000]);
  for (let k = steps; k >= 0; k--) pts.push([92 - rand() * 18, (k / steps) * 1000]);
  const torn = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 1000" preserveAspectRatio="none"><polygon fill="#000" points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}"/></svg>`;

  return { camo, topo, torn };
});

const save = (name, dataUrl) => fs.writeFileSync(path.join(out, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
save('camo.png', result.camo);
save('topo.png', result.topo);
fs.writeFileSync(path.join(out, 'torn-mask.svg'), result.torn);
await browser.close();
console.log('textures written to', out);
