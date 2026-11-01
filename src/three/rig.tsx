import { useFrame, useThree } from '@react-three/fiber';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { callouts } from '../content';
import { anchors, calloutEls, drag, reducedMotion, scroll } from '../store';
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
    const hFrac = mobile ? 0.46 : 0.8;
    const wFrac = mobile ? 0.92 : 0.5;
    const dist = Math.max(live.size / (2 * tanH * hFrac), (live.size * 0.75) / (2 * tanH * (w / h) * wFrac));
    cam.position.set(tx, ty + Math.sin(live.elev) * dist, tz + Math.cos(live.elev) * dist);
    cam.lookAt(tx, ty, tz);
    cam.setViewOffset(w, h, mobile ? 0 : -w * 0.17, mobile ? h * 0.19 : 0, w, h);
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
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = String(v.z < 1 ? wgt : 0);
      if (el.dataset.side !== side) el.dataset.side = side;
    }
    gl.render(scene, camera);
  }, 1);
  return null;
}

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__rl = { live, anchors, debug };
