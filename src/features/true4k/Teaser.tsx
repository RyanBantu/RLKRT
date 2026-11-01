import { useEffect, useRef } from 'react';
import { trueFourK } from '../../content';
import { reducedMotion } from '../../store';
import { step3 } from './draw';
import { tkData, tkSensor } from './pipeline';
import { TrueFourKButton } from './OpenButton';

const W = 480, H = 270;
const LOOP = 6.5; // seconds: split, fill, arrows, hold

/** Landing-page teaser: a small looping canvas of the step-3 pixel split. Builds its buffers when scrolled near. */
export function TrueFourKTeaser({ paused }: { paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visible = useRef(false);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    let raf = 0;
    let built = false;
    let t0 = 0;
    const draw = (now: number) => {
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const k = c.width / W;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      step3(ctx, reducedMotion ? Infinity : ((now - t0) / 1000) % LOOP, W, H, 8);
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (visible.current && !pausedRef.current) draw(now);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        visible.current = e.isIntersecting;
        if (e.isIntersecting && !built) {
          built = true;
          document.fonts.ready.then(() => {
            tkData();
            tkSensor(2);
            t0 = performance.now();
            const scale = Math.min(2, Math.max(1, (c.clientWidth * devicePixelRatio) / W));
            c.width = Math.round(W * scale);
            c.height = Math.round(H * scale);
            if (reducedMotion) draw(performance.now());
            else raf = requestAnimationFrame(loop);
          });
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(c);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const t = trueFourK.teaser;
  return (
    <section className="tk-teaser" aria-labelledby="tk-teaser-title">
      <div className="tk-teaser-inner">
        <div className="tk-teaser-copy">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="tk-teaser-title">{t.title}</h2>
          <p className="brief">{t.body}</p>
          <TrueFourKButton />
        </div>
        <div className="tk-teaser-frame">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            role="img"
            aria-label={trueFourK.steps[2].canvas}
          />
          <p className="tk-teaser-key" aria-hidden>
            <span><i className="tk-swatch tk-swatch--real" />{trueFourK.real}</span>
            <span><i className="tk-swatch tk-swatch--guess" />{trueFourK.guessed}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
