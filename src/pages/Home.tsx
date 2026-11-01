import { Link } from 'react-router';
import { scoutCta } from '../content';
import { Stage } from '../ui/Stage';
import { useSmoothScroll } from '../ui/useSmoothScroll';

export default function Home() {
  useSmoothScroll('stage');
  return (
    <main id="top">
      <Stage />
      <section className="scout-cta" aria-labelledby="scout-cta-title">
        <div className="scout-cta-inner">
          <p className="eyebrow">{scoutCta.eyebrow}</p>
          <h2 id="scout-cta-title">{scoutCta.title}</h2>
          <p className="brief">{scoutCta.body}</p>
          <Link className="scout-link" to="/netlynx">{scoutCta.link}</Link>
        </div>
      </section>
    </main>
  );
}
