import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import gsap from 'gsap';
import { chapters, teardownSlider as copy } from '../content';
import { LAST, nav, scroll } from '../store';

/**
 * Drag handle that rides the chapter rail: slide it down the dots to take the camera apart.
 * It follows the page when people scroll, and settles on the nearest chapter on release.
 */
export function RailSlider({ railRef }: { railRef: RefObject<HTMLElement | null> }) {
  const thumbRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const span = useRef({ y0: 0, y1: 1 });
  const dragging = useRef(false);
  const grabOffset = useRef(0);
  const lastK = useRef(-1);

  // Measure the first and last dot centers (relative to the rail) so the handle runs dot to dot.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const measure = () => {
      const dots = rail.querySelectorAll<HTMLElement>('.rail-dot');
      if (dots.length < 2) return;
      const r = rail.getBoundingClientRect();
      const a = dots[0].getBoundingClientRect();
      const b = dots[dots.length - 1].getBoundingClientRect();
      span.current = { y0: a.top + a.height / 2 - r.top, y1: b.top + b.height / 2 - r.top };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(rail);
    return () => ro.disconnect();
  }, [railRef]);

  useEffect(() => {
    const tick = () => {
      const thumb = thumbRef.current;
      if (!thumb) return;
      const { y0, y1 } = span.current;
      const t = Math.min(LAST, Math.max(0, scroll.ts));
      thumb.style.transform = `translate(50%, -50%) translateY(${(y0 + ((y1 - y0) * t) / LAST).toFixed(1)}px)`;
      const k = Math.round(scroll.ts);
      if (k !== lastK.current) {
        lastK.current = k;
        thumb.setAttribute('aria-valuenow', String(k));
        thumb.setAttribute('aria-valuetext', k === 0 ? copy.assembled : chapters[k].rail);
        hintRef.current?.classList.toggle('is-hidden', k !== 0);
      }
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  const positionAt = (clientY: number) => {
    const r = railRef.current!.getBoundingClientRect();
    const { y0, y1 } = span.current;
    return ((clientY - grabOffset.current - r.top - y0) / Math.max(1, y1 - y0)) * LAST;
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    grabOffset.current = e.clientY - (rect.top + rect.height / 2);
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add('is-dragging');
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) nav.toPosition(positionAt(e.clientY));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.classList.remove('is-dragging');
    nav.toChapter(Math.round(Math.min(LAST, Math.max(0, positionAt(e.clientY)))));
  };

  const onKey = (e: KeyboardEvent) => {
    const k = Math.round(scroll.t);
    const to =
      e.key === 'ArrowDown' || e.key === 'ArrowRight' ? k + 1
      : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? k - 1
      : e.key === 'Home' ? 0
      : e.key === 'End' ? LAST
      : null;
    if (to === null) return;
    e.preventDefault();
    nav.toChapter(Math.min(LAST, Math.max(0, to)));
  };

  return (
    <>
      <span className="rail-hint" ref={hintRef} aria-hidden>{copy.hint}</span>
      <div
        className="rail-thumb"
        ref={thumbRef}
        role="slider"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label={copy.label}
        aria-valuemin={0}
        aria-valuemax={LAST}
        aria-valuenow={0}
        aria-valuetext={copy.assembled}
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <i /><i /><i />
      </div>
    </>
  );
}
