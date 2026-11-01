import { useMemo, useState } from 'react';
import { game as c } from '../content';
import { getSpeciesCounts } from '../api/inat';
import { activityFor, eventsFor, GAME, inatMatches, STATE_AGENCIES, STATE_REGION, type GameSpecies, type Region } from '../data/game';
import type { LatLng } from '../geo';
import { useSource } from '../useSource';
import { Panel } from './Panel';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LEVELS = ['Quiet', 'Low', 'Active', 'Peak'];

function PeakStrip({ s, region }: { s: GameSpecies; region: Region }) {
  const act = activityFor(s, region);
  const now = new Date().getMonth();
  const events = eventsFor(s, region);
  return (
    <div className="peak">
      <ol className="peak-strip" aria-label={c.peak}>
        {act.map((v, i) => (
          <li key={i} className={i === now ? 'now' : undefined} data-level={v} aria-label={`${MONTH_NAMES[i]}: ${LEVELS[v]}${i === now ? `, ${c.thisMonth}` : ''}`}>
            <span className="peak-bar" style={{ height: `${18 + v * 27}%` }} />
            <span className="peak-m" aria-hidden>{MONTHS[i]}</span>
          </li>
        ))}
      </ol>
      <ul className="peak-events">
        {events.map((e) => (
          <li key={e.label} className={e.months.includes(now + 1) ? 'now' : undefined}>
            <b>{e.label}</b> {e.months.map((m) => MONTH_NAMES[m - 1].slice(0, 3)).join(' · ')}
          </li>
        ))}
      </ul>
    </div>
  );
}

const regionOf = (state: string): Region => STATE_REGION[state] ?? 'MW';

export function GamePanel({ loc }: { loc: LatLng & { zip: string; stateCode: string; state: string } }) {
  const [src] = useSource(loc.zip, () => getSpeciesCounts(loc));
  const [open, setOpen] = useState<string | null>(null);
  const region = regionOf(loc.stateCode);
  const species = useMemo(() => GAME.filter((s) => s.states.includes(loc.stateCode)), [loc.stateCode]);
  const counts = src.status === 'ok' ? src.data : null;
  const rows = useMemo(
    () =>
      species
        .map((s) => ({ s, n: counts ? inatMatches(s, counts) : 0 }))
        .sort((a, b) => Number(b.n > 0) - Number(a.n > 0) || b.n - a.n),
    [species, counts],
  );
  const agency = STATE_AGENCIES[loc.stateCode];
  const sel = rows.find((r) => r.s.id === open);

  return (
    <Panel id="game" title={c.title} meta={`${loc.state} · ${c.pick}`} credit={c.credit} creditUrl={c.creditUrl} busy={src.status === 'loading'}>
      {species.length === 0 ? (
        <p className="empty">{c.none}</p>
      ) : (
        <>
          {src.status === 'error' && <p className="fine">{c.inatFailed}</p>}
          <ul className="chips" role="list">
            {rows.map(({ s, n }) => (
              <li key={s.id}>
                <button
                  className={`species-chip${n > 0 ? ' is-confirmed' : ''}`}
                  aria-expanded={open === s.id}
                  aria-controls="game-detail"
                  onClick={() => setOpen((o) => (o === s.id ? null : s.id))}
                >
                  <span className="sc-name">{s.name}</span>
                  <span className="sc-status">
                    {src.status === 'loading' ? <span className="sk sk--inline" /> : n > 0 ? c.confirmed(n) : c.expected}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div id="game-detail" className="game-detail" aria-live="polite">
            {sel && (
              <>
                <h3 className="mini-h">{sel.s.name}</h3>
                <dl className="tips">
                  {(Object.keys(c.tips) as (keyof typeof c.tips)[]).map((k) => (
                    <div key={k}><dt>{c.tips[k]}</dt><dd>{sel.s.tips[k]}</dd></div>
                  ))}
                </dl>
                <h4 className="mini-h">{c.peak}</h4>
                <PeakStrip s={sel.s} region={region} />
              </>
            )}
          </div>
        </>
      )}
      <p className="legal">
        {c.legal}{' '}
        {agency && (
          <>
            {c.agency} <a href={agency.url} target="_blank" rel="noreferrer">{agency.name}</a>
          </>
        )}
      </p>
    </Panel>
  );
}
