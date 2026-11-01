import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { reducedMotion } from '../store';
import './netlynx.css';
import { ApiError } from './api/http';
import { isZip, lookupZip, type ZipPlace } from './api/zip';
import { nl } from './content';
import { formatCoord } from './geo';
import type { BirdPoint, GlobeTarget, Relief } from './globe/Globe';
import { BirdsPanel } from './panels/BirdsPanel';
import { ConditionsPanel, type Units } from './panels/ConditionsPanel';
import { GamePanel } from './panels/GamePanel';
import { TerrainPanel } from './panels/TerrainPanel';

const Globe = lazy(() => import('./globe/Globe'));

type Phase = 'idle' | 'looking' | 'locking' | 'locked';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

function SearchForm({ initial, error, busy, onSubmit, compact }: {
  initial: string; error: string | null; busy: boolean; onSubmit: (zip: string) => void; compact?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    setValue(initial);
  }, [initial]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const z = value.trim();
    if (!isZip(z)) return setLocal(nl.invalid);
    setLocal(null);
    onSubmit(z);
  };
  const msg = local ?? error;
  return (
    <form className={`nl-search${compact ? ' nl-search--compact' : ''}`} onSubmit={submit} noValidate>
      <label htmlFor={compact ? 'zip-compact' : 'zip'}>{nl.inputLabel}</label>
      <div className="nl-search-row">
        <input
          id={compact ? 'zip-compact' : 'zip'}
          name="zip"
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="[0-9]{5}"
          maxLength={5}
          placeholder={nl.inputPlaceholder}
          value={value}
          aria-invalid={!!msg}
          aria-describedby={msg ? 'zip-error' : undefined}
          onChange={(e) => {
            setValue(e.target.value.replace(/\D/g, '').slice(0, 5));
            setLocal(null);
          }}
        />
        <button className="btn" type="submit" disabled={busy}>{nl.submit}</button>
      </div>
      {msg && <p id="zip-error" className="nl-error" role="alert">{msg}</p>}
      {!compact && (
        <div className="nl-examples">
          <span>{nl.examplesLabel}</span>
          {nl.examples.map((x) => (
            <button key={x.zip} type="button" className="chip" onClick={() => { setValue(x.zip); onSubmit(x.zip); }}>
              <b>{x.zip}</b> {x.label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

export default function NetLynxPage() {
  const { zip: param } = useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('idle');
  const [place, setPlace] = useState<ZipPlace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<Units>('imperial');
  const [birds, setBirds] = useState<BirdPoint[]>([]);
  const [relief, setRelief] = useState<Relief | null>(null);
  const [recenter, setRecenter] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [active, setActive] = useState(true);
  const [webgl] = useState(hasWebGL);
  const globeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = place ? `${place.zip} · ${place.place}, ${place.stateCode} · NetLynx` : nl.docTitle;
  }, [place]);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting));
    if (globeRef.current) io.observe(globeRef.current);
    return () => io.disconnect();
  }, []);

  // The URL is the source of truth: /netlynx/:zip looks up and locks on.
  useEffect(() => {
    setBirds([]);
    setRelief(null);
    setAnnounce('');
    if (!param) {
      setPlace(null);
      setPhase('idle');
      setError(null);
      return;
    }
    if (!isZip(param)) {
      setPlace(null);
      setPhase('idle');
      setError(nl.invalid);
      return;
    }
    let live = true;
    setPhase('looking');
    setError(null);
    lookupZip(param).then(
      (p) => {
        if (!live) return;
        setPlace(p);
        setPhase(reducedMotion || !webgl ? 'locked' : 'locking');
        if (reducedMotion || !webgl) setAnnounce(nl.announce(`${p.place}, ${p.stateCode}`, p.zip));
      },
      (e) => {
        if (!live) return;
        setPlace(null);
        setPhase('idle');
        setError(e instanceof ApiError && e.kind === 'not_found' ? nl.notFound : nl.lookupFailed);
      },
    );
    return () => {
      live = false;
    };
  }, [param, webgl]);

  const placeRef = useRef(place);
  placeRef.current = place;
  const onLocked = useCallback(() => {
    setPhase((ph) => (ph === 'locking' ? 'locked' : ph));
    const p = placeRef.current;
    if (p) setAnnounce(nl.announce(`${p.place}, ${p.stateCode}`, p.zip));
  }, []);

  const submit = (z: string) => {
    if (z === param && place) setRecenter((n) => n + 1);
    else navigate(`/netlynx/${z}`);
  };

  const target: GlobeTarget | null = place ? { lat: place.lat, lng: place.lng, key: place.zip } : null;
  const showPanels = phase === 'locked' && place;
  const readout = place
    ? `${phase === 'locked' ? nl.locked : nl.locking} · ${place.zip} · ${place.place}, ${place.stateCode} · ${formatCoord(place)}`.toUpperCase()
    : null;
  const loc = place;

  return (
    <main className="nl" data-phase={phase}>
      <div className="nl-bg" aria-hidden />
      <p className="sr-only" aria-live="polite" role="status">{announce}</p>

      <div className="nl-layout">
        <div className="nl-globe" ref={globeRef}>
          {webgl ? (
            <Suspense fallback={null}>
              <Globe
                target={target}
                birds={birds}
                relief={relief}
                reducedMotion={reducedMotion}
                active={active}
                recenter={recenter}
                onLocked={onLocked}
              />
            </Suspense>
          ) : (
            <p className="nl-webgl">{nl.webglOff}</p>
          )}

          {place && (
            <svg className={`reticle reticle--${phase}`} viewBox="-50 -50 100 100" aria-hidden>
              <path d="M-40 -24 V-40 H-24 M24 -40 H40 V-24 M40 24 V40 H24 M-24 40 H-40 V24" />
              <line x1="0" y1="-48" x2="0" y2="-34" />
              <line x1="0" y1="34" x2="0" y2="48" />
              <line x1="-48" y1="0" x2="-34" y2="0" />
              <line x1="34" y1="0" x2="48" y2="0" />
            </svg>
          )}

          {phase === 'idle' || phase === 'looking' ? (
            <div className="nl-hero">
              <p className="eyebrow">{nl.eyebrow}</p>
              <h1>{nl.headline}</h1>
              <p className="brief">{nl.intro}</p>
              <SearchForm initial={param ?? ''} error={error} busy={phase === 'looking'} onSubmit={submit} />
            </div>
          ) : null}

          {readout && (
            <div className="nl-readout" aria-hidden>
              <span className={`dot${phase === 'locked' ? ' is-on' : ''}`} />
              <span className="txt">{readout}</span>
            </div>
          )}
          {phase === 'locked' && webgl && (
            <div className="nl-globe-tools">
              <span aria-hidden>{nl.dragHint}</span>
              <button className="chip" onClick={() => setRecenter((n) => n + 1)}>{nl.recenter}</button>
            </div>
          )}
        </div>

        {loc && (
          <div className="nl-panels" hidden={!showPanels} aria-label={nl.panelsLabel}>
            <SearchForm initial={place!.zip} error={error} busy={false} onSubmit={submit} compact />
            <h1 className="nl-place">
              {place!.place}, {place!.stateCode} <span>{place!.zip}</span>
            </h1>
            <nav className="nl-jump" aria-label="Panels">
              <a href="#panel-conditions">Conditions</a>
              <a href="#panel-birds">Birds</a>
              <a href="#panel-game">Game</a>
              <a href="#panel-terrain">Terrain</a>
            </nav>
            <ConditionsPanel loc={loc} units={units} setUnits={setUnits} />
            <BirdsPanel loc={loc} onPoints={setBirds} />
            <GamePanel loc={loc} />
            <TerrainPanel loc={loc} units={units} onRelief={setRelief} />
          </div>
        )}
      </div>
    </main>
  );
}
