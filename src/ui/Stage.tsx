import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent } from 'react';
import gsap from 'gsap';
import { brand, callouts, chapters, hero, stamp } from '../content';
import { calloutEls, drag, LAST, nav, reducedMotion, scroll } from '../store';
import { chapterWeight } from '../three/timeline';
import { RailSlider } from './RailSlider';

const Scene = lazy(() => import('../three/Scene'));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

export function Stage() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardRefs = useRef<HTMLElement[]>([]);
  const railRefs = useRef<HTMLButtonElement[]>([]);
  const railFill = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const partRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(true);
  const [webgl] = useState(hasWebGL);
  const [fontsReady, setFontsReady] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Canvas textures draw text, so wait for the fonts (briefly) before building the scene.
  useEffect(() => {
    const loads = ['600 30px "IBM Plex Mono"', '700 40px "Saira Condensed"'].map((f) => document.fonts.load(f));
    const timeout = new Promise((r) => setTimeout(r, 1500));
    Promise.race([Promise.all(loads), timeout]).finally(() => setFontsReady(true));
  }, []);

  // Pause rendering while the stage is off screen.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: '100px' });
    if (sectionRef.current) io.observe(sectionRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Per-frame DOM updates: card crossfades, rail state, progress line, stamp part number.
  useEffect(() => {
    let lastActive = -1;
    const tick = (_time: number, deltaMs: number) => {
      const dt = Math.min(deltaMs, 100) / 1000;
      scroll.ts = reducedMotion ? scroll.t : scroll.ts + (scroll.t - scroll.ts) * (1 - Math.exp(-dt * 9));
      const t = scroll.ts;
      cardRefs.current.forEach((el, k) => {
        if (!el) return;
        const w = reducedMotion ? (Math.round(t) === k ? 1 : 0) : chapterWeight(t, k);
        el.style.opacity = w.toFixed(3);
        el.style.setProperty('--shift', `${((1 - w) * (t > k ? -18 : 18)).toFixed(1)}px`);
        el.style.visibility = w < 0.01 ? 'hidden' : 'visible';
        el.style.pointerEvents = w > 0.5 ? 'auto' : 'none';
      });
      const a = Math.round(t);
      if (a !== lastActive) {
        lastActive = a;
        railRefs.current.forEach((b, k) => b?.setAttribute('aria-current', k === a ? 'step' : 'false'));
        if (partRef.current) partRef.current.textContent = `PART ${pad(a)}/${pad(LAST)}`;
      }
      const p = t / LAST;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${p.toFixed(4)})`;
      if (railFill.current) railFill.current.style.transform = `scaleY(${p.toFixed(4)})`;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  // Drag to rotate; vertical gestures stay with the page (touch-action: pan-y).
  const last = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: PointerEvent) => {
    drag.active = true;
    last.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.active || !last.current) return;
    drag.yaw += (e.clientX - last.current.x) * 0.009;
    drag.pitch = Math.max(-0.5, Math.min(0.5, drag.pitch + (e.clientY - last.current.y) * 0.004));
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => {
    drag.active = false;
    last.current = null;
  };

  const date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const tempF = Math.round(stamp.tempC * 1.8 + 32);

  return (
    <section id="stage" className="stage" ref={sectionRef} aria-label="Product teardown">
      <div className="stage-sticky">
        <div className="camo-band camo-band--top" aria-hidden />
        <div className="topo" aria-hidden />
        <div className="camo-vignette" aria-hidden />
        <div className="rail-strip" aria-hidden />

        {webgl ? (
          <div
            className="canvas-wrap"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            aria-label="3D model of the RL-1 trail camera. Drag to rotate."
            role="img"
          >
            {fontsReady && (
              <Suspense fallback={null}>
                <Scene active={active} />
              </Suspense>
            )}
          </div>
        ) : (
          <div className="webgl-fallback">
            <img src="/brand/camera-reference.png" alt="The Rugged Lynx RL-1 trail camera" />
            <p>The interactive 3D teardown needs WebGL, which this browser has turned off. Here’s the camera itself.</p>
          </div>
        )}

        <div className="stage-fade" aria-hidden />

        <div className="callouts" aria-hidden>
          {callouts.map((c) => (
            <div
              key={c.id}
              className="callout"
              data-side={c.side ?? 'right'}
              data-lift={c.lift ?? 'up'}
              ref={(el) => { if (el) calloutEls.set(c.id, el); }}
              style={{ opacity: 0 }}
            >
              <span className="callout-dot" />
              <svg className="callout-leader" viewBox="0 0 80 40" preserveAspectRatio="none">
                <polyline points="0,40 26,12 80,12" />
              </svg>
              <span className="callout-label">
                <b>{c.label}</b>
                {c.value && <span>{c.value}</span>}
              </span>
            </div>
          ))}
        </div>

        <div className="cards">
          {chapters.map((ch, k) => (
            <article
              key={ch.id}
              className={`card card--${ch.id}`}
              ref={(el) => { if (el) cardRefs.current[k] = el; }}
              style={{ opacity: k === 0 ? 1 : 0 }}
            >
              {k === 0 ? (
                <>
                  <img className="hero-logo" src={brand.logo} alt={brand.logoAlt} width={1932} height={534} />
                  <p className="eyebrow">{hero.eyebrow}</p>
                  <h1>{hero.headline}</h1>
                  <p className="brief">{hero.brief}</p>
                  <dl className="stats">
                    {hero.stats.map((s) => (
                      <div key={s.label}>
                        <dt>{s.label}</dt>
                        <dd>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <button className="cue" onClick={() => nav.toChapter(1)}>
                    <span className="cue-line" aria-hidden />
                    {hero.cue}
                  </button>
                </>
              ) : (
                <>
                  <p className="eyebrow">{ch.eyebrow}</p>
                  <h2 className={k === LAST ? 'closing' : undefined}>{ch.title}</h2>
                  <p className="brief">{ch.body}</p>
                  {ch.specs && (
                    <dl className="specs">
                      {ch.specs.map((s) => (
                        <div key={s.label}>
                          <dt>{s.label}</dt>
                          <dd>{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </>
              )}
            </article>
          ))}
        </div>

        <nav className="rail" aria-label="Chapters" ref={railRef}>
          <div className="rail-track" aria-hidden>
            <div className="rail-fill" ref={railFill} />
          </div>
          {chapters.map((ch, k) => (
            <button
              key={ch.id}
              ref={(el) => { if (el) railRefs.current[k] = el; }}
              onClick={() => nav.toChapter(k)}
              aria-current={k === 0 ? 'step' : 'false'}
              aria-label={ch.rail}
            >
              <span className="rail-name">{ch.rail}</span>
              <span className="rail-dot" />
            </button>
          ))}
          <RailSlider railRef={railRef} />
        </nav>

        <div className="stamp" aria-hidden>
          <div className="stamp-progress" ref={progressRef} />
          <span>{stamp.prefix}</span>
          <span className="opt">{stamp.cam}</span>
          <span className="opt">◐ {stamp.tempC}°C/{tempF}°F</span>
          <span className="opt-sm">{date}</span>
          <span>live {time}</span>
          <span ref={partRef}>PART 00/{pad(LAST)}</span>
        </div>
      </div>
    </section>
  );
}
