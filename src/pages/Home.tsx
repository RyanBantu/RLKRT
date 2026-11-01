import { lazy, Suspense, useEffect } from 'react';
import { Link } from 'react-router';
import { scoutCta } from '../content';
import { closeTrue4k, openTrue4k, TK_HASH, useTrue4kOpen } from '../features/true4k/control';
import { TrueFourKTeaser } from '../features/true4k/Teaser';
import { Stage } from '../ui/Stage';
import { useSmoothScroll } from '../ui/useSmoothScroll';

const TrueFourK = lazy(() => import('../features/true4k/TrueFourK'));

export default function Home() {
  useSmoothScroll('stage');
  const tkOpen = useTrue4kOpen();

  // #true-4k opens the explainer, on load and on later hash changes
  useEffect(() => {
    const sync = () => {
      if (window.location.hash === TK_HASH) openTrue4k();
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      closeTrue4k({ keepHash: true });
    };
  }, []);

  return (
    <main id="top">
      <div inert={tkOpen}>
        <Stage paused={tkOpen} />
        <TrueFourKTeaser paused={tkOpen} />
        <section className="scout-cta" aria-labelledby="scout-cta-title">
          <div className="scout-cta-inner">
            <p className="eyebrow">{scoutCta.eyebrow}</p>
            <h2 id="scout-cta-title">{scoutCta.title}</h2>
            <p className="brief">{scoutCta.body}</p>
            <Link className="scout-link" to="/netlynx">{scoutCta.link}</Link>
          </div>
        </section>
      </div>
      {tkOpen && (
        <Suspense fallback={null}>
          <TrueFourK />
        </Suspense>
      )}
    </main>
  );
}
