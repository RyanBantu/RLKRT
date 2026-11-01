// Canvas renderers for the five True 4K steps. Each draws one frame into a 1280 × 720 logical
// canvas for a given time since the step began (seconds; Infinity = final state) and returns the
// numbers the HTML counters show.
import { FULL, sensorScale, TK, tkData, tkSensor, type Img } from './pipeline';

export const CW = 1280;
export const CH = 720;

const CREAM = '#efe8d6';
const AMBER = '#e8901d';
const INK = '#141413';

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------- helpers

/** Canvas UI (labels, loupe, divider handle) grows when the canvas is shown small, e.g. on phones. */
let ui = 1;
export function setUiScale(displayWidth: number) {
  ui = Math.max(1, Math.min(1.9, 900 / Math.max(1, displayWidth)));
}

const canvases = new WeakMap<Img, HTMLCanvasElement>();
/** An Img as a canvas (cached) so it can be drawn with drawImage. */
function asCanvas(img: Img) {
  let c = canvases.get(img);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.w;
    c.height = img.h;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.d), img.w, img.h), 0, 0);
    canvases.set(img, c);
  }
  return c;
}

/** View rect in crop (4K) pixels. */
type View = { x: number; y: number; w: number; h: number };

/**
 * Draws `img` (which covers the whole 640 × 360 crop at its own resolution) so that crop rect `v`
 * fills dest rect d, nearest-neighbour, with a pixel grid once pixels are big enough to see.
 */
export function tkZoom(ctx: CanvasRenderingContext2D, img: Img, v: View, dx: number, dy: number, dw: number, dh: number, grid = true) {
  const k = img.w / TK.W; // image px per crop px
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(asCanvas(img), v.x * k, v.y * k, v.w * k, v.h * k, dx, dy, dw, dh);
  const cell = dw / (v.w * k); // screen px per image px
  if (!grid || cell < 7) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  ctx.strokeStyle = `rgba(0,0,0,${Math.min(0.45, (cell - 7) / 30).toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const x0 = Math.ceil(v.x * k), y0 = Math.ceil(v.y * k);
  for (let x = x0; x <= (v.x + v.w) * k; x++) {
    const px = Math.round(dx + (x - v.x * k) * cell) + 0.5;
    ctx.moveTo(px, dy);
    ctx.lineTo(px, dy + dh);
  }
  for (let y = y0; y <= (v.y + v.h) * k; y++) {
    const py = Math.round(dy + (y - v.y * k) * cell) + 0.5;
    ctx.moveTo(dx, py);
    ctx.lineTo(dx + dw, py);
  }
  ctx.stroke();
  ctx.restore();
}

/** A trail-cam style chip: dark plate, amber edge, cream mono text. */
export function tkLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: 'left' | 'right' | 'center' = 'left', accent = AMBER) {
  ctx.save();
  ctx.font = `600 ${Math.round(19 * ui)}px "IBM Plex Mono", ui-monospace, monospace`;
  text = text.toUpperCase();
  // corner chips keep their margin in display px; chips placed next to content stay put
  if (align === 'left' && x < 60) x *= ui;
  if (align === 'right' && CW - x < 60) x = CW - (CW - x) * ui;
  if (y < 60) y *= ui;
  const w = ctx.measureText(text).width + 24 * ui;
  const h = 34 * ui;
  const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  ctx.fillStyle = 'rgba(20,20,19,0.82)';
  ctx.fillRect(left, y, w, h);
  ctx.fillStyle = accent;
  ctx.fillRect(align === 'right' ? left + w - 3 * ui : left, y, 3 * ui, h);
  ctx.fillStyle = CREAM;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + 12 * ui, y + h / 2 + 1);
  ctx.restore();
}

const fullView: View = { x: 0, y: 0, w: TK.W, h: TK.H };
/** 16:9 view centred on the tag's small print, `w` crop pixels wide. */
const printView = (w: number): View => ({ x: TK.print.x - w / 2, y: TK.print.y - (w * 9) / 16 / 2, w, h: (w * 9) / 16 });
const lerpView = (a: View, b: View, t: number): View => {
  // interpolate the zoom in log space so it feels constant-speed
  const w = Math.exp(lerp(Math.log(a.w), Math.log(b.w), t));
  const f = (a.w - w) / (a.w - b.w || 1);
  return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), w, h: (w * 9) / 16 };
};

// ---------------------------------------------------------------- steps

export type StepState = {
  mp: number; // step 4 sensor
  divider: number; // step 4, 0..1 across the frame
  loupe: { x: number; y: number } | null; // step 4, canvas coords
  /** Show the loupe at the tag when there is no pointer over the canvas (mouse); touch shows it only on press. */
  idleLoupe: boolean;
  /** When set, draw the loupe its radius plus this far above what it magnifies, so a finger doesn't cover it. */
  lift: number;
  dragging: boolean;
};

export type StepOut = { count?: number; real?: number; guessed?: number };

const ZOOM_S = 2.6;

function zoomStep(ctx: CanvasRenderingContext2D, img: Img, t: number, label: string, total: number): StepOut {
  const z = ease(clamp01((t - 0.3) / ZOOM_S));
  tkZoom(ctx, img, lerpView(fullView, printView(104), z), 0, 0, CW, CH);
  tkLabel(ctx, label, 24, 24);
  return { count: Math.round(total * ease(clamp01(t / 1.8))) };
}

export function step1(ctx: CanvasRenderingContext2D, t: number): StepOut {
  return zoomStep(ctx, tkData(), t, 'TRUE 4K · 3840 × 2160', FULL);
}

export function step2(ctx: CanvasRenderingContext2D, t: number): StepOut {
  return zoomStep(ctx, tkSensor(2).low, t, '2 MP SENSOR · 1920 × 1080', 1920 * 1080);
}

/** The pixel split. Also used, looped, by the landing-page teaser. */
export function step3(ctx: CanvasRenderingContext2D, t: number, w = CW, h = CH, cols = 16): StepOut {
  const { low, up } = tkSensor(2);
  const rows = Math.ceil((cols * 9) / 16); // 2 MP pixels in view
  const cell = w / cols;
  const lx0 = Math.round(TK.print.x / 2 - cols / 2), ly0 = Math.round(TK.print.y / 2 - rows / 2);
  const split = ease(clamp01((t - 0.7) / 0.9)); // split lines
  const fill = ease(clamp01((t - 1.7) / 0.9)); // guessed values fade in
  const arrows = clamp01((t - 2.8) / 0.6);
  const px = (img: Img, x: number, y: number) => {
    const i = (y * img.w + x) * 4;
    return `rgb(${img.d[i]},${img.d[i + 1]},${img.d[i + 2]})`;
  };

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const X = i * cell, Y = j * cell;
      ctx.fillStyle = px(low, lx0 + i, ly0 + j);
      ctx.fillRect(X, Y, cell, cell);
      if (fill > 0) {
        ctx.globalAlpha = fill;
        for (const [a, b] of [[1, 0], [0, 1], [1, 1]]) {
          ctx.fillStyle = px(up, (lx0 + i) * 2 + a, (ly0 + j) * 2 + b);
          ctx.fillRect(X + (a * cell) / 2, Y + (b * cell) / 2, cell / 2, cell / 2);
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  // outlines: real quarter = cream solid, guessed quarters = amber dashed
  const lw = Math.max(1, w / 900);
  ctx.lineWidth = lw;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const X = i * cell, Y = j * cell, q = (cell / 2) * (split > 0 ? 1 : 2);
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(239,232,214,0.85)';
      ctx.strokeRect(X + lw, Y + lw, (split > 0 ? q : cell) - 2 * lw, (split > 0 ? q : cell) - 2 * lw);
      if (split > 0) {
        ctx.globalAlpha = split;
        ctx.setLineDash([cell / 14, cell / 18]);
        ctx.strokeStyle = AMBER;
        for (const [a, b] of [[1, 0], [0, 1], [1, 1]]) ctx.strokeRect(X + (a * cell) / 2 + lw, Y + (b * cell) / 2 + lw, cell / 2 - 2 * lw, cell / 2 - 2 * lw);
        ctx.globalAlpha = 1;
      }
    }
  }
  ctx.setLineDash([]);

  // neighbour-average arrows into one guessed pixel
  if (arrows > 0) {
    const ci = cols / 2 + 1, cj = Math.floor(rows / 2) - (cols < 16 ? 1 : 0); // the cell we explain
    const tx = ci * cell + (cell * 3) / 4, ty = cj * cell + (cell * 3) / 4; // its bottom-right (guessed) quarter
    const from = [[ci, cj], [ci + 1, cj], [ci, cj + 1], [ci + 1, cj + 1]].map(([i, j]) => [i * cell + cell / 4, j * cell + cell / 4]);
    ctx.save();
    ctx.globalAlpha = arrows;
    ctx.strokeStyle = CREAM;
    ctx.fillStyle = CREAM;
    ctx.lineWidth = Math.max(2, w / 500);
    for (const [fx, fy] of from) {
      const ang = Math.atan2(ty - fy, tx - fx);
      const len = Math.hypot(tx - fx, ty - fy) - cell / 7;
      if (len < cell / 6) continue;
      const ex = fx + Math.cos(ang) * len, ey = fy + Math.sin(ang) * len;
      ctx.beginPath();
      ctx.arc(fx, fy, ctx.lineWidth * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      const hs = cell / 9;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - 0.45) * hs, ey - Math.sin(ang - 0.45) * hs);
      ctx.lineTo(ex - Math.cos(ang + 0.45) * hs, ey - Math.sin(ang + 0.45) * hs);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = Math.max(2, w / 420);
    ctx.strokeRect(ci * cell + cell / 2, cj * cell + cell / 2, cell / 2, cell / 2);
    ctx.restore();
    if (w >= 900) {
      const text = 'AVG OF NEIGHBOURS';
      const lw = (text.length * 11.5 + 24) * ui;
      const lh = 34 * ui;
      if (tx + cell / 2 + lw < w - 8) tkLabel(ctx, text, tx + cell / 2, ty - lh / 2, 'left');
      else tkLabel(ctx, text, ci * cell + cell / 4 - cell / 2, ty + cell / 2, 'right');
    }
  }
  if (w >= 900) tkLabel(ctx, '2 MP → “4K”', 24, 24);
  return { real: 1920 * 1080, guessed: Math.round(FULL * 0.75 * fill) };
}

const SWEEP_S = 2.4;
/** Divider position during the one-time sweep on entering step 4. */
export function sweepAt(t: number) {
  const p = clamp01(t / SWEEP_S);
  return 0.5 + 0.36 * Math.sin(p * Math.PI * 2) * (1 - p * 0.15);
}
export const sweepDone = (t: number) => t >= SWEEP_S;

export function step4(ctx: CanvasRenderingContext2D, s: StepState): StepOut {
  const truth = tkData();
  const up = tkSensor(s.mp).up;
  const k = CW / TK.W; // 2 screen px per crop px
  const dx = Math.round(s.divider * CW);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(asCanvas(truth), 0, 0, TK.W, TK.H, 0, 0, CW, CH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, dx, CH);
  ctx.clip();
  ctx.drawImage(asCanvas(up), 0, 0, TK.W, TK.H, 0, 0, CW, CH);
  ctx.restore();

  // loupe: 4× the stage scale, split at the divider like the frame
  const R = 118 * Math.sqrt(ui), mag = 4;
  const L = s.loupe ?? (s.idleLoupe ? { x: TK.print.x * k, y: TK.print.y * k } : null);
  if (L) {
    const D = { x: L.x, y: Math.max(R, L.y - (s.lift ? R + s.lift : 0)) }; // where the loupe is drawn
    const sw = (2 * R) / (k * mag); // crop px across the loupe
    const cx = L.x / k, cy = L.y / k;
    const src = { x: cx - sw / 2, y: cy - sw / 2 };
    ctx.save();
    ctx.beginPath();
    ctx.arc(D.x, D.y, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = INK;
    ctx.fillRect(D.x - R, D.y - R, 2 * R, 2 * R);
    ctx.drawImage(asCanvas(truth), src.x, src.y, sw, sw, D.x - R, D.y - R, 2 * R, 2 * R);
    // the part of the loupe left of the divider shows the interpolated image
    const splitX = D.x - R + ((dx / k - src.x) / sw) * 2 * R;
    if (splitX > D.x - R) {
      ctx.beginPath();
      ctx.rect(D.x - R, D.y - R, Math.min(2 * R, splitX - (D.x - R)), 2 * R);
      ctx.clip();
      ctx.drawImage(asCanvas(up), src.x, src.y, sw, sw, D.x - R, D.y - R, 2 * R, 2 * R);
    }
    ctx.restore();
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = CREAM;
    ctx.beginPath();
    ctx.arc(D.x, D.y, R, 0, Math.PI * 2);
    ctx.stroke();
    if (splitX > D.x - R && splitX < D.x + R) {
      const dy = Math.sqrt(R * R - (splitX - D.x) ** 2);
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, D.y - dy);
      ctx.lineTo(splitX, D.y + dy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // divider
  ctx.save();
  ctx.fillStyle = CREAM;
  ctx.fillRect(dx - 1.5 * ui, 0, 3 * ui, CH);
  const hy = Math.max(CH * 0.22, 79 * ui + 12); // below the corner chips, clear of the idle loupe and the line-pair card
  ctx.beginPath();
  ctx.arc(dx, hy, (s.dragging ? 24 : 21) * ui, 0, Math.PI * 2);
  ctx.fillStyle = s.dragging ? AMBER : CREAM;
  ctx.fill();
  ctx.fillStyle = INK;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dx + d * 13 * ui, hy);
    ctx.lineTo(dx + d * 5 * ui, hy - 7 * ui);
    ctx.lineTo(dx + d * 5 * ui, hy + 7 * ui);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const native = sensorScale(s.mp) >= 1;
  tkLabel(ctx, native ? 'TRUE 4K · 8.3 MP' : `INTERPOLATED · ${s.mp} MP → 4K`, 24, 24, 'left', native ? CREAM : AMBER);
  tkLabel(ctx, 'TRUE 4K', CW - 24, 24, 'right', CREAM);
  return {};
}

export function step5(ctx: CanvasRenderingContext2D, t: number, left: string, right: string): StepOut {
  const { up } = tkSensor(2);
  const truth = tkData();
  const pad = 6;
  const v: View = { x: TK.tag.x - pad, y: TK.tag.y - pad, w: TK.tag.w + pad * 2, h: TK.tag.h + pad * 2 };
  const gap = 24, top = 84;
  const pw = (CW - gap * 3) / 2;
  const ph = (pw * v.h) / v.w;
  const a = ease(clamp01(t / 0.7));
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CW, CH);
  ctx.globalAlpha = a;
  const y = top + (1 - a) * 20 + (CH - top - ph) / 2 - 20;
  tkZoom(ctx, up, v, gap, y, pw, ph, false);
  tkZoom(ctx, truth, v, gap * 2 + pw, y, pw, ph, false);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(203,180,149,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(gap - 0.5, y - 0.5, pw + 1, ph + 1);
  ctx.strokeRect(gap * 2 + pw - 0.5, y - 0.5, pw + 1, ph + 1);
  tkLabel(ctx, left, gap, 24, 'left', AMBER);
  tkLabel(ctx, right, gap * 2 + pw, 24, 'left', CREAM);
  return {};
}
