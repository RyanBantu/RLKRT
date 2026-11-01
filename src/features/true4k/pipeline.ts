// True 4K image pipeline. Everything works on a 640 × 360 crop of a 3840 × 2160 frame, measured
// in true-4K pixels. A lower-resolution sensor is simulated by area-averaging that crop (what its
// bigger photosites would integrate), then "4K" is rebuilt with Catmull-Rom bicubic interpolation,
// which is what an upscaling camera does in firmware.

export const FULL = 3840 * 2160; // 8,294,400

export const TK = {
  frameW: 3840,
  frameH: 2160,
  W: 640, // crop size, in 4K pixels
  H: 360,
  SS: 3, // the test frame is drawn at 3× and area-averaged down
  /** The amber ear tag, in crop pixels. */
  tag: { x: 252, y: 132, w: 136, h: 70 },
  /** Where the small print sits (the zoom target for steps 1–3). */
  print: { x: 327, y: 185 },
  sensors: [2, 5, 8.3] as const,
};

export type Sensor = (typeof TK.sensors)[number];

/** RGBA image, 8 bits per channel, row-major. */
export type Img = { w: number; h: number; d: Uint8ClampedArray };

export const sensorScale = (mp: number) => Math.min(1, Math.sqrt((mp * 1e6) / FULL));
export const sensorSize = (mp: number) => {
  const s = sensorScale(mp);
  return { w: Math.round(TK.W * s), h: Math.round(TK.H * s) };
};

// ---------------------------------------------------------------- test frame

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draws the procedural test frame (fur, 48-spoke Siemens star, 2/3/4/6 px line pairs, twigs and an
 * amber ear tag reading RL-07 / NETLYNX 2026) at 3× and returns it area-averaged to 640 × 360.
 * Call after document.fonts.ready so the tag uses IBM Plex Mono.
 */
export function tkScene(): Img {
  const { W, H, SS, tag } = TK;
  const c = document.createElement('canvas');
  c.width = W * SS;
  c.height = H * SS;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.scale(SS, SS);
  const r = rng(678);

  // bark backdrop
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#3b3328');
  bg.addColorStop(1, '#231e18');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const x = r() * W;
    g.strokeStyle = r() > 0.5 ? 'rgba(18,14,10,0.55)' : 'rgba(92,78,58,0.35)';
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    g.moveTo(x, -10);
    g.bezierCurveTo(x + (r() - 0.5) * 30, H * 0.3, x + (r() - 0.5) * 30, H * 0.7, x + (r() - 0.5) * 20, H + 10);
    g.stroke();
  }

  // fur patch: a flank with flowing short hairs
  g.save();
  g.beginPath();
  g.ellipse(150, 236, 220, 150, -0.15, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#6e5a43';
  g.fillRect(0, 0, W, H);
  const furTones = ['#8b7253', '#5a4632', '#a48a66', '#3f3123', '#c2a882', '#76603f'];
  for (let i = 0; i < 9000; i++) {
    const x = r() * 420 - 20;
    const y = r() * 320 + 70;
    const a = -0.9 + Math.sin(x * 0.02 + y * 0.015) * 0.5 + (r() - 0.5) * 0.35;
    const len = 4 + r() * 9;
    g.strokeStyle = furTones[(r() * furTones.length) | 0];
    g.globalAlpha = 0.55 + r() * 0.45;
    g.lineWidth = 0.35 + r() * 0.7;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (r() - 0.5) * 2, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  g.restore();
  g.globalAlpha = 1;

  // twigs across the top left
  for (let i = 0; i < 7; i++) {
    const y0 = 20 + r() * 120;
    g.strokeStyle = '#17130e';
    g.lineWidth = 0.7 + r() * 2.1;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-10, y0);
    g.bezierCurveTo(120, y0 + (r() - 0.5) * 60, 240, y0 + (r() - 0.3) * 80, 330 + r() * 90, y0 + 40 + r() * 60);
    g.stroke();
  }
  // a few side shoots
  g.strokeStyle = '#1d1812';
  for (let i = 0; i < 18; i++) {
    const x = 20 + r() * 300, y = 20 + r() * 150;
    g.lineWidth = 0.5 + r() * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 8 + r() * 22, y - 6 - r() * 18);
    g.stroke();
  }

  // Siemens star, 48 spokes
  const sx = 532, sy = 104, sr = 78;
  g.fillStyle = '#e9e3d3';
  g.beginPath();
  g.arc(sx, sy, sr + 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#141413';
  for (let k = 0; k < 48; k++) {
    if (k % 2) continue;
    const a0 = (k / 48) * Math.PI * 2, a1 = ((k + 1) / 48) * Math.PI * 2;
    g.beginPath();
    g.moveTo(sx, sy);
    g.arc(sx, sy, sr, a0, a1);
    g.closePath();
    g.fill();
  }

  // line pairs: 2, 3, 4 and 6 px bars on a cream card
  g.fillStyle = '#e9e3d3';
  g.fillRect(224, 236, 192, 112);
  g.fillStyle = '#141413';
  let lx = 236;
  for (const p of [2, 3, 4, 6]) {
    for (let k = 0; k < 4; k++) g.fillRect(lx + k * p * 2, 246, p, 76);
    g.font = '600 9px "IBM Plex Mono", monospace';
    g.fillText(String(p), lx, 339);
    lx += p * 8 + 10;
  }

  // ear tag
  g.save();
  g.translate(tag.x + tag.w / 2, tag.y + tag.h / 2);
  g.rotate(-0.035);
  g.translate(-tag.w / 2, -tag.h / 2);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.roundRect(2, 3, tag.w, tag.h, 9);
  g.fill();
  g.fillStyle = '#e8901d';
  g.beginPath();
  g.roundRect(0, 0, tag.w, tag.h, 9);
  g.fill();
  g.fillStyle = '#2a241c';
  g.beginPath();
  g.arc(13, tag.h / 2, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1e1e1e';
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = '700 29px "IBM Plex Mono", monospace';
  g.fillText('RL-07', tag.w / 2 + 7, 36);
  g.font = '600 10px "IBM Plex Mono", monospace';
  g.fillText('NETLYNX 2026', tag.w / 2 + 7, 56);
  g.restore();

  const big = g.getImageData(0, 0, W * SS, H * SS);
  return tkArea({ w: big.width, h: big.height, d: big.data }, W, H);
}

// ---------------------------------------------------------------- resampling

/** Area-average (box) resample along one axis, with fractional coverage at the edges. */
function area1D(src: Float32Array, sw: number, sh: number, tw: number, horizontal: boolean) {
  const n = horizontal ? sw : sh;
  const other = horizontal ? sh : sw;
  const out = new Float32Array((horizontal ? tw * sh : sw * tw) * 4);
  const ratio = n / tw;
  for (let o = 0; o < other; o++) {
    for (let i = 0; i < tw; i++) {
      const a = i * ratio, b = (i + 1) * ratio;
      let r = 0, gg = 0, bb = 0, al = 0;
      for (let k = Math.floor(a); k < Math.ceil(b); k++) {
        const w = Math.min(b, k + 1) - Math.max(a, k);
        const si = (horizontal ? o * sw + k : k * sw + o) * 4;
        r += src[si] * w;
        gg += src[si + 1] * w;
        bb += src[si + 2] * w;
        al += src[si + 3] * w;
      }
      const di = (horizontal ? o * tw + i : i * sw + o) * 4;
      out[di] = r / ratio;
      out[di + 1] = gg / ratio;
      out[di + 2] = bb / ratio;
      out[di + 3] = al / ratio;
    }
  }
  return out;
}

/** What a sensor with tw × th photosites records of the same scene: each photosite averages its area. */
export function tkArea(src: Img, tw: number, th: number): Img {
  const f = Float32Array.from(src.d);
  const h = area1D(f, src.w, src.h, tw, true);
  const v = area1D(h, tw, src.h, th, false);
  return { w: tw, h: th, d: Uint8ClampedArray.from(v) };
}

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

/** Catmull-Rom bicubic upscale, pixel-centre aligned: in-camera "4K" interpolation. */
export function tkCubic(src: Img, tw: number, th: number): Img {
  const { w: sw, h: sh, d } = src;
  const tmp = new Float32Array(tw * sh * 4);
  const clampX = (x: number) => (x < 0 ? 0 : x >= sw ? sw - 1 : x);
  const clampY = (y: number) => (y < 0 ? 0 : y >= sh ? sh - 1 : y);
  for (let x = 0; x < tw; x++) {
    const fx = ((x + 0.5) * sw) / tw - 0.5;
    const ix = Math.floor(fx), t = fx - ix;
    const xs = [clampX(ix - 1), clampX(ix), clampX(ix + 1), clampX(ix + 2)];
    for (let y = 0; y < sh; y++) {
      const row = y * sw;
      for (let c = 0; c < 4; c++) {
        tmp[(y * tw + x) * 4 + c] = catmull(d[(row + xs[0]) * 4 + c], d[(row + xs[1]) * 4 + c], d[(row + xs[2]) * 4 + c], d[(row + xs[3]) * 4 + c], t);
      }
    }
  }
  const out = new Uint8ClampedArray(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const fy = ((y + 0.5) * sh) / th - 0.5;
    const iy = Math.floor(fy), t = fy - iy;
    const ys = [clampY(iy - 1), clampY(iy), clampY(iy + 1), clampY(iy + 2)];
    for (let x = 0; x < tw; x++) {
      for (let c = 0; c < 4; c++) {
        out[(y * tw + x) * 4 + c] = catmull(tmp[(ys[0] * tw + x) * 4 + c], tmp[(ys[1] * tw + x) * 4 + c], tmp[(ys[2] * tw + x) * 4 + c], tmp[(ys[3] * tw + x) * 4 + c], t);
      }
    }
  }
  return { w: tw, h: th, d: out };
}

// ---------------------------------------------------------------- cached buffers

let truth: Img | null = null;
const sensors = new Map<number, { low: Img; up: Img }>();

/** The true-4K crop. Built on first use, then cached. */
export function tkData(): Img {
  if (!truth) truth = tkScene();
  return truth;
}

/** The crop as a `mp` megapixel sensor records it (`low`) and upscaled back to 4K (`up`). Cached. */
export function tkSensor(mp: number) {
  let s = sensors.get(mp);
  if (!s) {
    const t = tkData();
    const { w, h } = sensorSize(mp);
    if (w >= TK.W) s = { low: t, up: t };
    else {
      const low = tkArea(t, w, h);
      s = { low, up: tkCubic(low, TK.W, TK.H) };
    }
    sensors.set(mp, s);
  }
  return s;
}
