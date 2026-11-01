import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { callouts } from '../content';
import { anchors, calloutEls, drag, layout, reducedMotion, scroll } from '../store';
import { chapterWeight, makePose, poseAt } from './timeline';

/** The pose for the current frame. Parts read from this. */
export const live = makePose();

/** Dev-only: force pose values from the console, e.g. __rl.debug.override = { yaw: 0 }. */
const debug: { override: Partial<typeof live> | null } = { override: null };

export const isMobile = (w: number) => w < 760;

/** Drives the model rotation and camera framing from the scroll pose. Runs before the parts. */
export function Rig({ model }: { model: RefObject<THREE.Group | null> }) {
  const { camera, size } = useThree();
  useFrame(({ clock }, dt) => {
    poseAt(scroll.ts, live);
    if (import.meta.env.DEV && debug.override) Object.assign(live, debug.override);
    const g = model.current;
    if (!g) return;

    const sway = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.35) * 0.22 * live.sway;
    if (!drag.active) {
      const k = Math.exp(-dt * 3.2);
      drag.yaw *= k;
      drag.pitch *= k;
    }
    const yaw = live.yaw + sway + drag.yaw;
    g.rotation.set(drag.pitch, yaw, 0);

    // focus point, rotated with the model
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const tx = live.tx * c + live.tz * s;
    const tz = -live.tx * s + live.tz * c;
    const ty = live.ty;

    // fit `size` cm into the free part of the screen (right of the card, or above it on phones)
    const cam = camera as THREE.PerspectiveCamera;
    const w = size.width, h = size.height, mobile = isMobile(w);
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    // phones: the measured band between header and cards (falls back to the upper half)
    const band = mobile && layout.bottom > layout.top ? layout : { top: h * 0.08, bottom: h * 0.54 };
    const hFrac = mobile ? (0.9 * (band.bottom - band.top)) / h : 0.8;
    const wFrac = mobile ? 0.8 : 0.5;
    const dist = Math.max(live.size / (2 * tanH * hFrac), (live.size * 0.75) / (2 * tanH * (w / h) * wFrac));
    cam.position.set(tx, ty + Math.sin(live.elev) * dist, tz + Math.cos(live.elev) * dist);
    cam.lookAt(tx, ty, tz);
    cam.setViewOffset(w, h, mobile ? 14 : -w * 0.17, mobile ? h / 2 - (band.top + band.bottom) / 2 : 0, w, h);
    cam.near = dist * 0.05;
    cam.far = dist * 8;
    cam.updateProjectionMatrix();
  }, -1);
  return null;
}

/** Projects callout anchors to screen space, then renders the frame. */
export function Projector() {
  const v = new THREE.Vector3();
  useFrame(({ gl, scene, camera, size }) => {
    scene.updateMatrixWorld();
    const mobile = isMobile(size.width);
    const reach = mobile ? 150 : 250;
    const leftLimit = mobile ? 8 : Math.min(size.width * 0.38, 520);
    const rightLimit = size.width - (mobile ? 40 : 200);
    const placed: { label: HTMLElement; left: number; right: number; cy: number; h: number }[] = [];
    for (const c of callouts) {
      const el = calloutEls.get(c.id);
      const a = anchors.get(c.id);
      if (!el || !a) continue;
      const wgt = chapterWeight(scroll.ts, c.chapter);
      if (wgt < 0.01) {
        if (el.style.opacity !== '0') el.style.opacity = '0';
        continue;
      }
      a.getWorldPosition(v).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      let side = c.side ?? 'right';
      if (side === 'right' && x + reach > rightLimit) side = 'left';
      else if (side === 'left' && x - reach < leftLimit) side = 'right';
      // phones: labels point away from the model's centre (it sits 14px left of mid) so leaders never cross
      if (mobile) side = x < size.width / 2 - 14 ? 'left' : 'right';
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      // phones: slide the label along its leader so it never leaves the screen or runs under the rail
      if (mobile) {
        const label = el.lastElementChild as HTMLElement | null;
        if (label) {
          const lw = label.offsetWidth;
          const left = side === 'left' ? x - 48 - lw : x + 48;
          const nudge = Math.max(8 - left, Math.min(0, rightLimit - (left + lw)));
          label.style.setProperty('--nudge', `${nudge.toFixed(0)}px`);
          if (v.z < 1 && wgt > 0.3) {
            const cy = y + (el.dataset.lift === 'down' ? 18 : -18);
            placed.push({ label, left: left + nudge, right: left + nudge + lw, cy, h: label.offsetHeight });
          }
        }
      }
      el.style.opacity = String(v.z < 1 ? wgt : 0);
      if (el.dataset.side !== side) el.dataset.side = side;
    }
    // phones: push overlapping labels apart vertically
    if (mobile) {
      placed.sort((p, q) => p.cy - q.cy);
      const shift = new Map<HTMLElement, number>();
      placed.forEach((p, i) => {
        let cy = p.cy;
        for (let j = 0; j < i; j++) {
          const q = placed[j];
          const qy = q.cy + (shift.get(q.label) ?? 0);
          const gap = (p.h + q.h) / 2 + 4;
          if (p.left < q.right && q.left < p.right && cy - qy < gap) cy = qy + gap;
        }
        shift.set(p.label, cy - p.cy);
      });
      for (const p of placed) p.label.style.setProperty('--nudge-y', `${(shift.get(p.label) ?? 0).toFixed(0)}px`);
    }
    gl.render(scene, camera);
  }, 1);
  return null;
}

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__rl = { live, anchors, debug };
