import gsap from 'gsap';
import { LAST, reducedMotion } from '../store';

// One flat set of numbers per chapter. Parts read the interpolated values each frame.
export type Pose = {
  yaw: number; // model rotation, radians
  elev: number; // camera elevation, radians
  size: number; // how many cm of model to fit in frame
  tx: number; ty: number; tz: number; // focus point in model space (cm)
  door: number; // door swing, degrees
  latch: number; // 0 closed → 1 released
  bodyOp: number; doorOp: number; gasketOp: number;
  lensZ: number; lensOp: number;
  sensorZ: number; sensorOp: number;
  irZ: number; irOp: number; glow: number;
  pirZ: number; pirOp: number; fans: number;
  pcbZ: number; pcbOp: number; pulse: number; sd: number;
  battZ: number; battY: number; battOp: number;
  sway: number; // idle turntable amount
};

const base: Pose = {
  yaw: 0.5, elev: 0.1, size: 23, tx: 0, ty: 0, tz: 0,
  door: 0, latch: 0,
  bodyOp: 1, doorOp: 1, gasketOp: 1,
  lensZ: 0, lensOp: 1, sensorZ: 0, sensorOp: 1,
  irZ: 0, irOp: 1, glow: 0,
  pirZ: 0, pirOp: 1, fans: 0,
  pcbZ: 0, pcbOp: 1, pulse: 0, sd: 0,
  battZ: 0, battY: 0, battOp: 1,
  sway: 0,
};

const GHOST = 0.14;
const ghostAll = {
  bodyOp: GHOST, doorOp: 0.1, gasketOp: GHOST, lensOp: GHOST, sensorOp: GHOST,
  irOp: GHOST, pirOp: GHOST, pcbOp: GHOST, battOp: GHOST,
};

export const poses: Pose[] = [
  // 0 intro
  { ...base, yaw: 0.42, sway: 1 },
  // 1 shell: door swings open on its left hinges
  { ...base, yaw: -0.5, elev: 0.16, size: 27, tx: -3.5, ty: 0, tz: 2, door: 140, latch: 1, sway: 0.15 },
  // 2 optics
  { ...base, ...ghostAll, yaw: -0.75, elev: 0.12, size: 15, tx: 0, ty: 0.6, tz: 5.5, door: 140, latch: 1, lensZ: 6, lensOp: 1, sensorZ: 2.6, sensorOp: 1, sway: 0.1 },
  // 3 night vision
  { ...base, ...ghostAll, yaw: 0.35, elev: 0.18, size: 19, tx: 0, ty: 4.2, tz: 6, door: 140, latch: 1, irZ: 4, irOp: 1, glow: 1, sway: 0.1 },
  // 4 trigger
  { ...base, ...ghostAll, yaw: 0.6, elev: 0.55, size: 36, tx: 0, ty: -3, tz: 12, door: 140, latch: 1, pirZ: 3.5, pirOp: 1, fans: 1, sway: 0.08 },
  // 5 main board
  { ...base, ...ghostAll, bodyOp: 0.06, doorOp: 0.04, gasketOp: 0.06, lensOp: 0.06, sensorOp: 0.06, irOp: 0.06, pirOp: 0.06, battOp: 0.06, yaw: -0.18, elev: 0.06, size: 15.5, tx: 0, ty: 0, tz: 7, door: 140, latch: 1, pcbZ: 7.5, pcbOp: 1, pulse: 1, sd: 1, sway: 0.06 },
  // 6 power: turn to the back, tray slides out
  { ...base, ...ghostAll, bodyOp: 0.22, yaw: Math.PI - 0.6, elev: 0.2, size: 27, tx: 0, ty: -1.5, tz: -5, door: 140, latch: 1, battZ: -7, battY: -1, battOp: 1, sway: 0.08 },
  // 7 reassembled
  { ...base, yaw: Math.PI * 2 - 0.5, sway: 1 },
];

const keys = Object.keys(base) as (keyof Pose)[];
const ease = gsap.parseEase('power2.inOut');
const HOLD = 0.16; // fraction of each chapter gap spent holding still at each end

/** Blend between chapter poses with a short hold at every chapter. */
export function poseAt(t: number, out: Pose): Pose {
  const c = Math.min(Math.max(t, 0), LAST);
  const k = Math.min(Math.floor(c), LAST - 1);
  const f = c - k;
  let s = Math.min(Math.max((f - HOLD) / (1 - 2 * HOLD), 0), 1);
  s = reducedMotion ? (s < 0.5 ? 0 : 1) : ease(s);
  const a = poses[k], b = poses[k + 1];
  for (const key of keys) out[key] = a[key] + (b[key] - a[key]) * s;
  return out;
}

/** 1 at a chapter, fading to 0 between chapters. Used for cards and callouts. */
export function chapterWeight(t: number, k: number) {
  const d = Math.abs(t - k);
  const x = Math.min(Math.max((d - 0.28) / 0.17, 0), 1);
  return 1 - x * x * (3 - 2 * x);
}

export const makePose = (): Pose => ({ ...base });
