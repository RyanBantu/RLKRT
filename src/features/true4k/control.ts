import { useSyncExternalStore } from 'react';
import { SENSOR_MP, STILL_RES_NATIVE, STILL_RES_SHOWN } from '../../content';
import { nav } from '../../store';

// Open state for the True 4K overlay, shared by the hero button, the teaser and the 3D stage
// (which pauses while it is open). Opening sets #true-4k; closing clears it and returns focus.

export const TK_HASH = '#true-4k';

let open = false;
let opener: HTMLElement | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setHash(on: boolean) {
  const { pathname, search } = window.location;
  history.replaceState(history.state, '', on ? `${pathname}${search}${TK_HASH}` : `${pathname}${search}`);
}

export function openTrue4k(from?: HTMLElement | null) {
  if (open) return;
  opener = from ?? (document.activeElement as HTMLElement | null);
  open = true;
  nav.lock(true);
  if (window.location.hash !== TK_HASH) setHash(true);
  emit();
}

/** `keepHash` is for teardown (leaving the page), where the URL is not ours to change. */
export function closeTrue4k({ keepHash = false } = {}) {
  if (!open) return;
  open = false;
  nav.lock(false);
  if (!keepHash && window.location.hash === TK_HASH) setHash(false);
  emit();
  const el = opener;
  opener = null;
  requestAnimationFrame(() => el?.focus({ preventScroll: true }));
}

export function useTrue4kOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
  );
}

// A claim that is itself interpolated would undercut the whole explainer.
if (import.meta.env.DEV) {
  const px = (res: string) => {
    const m = res.match(/(\d+)\s*[×x]\s*(\d+)/);
    return m ? Number(m[1]) * Number(m[2]) : NaN;
  };
  if (SENSOR_MP != null && SENSOR_MP < 8.3) {
    console.warn(`[True 4K] SENSOR_MP is ${SENSOR_MP}: below 8.3 MP, the RL-1's own 4K would be interpolated.`);
  }
  for (const r of STILL_RES_SHOWN) {
    if (px(r) > px(STILL_RES_NATIVE)) {
      console.warn(`[True 4K] The site quotes a ${r} still, above the native ${STILL_RES_NATIVE}: that still is interpolated.`);
    }
  }
}
