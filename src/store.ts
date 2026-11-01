import type * as THREE from 'three';

// Shared mutable state read every frame by the 3D scene and the DOM overlays.
// Kept outside React so per-frame updates never cause re-renders.

export const CHAPTER_COUNT = 8; // 0 intro … 7 reassembled
export const LAST = CHAPTER_COUNT - 1;

export const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const scroll = {
  progress: 0, // 0..1 across the pinned stage
  t: 0, // 0..LAST, chapter-space position
  ts: 0, // smoothed t, what everything renders from
};

export const drag = { yaw: 0, pitch: 0, active: false };

// 3D anchor points for the callouts, registered by <Anchor/>.
export const anchors = new Map<string, THREE.Object3D>();

// Callout DOM nodes, positioned every frame by the 3D projector.
export const calloutEls = new Map<string, HTMLElement>();

// Smooth-scroll hook installed by the scroll controller.
export const nav = {
  toChapter: (_k: number) => {},
  /** Jump straight to a chapter-space position (0..LAST), e.g. while scrubbing the slider. */
  toPosition: (_t: number) => {},
};
