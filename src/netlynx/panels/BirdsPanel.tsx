import { useEffect, useMemo, useState } from 'react';
import { birds as c } from '../content';
import { getRecentBirds, type EbirdObs } from '../api/ebird';
import type { LatLng } from '../geo';
import { useSource } from '../useSource';
import { ErrorState, Panel, Skeleton } from './Panel';

const GAME_RE =
  /turkey|grouse|pheasant|quail|bobwhite|partridge|ptarmigan|prairie-chicken|chukar|dove|woodcock|snipe|duck|goose|brant|teal|mallard|wigeon|gadwall|pintail|shoveler|scaup|canvasback|redhead|bufflehead|goldeneye|merganser|scoter|eider|long-tailed duck/i;
export const isGameBird = (name: string) => GAME_RE.test(name) && !/rock pigeon|dovekie|vulture|muscovy/i.test(name);

type Row = { code: string; name: string; sci: string; count: number; present: boolean; loc: string; last: number; game: boolean };
type Sort = 'count' | 'name' | 'recent';

// eBird obsDt is local time at the site with no zone; treat it as local wall time there.
const parseObs = (s: string) => new Date(s.replace(' ', 'T') + (s.length <= 10 ? 'T12:00' : '')).getTime();

function ago(ms: number, now: number) {
  const h = Math.max(0, (now - ms) / 3600000);
  if (h < 1) return 'under 1 h ago';
  if (h < 24) return `${Math.round(h)} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function group(obs: EbirdObs[]): Row[] {
  const m = new Map<string, Row>();
  for (const o of obs) {
    const t = parseObs(o.obsDt);
    const r = m.get(o.speciesCode);
    if (!r) {
      m.set(o.speciesCode, {
        code: o.speciesCode, name: o.comName, sci: o.sciName, count: o.howMany ?? 0, present: o.howMany == null,
        loc: o.locName, last: t, game: isGameBird(o.comName),
      });
    } else {
      r.count += o.howMany ?? 0;
      if (o.howMany == null) r.present = true;
      if (t > r.last) { r.last = t; r.loc = o.locName; }
    }
  }
  return [...m.values()];
}

export function BirdsPanel({ loc, onPoints }: { loc: LatLng & { zip: string }; onPoints: (p: { lat: number; lng: number; game: boolean }[]) => void }) {
  const [src, retry] = useSource(loc.zip, () => getRecentBirds(loc));
  const [sort, setSort] = useState<Sort>('count');
  const [all, setAll] = useState(false);
  const now = Date.now();

  const rows = useMemo(() => (src.status === 'ok' ? group(src.data) : []), [src]);
  useEffect(() => {
    onPoints(src.status === 'ok' ? src.data.map((o) => ({ lat: o.lat, lng: o.lng, game: isGameBird(o.comName) })) : []);
  }, [src, onPoints]);

  const sorted = useMemo(() => {
    const r = [...rows];
    if (sort === 'count') r.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    else if (sort === 'name') r.sort((a, b) => a.name.localeCompare(b.name));
    else r.sort((a, b) => b.last - a.last);
    return r;
  }, [rows, sort]);

  let body;
  if (src.status === 'ok') {
    const total = rows.reduce((s, r) => s + r.count, 0);
    const shown = all ? sorted : sorted.slice(0, 12);
    body = rows.length === 0 ? (
      <p className="empty">{c.empty}</p>
    ) : (
      <>
        <dl className="tally">
          <div><dd>{rows.length}</dd><dt>{c.species}</dt></div>
          <div><dd>{total.toLocaleString()}</dd><dt>{c.total}</dt></div>
          <div><dd>{rows.filter((r) => r.game).length}</dd><dt>game species</dt></div>
        </dl>
        <div className="seg seg--sm" role="group" aria-label={c.sortBy}>
          {(Object.keys(c.sorts) as Sort[]).map((k) => (
            <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{c.sorts[k]}</button>
          ))}
        </div>
        <table className="list">
          <thead className="sr-only"><tr><th>Species</th><th>Count</th><th>Where</th><th>When</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.code}>
                <th scope="row">
                  <span className="sp">{r.name}</span>
                  {r.game && <span className="tag">{c.game}</span>}
                  <span className="where">{r.loc}</span>
                </th>
                <td className="num">{r.count ? r.count.toLocaleString() : c.presentOnly}</td>
                <td className="when">{ago(r.last, now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length > 12 && (
          <button className="chip" onClick={() => setAll((v) => !v)} aria-expanded={all}>
            {all ? c.showLess : c.showAll(sorted.length)}
          </button>
        )}
      </>
    );
  } else if (src.status === 'error') {
    body = <ErrorState kind={src.kind} message={src.kind === 'not_configured' ? c.notConfigured : undefined} onRetry={retry} />;
  } else body = <Skeleton rows={7} />;

  return (
    <Panel id="birds" title={c.title} meta={c.window} credit={c.credit} creditUrl={c.creditUrl} busy={src.status === 'loading'}>
      {body}
    </Panel>
  );
}
