import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { trueFourK as copy, trueFourKVerdict } from '../../content';
import { reducedMotion } from '../../store';
import { closeTrue4k } from './control';
import { CH, CW, setUiScale, step1, step2, step3, step4, step5, sweepAt, sweepDone, type StepState } from './draw';
import { FULL, tkData, tkSensor } from './pipeline';

const STEPS = copy.steps.length;
const fmt = (n: number) => n.toLocaleString('en-US');
const short = (n: number) => `${(n / 1e6).toFixed(2)}M`;

/** Fonts first (the tag is set in IBM Plex Mono), then the truth and 2 MP buffers. Cached after the first open. */
let ready: Promise<void> | null = null;
function prepare() {
  ready ??= (async () => {
    await Promise.all([
      document.fonts.load('700 27px "IBM Plex Mono"'),
      document.fonts.load('600 19px "IBM Plex Mono"'),
    ]).catch(() => {});
    await document.fonts.ready;
    tkData();
    tkSensor(2);
  })();
  return ready;
}

export default function TrueFourK() {
  const [step, setStep] = useState(0);
  const [mp, setMp] = useState<number>(2);
  const [loaded, setLoaded] = useState(false);
  const [divider, setDivider] = useState(50); // mirrored into the hidden range input
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const realRef = useRef<HTMLSpanElement>(null);
  const guessRef = useRef<HTMLSpanElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const started = useRef(0); // set when each step begins
  const s4 = useRef<StepState & { swept: boolean; pressed: boolean }>({
    mp: 2,
    divider: 0.5,
    loupe: null,
    idleLoupe: !window.matchMedia('(pointer: coarse)').matches,
    lift: 0,
    dragging: false,
    swept: reducedMotion,
    pressed: false,
  });

  useEffect(() => {
    let alive = true;
    prepare().then(() => alive && setLoaded(true));
    closeRef.current?.focus();
    return () => {
      alive = false;
    };
  }, []);

  // restart the step clock (and step 4's sweep) on each step change
  useEffect(() => {
    started.current = performance.now();
    if (step === 3) {
      s4.current.swept = reducedMotion;
      s4.current.divider = 0.5;
      s4.current.loupe = null;
    }
  }, [step]);

  useEffect(() => {
    s4.current.mp = mp;
    if (loaded) tkSensor(mp);
  }, [mp, loaded]);

  // backing store follows the displayed size so the pixel grid stays crisp
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => {
      const scale = Math.min(2, Math.max(1, (c.clientWidth * devicePixelRatio) / CW));
      c.width = Math.round(CW * scale);
      c.height = Math.round(CH * scale);
      setUiScale(c.clientWidth);
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // draw loop
  useEffect(() => {
    if (!loaded) return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      ctx.setTransform(c.width / CW, 0, 0, c.height / CH, 0, 0);
      const t = reducedMotion ? Infinity : (performance.now() - started.current) / 1000;
      let out;
      if (step === 0) out = step1(ctx, t);
      else if (step === 1) out = step2(ctx, t);
      else if (step === 2) out = step3(ctx, t);
      else if (step === 3) {
        const st = s4.current;
        if (!st.swept && !st.dragging) {
          st.divider = sweepAt(t);
          if (sweepDone(t)) {
            st.swept = true;
            st.divider = 0.5;
          }
        }
        out = step4(ctx, st);
      } else out = step5(ctx, t, copy.closeLeft, copy.closeRight);
      if (out.count != null && countRef.current) countRef.current.textContent = fmt(out.count);
      if (out.real != null && realRef.current) realRef.current.textContent = short(out.real);
      if (out.guessed != null && guessRef.current) guessRef.current.textContent = short(out.guessed);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [loaded, step]);

  const go = (k: number) => setStep(Math.max(0, Math.min(STEPS - 1, k)));

  // ---- keyboard: steps, Esc, focus trap
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeTrue4k();
      return;
    }
    if (e.key === 'Tab') {
      const f = [...rootRef.current!.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if ((e.target as HTMLElement).tagName === 'INPUT') return; // the divider slider owns its arrows
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      go(step + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      go(step - 1);
    }
  };

  // ---- swipe between steps (touch), except on step 4 where the canvas is interactive
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onRootDown = (e: PointerEvent) => {
    swipe.current = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : null;
  };
  const onRootUp = (e: PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || step === 3) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(step + (dx < 0 ? 1 : -1));
  };

  // ---- step 4: drag the divider, loupe follows the pointer (on touch, while pressed)
  const toCanvas = (e: PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * CW, y: ((e.clientY - r.top) / r.height) * CH };
  };
  const onCanvasDown = (e: PointerEvent) => {
    if (step !== 3) return;
    const p = toCanvas(e);
    const st = s4.current;
    st.swept = true;
    st.lift = e.pointerType === 'touch' ? 60 : 0;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // the pointer is already gone
    }
    const reach = ((e.pointerType === 'touch' ? 24 : 14) * CW) / canvasRef.current!.clientWidth; // css px either side
    if (Math.abs(p.x - st.divider * CW) < reach) st.dragging = true;
    else {
      st.pressed = true;
      st.loupe = p;
    }
  };
  const onCanvasMove = (e: PointerEvent) => {
    if (step !== 3) return;
    const p = toCanvas(e);
    const st = s4.current;
    if (st.dragging) {
      st.divider = Math.max(0, Math.min(1, p.x / CW));
      setDivider(Math.round(st.divider * 100));
    } else if (e.pointerType === 'mouse' || st.pressed) st.loupe = p;
  };
  const onCanvasUp = (e: PointerEvent) => {
    s4.current.dragging = false;
    s4.current.pressed = false;
    if (e.pointerType === 'touch') s4.current.loupe = null; // the touch loupe shows only while pressed
  };

  const s = copy.steps[step];
  const body = step === 4 ? trueFourKVerdict() : s.body;

  return (
    <div
      ref={rootRef}
      className="tk"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tk-title"
      onKeyDown={onKey}
      onPointerDown={onRootDown}
      onPointerUp={onRootUp}
    >
      <div className="tk-camo" aria-hidden />
      <header className="tk-top">
        <p className="tk-kicker" id="tk-title">{copy.title}</p>
        <ol className="tk-dots" aria-label={copy.stepOf(step + 1, STEPS)}>
          {copy.steps.map((x, k) => (
            <li key={x.title}>
              <button
                className={k === step ? 'is-on' : k < step ? 'is-past' : undefined}
                aria-current={k === step ? 'step' : undefined}
                aria-label={`${k + 1}. ${x.title}`}
                onClick={() => go(k)}
              />
            </li>
          ))}
        </ol>
        <button ref={closeRef} className="tk-close" onClick={() => closeTrue4k()} aria-label={copy.close}>
          <span aria-hidden>×</span>
        </button>
      </header>

      <div className="tk-body">
        <div className={`tk-stage${step === 3 ? ' is-interactive' : ''}`}>
          <canvas
            ref={canvasRef}
            width={CW}
            height={CH}
            role="img"
            aria-label={s.canvas}
            onPointerDown={onCanvasDown}
            onPointerMove={onCanvasMove}
            onPointerUp={onCanvasUp}
            onPointerCancel={onCanvasUp}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse' && !s4.current.dragging) s4.current.loupe = null;
            }}
          />
          {!loaded && <div className="tk-loading" aria-hidden />}
          <p className="tk-readout" aria-hidden>
            <i />
            {copy.readout(step === 1 || step === 2 ? '1920×1080' : step === 3 && mp < 8.3 ? `${mp} MP → 3840×2160` : '3840×2160')}
            <span>{`STEP ${String(step + 1).padStart(2, '0')}/${String(STEPS).padStart(2, '0')}`}</span>
          </p>
        </div>

        <div className="tk-copy">
          <p className="tk-step">{copy.stepOf(step + 1, STEPS)}</p>
          <div aria-live="polite" aria-atomic="true">
            <h2>{s.title}</h2>
            <p className="tk-text">{body}</p>
          </div>

          {(step === 0 || step === 1) && (
            <p className="tk-counter">
              <span ref={countRef} className="tk-num">{fmt(reducedMotion ? (step === 0 ? FULL : 1920 * 1080) : 0)}</span>
              <span className="tk-unit">{s.counter}</span>
            </p>
          )}
          {step === 2 && (
            <div className="tk-split">
              <p>
                <span className="tk-swatch tk-swatch--real" aria-hidden />
                <span className="tk-unit">{copy.real}</span>
                <span ref={realRef} className="tk-num">{short(1920 * 1080)}</span>
              </p>
              <p>
                <span className="tk-swatch tk-swatch--guess" aria-hidden />
                <span className="tk-unit">{copy.guessed}</span>
                <span ref={guessRef} className="tk-num">{short(reducedMotion ? FULL * 0.75 : 0)}</span>
              </p>
              <p className="tk-share">
                <b>75%</b> {copy.guessedShare}
              </p>
            </div>
          )}
          {step === 3 && (
            <>
              <div className="tk-toggle" role="group" aria-label={copy.sensorLabel}>
                <span className="tk-unit">{copy.sensorLabel}</span>
                {copy.sensors.map((o) => (
                  <button key={o.mp} aria-pressed={mp === o.mp} onClick={() => setMp(o.mp)}>
                    {o.label}
                  </button>
                ))}
              </div>
              <label className="sr-only">
                {copy.dividerLabel}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={divider}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setDivider(v);
                    s4.current.swept = true;
                    s4.current.divider = v / 100;
                  }}
                />
              </label>
            </>
          )}
          {step === 4 && (
            <>
              <h3 className="tk-check-title">{copy.checkTitle}</h3>
              <ul className="tk-check">
                {copy.check.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="tk-tradeoff">{copy.tradeoff}</p>
            </>
          )}

          <div className="tk-nav">
            <button className="tk-btn tk-btn--ghost" onClick={() => go(step - 1)} disabled={step === 0}>
              {copy.back}
            </button>
            {step < STEPS - 1 ? (
              <button className="tk-btn" onClick={() => go(step + 1)}>
                {copy.next}
              </button>
            ) : (
              <button className="tk-btn" onClick={() => closeTrue4k()}>
                {copy.done}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
