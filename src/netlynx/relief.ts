import type { ElevationGrid } from './api/elevation';

// Shaded relief from the coarse elevation grid: bilinear surface, NW hillshade,
// a pale hypsometric tint, and contour lines at a "nice" interval.

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (c1: number[], c2: number[], t: number) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
const LOW = [214, 222, 196];
const HIGH = [214, 192, 150];

function sampler(g: ElevationGrid) {
  const n = g.n;
  return (u: number, v: number) => {
    const x = Math.min(n - 1.0001, Math.max(0, u * (n - 1)));
    const y = Math.min(n - 1.0001, Math.max(0, v * (n - 1)));
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const at = (a: number, b: number) => g.values[b * n + a];
    // Smoothstep weights hide the grid's facets.
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(at(i, j), at(i + 1, j), sx), lerp(at(i, j + 1), at(i + 1, j + 1), sx), sy);
  };
}

export function contourStep(rangeM: number) {
  const raw = rangeM / 8;
  const p = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? p * 10;
}

export function drawRelief(g: ElevationGrid, size: number, fadeEdges = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const z = sampler(g);
  const min = Math.min(...g.values);
  const max = Math.max(...g.values);
  const range = Math.max(1, max - min);
  const step = contourStep(range);
  const metersPerPx = (g.halfKm * 2000) / size;
  const exag = Math.min(6, Math.max(1.5, 400 / range)); // flatter ground gets more exaggeration
  const lx = -Math.SQRT1_2 * Math.cos(Math.PI / 4);
  const ly = -Math.SQRT1_2 * Math.cos(Math.PI / 4);
  const lz = Math.sin(Math.PI / 4);
  const e = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) e[y * size + x] = z(x / (size - 1), y / (size - 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = y * size + x;
      const ex = (e[y * size + Math.min(size - 1, x + 1)] - e[y * size + Math.max(0, x - 1)]) / (2 * metersPerPx);
      const ey = (e[Math.min(size - 1, y + 1) * size + x] - e[Math.max(0, y - 1) * size + x]) / (2 * metersPerPx);
      const nx = -ex * exag;
      const ny = -ey * exag;
      const nl = Math.hypot(nx, ny, 1);
      const shade = Math.max(0, (nx * lx + ny * ly + lz) / nl);
      let col = mix(LOW, HIGH, (e[k] - min) / range).map((v) => v * (0.62 + shade * 0.45));
      const band = Math.floor(e[k] / step);
      const edge =
        (x < size - 1 && Math.floor(e[k + 1] / step) !== band) || (y < size - 1 && Math.floor(e[k + size] / step) !== band);
      if (edge) col = mix(col, [120, 98, 68], 0.55);
      let a = 255;
      if (fadeEdges) {
        const r = Math.hypot(x / (size - 1) - 0.5, y / (size - 1) - 0.5) * 2;
        a = Math.round(255 * Math.min(1, Math.max(0, (1 - r) / 0.3)));
      }
      img.data.set([Math.min(255, col[0]), Math.min(255, col[1]), Math.min(255, col[2]), a], k * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, step, min, max };
}

/** Mean absolute grade between neighboring grid points, in degrees. */
export function meanGrade(g: ElevationGrid) {
  const n = g.n;
  const spacing = (g.halfKm * 2000) / (n - 1);
  let sum = 0;
  let cnt = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const v = g.values[j * n + i];
      if (i < n - 1) { sum += Math.abs(g.values[j * n + i + 1] - v) / spacing; cnt++; }
      if (j < n - 1) { sum += Math.abs(g.values[(j + 1) * n + i] - v) / spacing; cnt++; }
    }
  }
  return (Math.atan(sum / cnt) * 180) / Math.PI;
}
