import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Main PCB layout (cm, board-local; origin at board centre, +y up).
// Shared by the canvas textures and the 3D component placement so pads line up.
// ---------------------------------------------------------------------------
export const PCB = { w: 8.6, h: 13, ppc: 120 };

export type Part = { id: string; x: number; y: number; w: number; h: number; ref: string };
export const pcbParts: Record<string, Part> = {
  isp: { id: 'isp', x: -1.5, y: 1.4, w: 2.1, h: 2.1, ref: 'U1' },
  ram: { id: 'ram', x: 1.45, y: 2.0, w: 1.5, h: 1.05, ref: 'U2' },
  emmc: { id: 'emmc', x: 1.45, y: 0.3, w: 1.35, h: 1.15, ref: 'U3' },
  mcu: { id: 'mcu', x: 2.25, y: -1.85, w: 0.8, h: 0.8, ref: 'U4' },
  pmic: { id: 'pmic', x: -2.2, y: -2.3, w: 1.0, h: 1.0, ref: 'U5' },
  ind: { id: 'ind', x: -0.75, y: -2.35, w: 0.9, h: 0.9, ref: 'L1' },
  sd: { id: 'sd', x: 3.35, y: -4.3, w: 1.6, h: 1.45, ref: 'J4' },
  connTop: { id: 'connTop', x: 0, y: 5.6, w: 2.2, h: 0.55, ref: 'J1' },
  connPir: { id: 'connPir', x: -1.9, y: -4.8, w: 1.4, h: 0.5, ref: 'J2' },
  connBatt: { id: 'connBatt', x: 0.6, y: -5.75, w: 1.6, h: 0.5, ref: 'J3' },
  capA: { id: 'capA', x: -3.4, y: -3.4, w: 0.6, h: 0.6, ref: 'C1' },
  capB: { id: 'capB', x: -3.4, y: -1.6, w: 0.6, h: 0.6, ref: 'C2' },
};

// Little passives, deterministic so texture pads and instanced meshes agree.
function mulberry(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Passive = { x: number; y: number; rot: number; kind: 0 | 1 };
export const passives: Passive[] = (() => {
  const r = mulberry(7);
  const out: Passive[] = [];
  const clusters = [[-1.5, 1.4, 1.6], [1.45, 1.2, 1.2], [-2.0, -2.4, 1.1], [2.2, -1.9, 0.8], [0, -4.3, 1.4], [-2.8, 4.4, 1], [2.8, 4.5, 1]];
  for (const [cx, cy, rad] of clusters) {
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2, d = rad + 0.25 + r() * 0.5;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (Math.abs(x) > 3.9 || Math.abs(y) > 6.1) continue;
      if (Object.values(pcbParts).some((p) => Math.abs(x - p.x) < p.w / 2 + 0.2 && Math.abs(y - p.y) < p.h / 2 + 0.2)) continue;
      out.push({ x, y, rot: r() < 0.5 ? 0 : Math.PI / 2, kind: r() < 0.6 ? 0 : 1 });
    }
  }
  return out;
})();

const toPx = (x: number, y: number): [number, number] => [(x + PCB.w / 2) * PCB.ppc, (PCB.h / 2 - y) * PCB.ppc];

// Trace routing: out from a pad, a 45° dog-leg, then straight in.
type Pt = [number, number];
function route(a: Pt, b: Pt, horizontalFirst: boolean): Pt[] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (horizontalFirst) {
    const diag = Math.min(Math.abs(dx), Math.abs(dy));
    const mid: Pt = [b[0] - Math.sign(dx) * diag, a[1]];
    return [a, mid, b];
  }
  const diag = Math.min(Math.abs(dx), Math.abs(dy));
  const mid: Pt = [a[0], b[1] - Math.sign(dy) * diag];
  return [a, mid, b];
}

function buildTraces(): Pt[][] {
  const r = mulberry(21);
  const P = pcbParts;
  const traces: Pt[][] = [];
  const bus = (from: Part, to: Part, n: number, pitch: number, horiz: boolean) => {
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * pitch;
      const a: Pt = horiz ? [from.x + Math.sign(to.x - from.x) * from.w / 2, from.y + o] : [from.x + o, from.y + Math.sign(to.y - from.y) * from.h / 2];
      const b: Pt = horiz ? [to.x - Math.sign(to.x - from.x) * to.w / 2, to.y + o * 0.8] : [to.x + o * 0.8, to.y - Math.sign(to.y - from.y) * to.h / 2];
      traces.push(route(a, b, horiz));
    }
  };
  bus(P.isp, P.ram, 9, 0.09, true);
  bus(P.isp, P.emmc, 7, 0.1, true);
  bus(P.isp, P.connTop, 8, 0.1, false);
  bus(P.mcu, P.emmc, 4, 0.12, false);
  bus(P.pmic, P.ind, 3, 0.18, true);
  bus(P.pmic, P.connBatt, 4, 0.14, false);
  bus(P.mcu, P.sd, 5, 0.12, false);
  bus(P.connPir, P.mcu, 3, 0.14, true);
  bus(P.pmic, P.isp, 4, 0.16, false);
  bus(P.ind, P.isp, 3, 0.16, false);
  // scattered short traces to vias
  for (let i = 0; i < 46; i++) {
    const x = (r() - 0.5) * 7.6, y = (r() - 0.5) * 11.6;
    const len = 0.4 + r() * 1.4;
    const ang = (Math.floor(r() * 8) * Math.PI) / 4;
    traces.push([[x, y], [x + Math.cos(ang) * len, y + Math.sin(ang) * len], [x + Math.cos(ang) * len + (r() < 0.5 ? len * 0.6 : 0), y + Math.sin(ang) * len]]);
  }
  return traces;
}

let pcbCache: { color: THREE.CanvasTexture; signal: THREE.CanvasTexture } | null = null;

/** Colour map (solder mask, copper, gold, silkscreen) and a data map for the signal shader. */
export function pcbTextures() {
  if (pcbCache) return pcbCache;
  const W = PCB.w * PCB.ppc, H = PCB.h * PCB.ppc, S = PCB.ppc;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const sig = document.createElement('canvas');
  sig.width = W; sig.height = H;
  const sg = sig.getContext('2d')!;
  sg.fillStyle = '#000'; sg.fillRect(0, 0, W, H);

  // solder mask with a little mottling
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#13402c'); grad.addColorStop(1, '#0d3324');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const r = mulberry(3);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.025})`;
    g.fillRect(r() * W, r() * H, 2 + r() * 6, 2 + r() * 6);
  }
  // ground pour hatch at the edges
  g.strokeStyle = 'rgba(40,110,70,0.35)'; g.lineWidth = 1;
  for (let i = -H; i < W; i += 14) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke(); }
  g.fillStyle = '#123d2a'; g.fillRect(0.25 * S, 0.25 * S, W - 0.5 * S, H - 0.5 * S);

  // traces
  const traces = buildTraces();
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const tr of traces) {
    const pts = tr.map(([x, y]) => toPx(x, y));
    g.strokeStyle = '#2f7a52'; g.lineWidth = 4.5;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.strokeStyle = 'rgba(120,200,150,0.25)'; g.lineWidth = 1.5; g.stroke();
    // signal map: R = phase along the trace, G = mask, B = per-trace offset
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const off = Math.floor(r() * 255);
    let acc = 0;
    sg.lineWidth = 5; sg.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len < 0.5) continue;
      const p0 = acc / total, p1 = (acc + len) / total;
      acc += len;
      const lg = sg.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, `rgb(${Math.round(p0 * 255)},255,${off})`);
      lg.addColorStop(1, `rgb(${Math.round(p1 * 255)},255,${off})`);
      sg.strokeStyle = lg;
      sg.beginPath(); sg.moveTo(x0, y0); sg.lineTo(x1, y1); sg.stroke();
    }
    // vias at trace ends
    for (const [x, y] of [pts[0], pts[pts.length - 1]]) {
      if (r() < 0.55) continue;
      g.fillStyle = '#d6a64a'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0b1f16'; g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill();
    }
  }

  // pads + silkscreen around the main parts
  g.font = `600 ${0.26 * S}px "IBM Plex Mono", monospace`;
  g.textBaseline = 'middle';
  for (const p of Object.values(pcbParts)) {
    const [cx, cy] = toPx(p.x, p.y);
    const w = p.w * S, h = p.h * S;
    const padGold = '#d9ab52';
    if (['isp', 'ram', 'emmc', 'mcu', 'pmic'].includes(p.id)) {
      const n = Math.max(4, Math.round(p.w * 7));
      g.fillStyle = padGold;
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n - 0.5;
        g.fillRect(cx + f * w - 3, cy - h / 2 - 12, 6, 14);
        g.fillRect(cx + f * w - 3, cy + h / 2 - 2, 6, 14);
        g.fillRect(cx - w / 2 - 12, cy + f * h - 3, 14, 6);
        g.fillRect(cx + w / 2 - 2, cy + f * h - 3, 14, 6);
      }
    } else {
      g.fillStyle = padGold;
      g.fillRect(cx - w / 2 - 4, cy - h / 2 - 4, w + 8, h + 8);
      g.fillStyle = '#123d2a';
      g.fillRect(cx - w / 2 + 6, cy - h / 2 + 6, w - 12, h - 12);
    }
    g.strokeStyle = 'rgba(240,240,232,0.85)'; g.lineWidth = 2;
    g.strokeRect(cx - w / 2 - 18, cy - h / 2 - 18, w + 36, h + 36);
    g.fillStyle = 'rgba(240,240,232,0.9)';
    g.fillText(p.ref, cx - w / 2 - 16, cy - h / 2 - 34);
    g.beginPath(); g.arc(cx - w / 2 - 8, cy - h / 2 - 8, 3, 0, Math.PI * 2); g.fill();
  }
  // passive pads
  for (const q of passives) {
    const [x, y] = toPx(q.x, q.y);
    g.save(); g.translate(x, y); g.rotate(q.rot);
    g.fillStyle = '#d9ab52'; g.fillRect(-16, -6, 9, 12); g.fillRect(7, -6, 9, 12);
    g.restore();
  }
  // mounting holes
  for (const [mx, my] of [[-3.75, 5.95], [3.75, 5.95], [-3.75, -5.95], [3.75, -5.95]]) {
    const [x, y] = toPx(mx, my);
    g.fillStyle = '#d6a64a'; g.beginPath(); g.arc(x, y, 0.3 * S, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#071510'; g.beginPath(); g.arc(x, y, 0.17 * S, 0, Math.PI * 2); g.fill();
  }
  // silkscreen text
  g.fillStyle = 'rgba(244,243,236,0.95)';
  g.font = `700 ${0.34 * S}px "IBM Plex Mono", monospace`;
  g.textAlign = 'center';
  g.fillText('RUGGED LYNX RL-1 · REV C', W / 2, H - 0.62 * S);
  g.font = `500 ${0.2 * S}px "IBM Plex Mono", monospace`;
  g.fillText('MAIN BOARD · 2026-10 · MADE FOR THE FIELD', W / 2, H - 0.3 * S);
  g.textAlign = 'left';
  g.fillText('+12V', toPx(-0.4, -5.75)[0] - 0.7 * S, toPx(0, -5.2)[1]);
  g.fillText('PIR', toPx(-1.9, -4.3)[0] - 0.2 * S, toPx(0, -4.3)[1]);
  g.fillText('IR / CAM', toPx(-0.8, 5.0)[0], toPx(0, 5.05)[1]);

  const color = new THREE.CanvasTexture(c);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 8;
  const signal = new THREE.CanvasTexture(sig);
  signal.colorSpace = THREE.NoColorSpace;
  signal.generateMipmaps = false;
  signal.minFilter = THREE.LinearFilter;
  pcbCache = { color, signal };
  return pcbCache;
}

/** Laser-etched top for a black epoxy package. */
export function chipTop(lines: string[], light = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = light ? '#cfccc4' : '#1b1b1d';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = light ? '#55524c' : 'rgba(200,200,205,0.55)';
  g.beginPath(); g.arc(30, 30, 10, 0, Math.PI * 2); g.fill();
  g.font = '600 30px "IBM Plex Mono", monospace';
  g.textAlign = 'center';
  lines.forEach((l, i) => g.fillText(l, 128, 118 + (i - (lines.length - 1) / 2) * 40));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Concentric ridges for the PIR Fresnel lens, used as a bump map. */
export function fresnelBump() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 300;
  const g = c.getContext('2d')!;
  const img = g.createImageData(512, 300);
  for (let y = 0; y < 300; y++) for (let x = 0; x < 512; x++) {
    const cell = Math.floor(x / 171);
    const cx = cell * 171 + 85, cy = 150;
    const d = Math.hypot(x - cx, y - cy);
    const v = ((d / 9) % 1) * 255;
    const i = (y * 512 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** Wrap for the AA cells. */
export function cellWrap() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2b2b2b'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#cbb495'; g.fillRect(0, 170, 512, 34);
  g.fillStyle = '#e8901d'; g.fillRect(0, 204, 512, 10);
  g.fillStyle = '#f2efe6';
  g.font = '700 40px "Saira Condensed", sans-serif';
  g.save(); g.translate(256, 90); g.rotate(-Math.PI / 2);
  g.textAlign = 'center'; g.fillText('AA 1.5V', 0, 0); g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft radial sprite for LED glow points. */
export function glowSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
