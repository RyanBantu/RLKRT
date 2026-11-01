import { useEffect, useMemo, useRef, useState } from 'react';
import { terrain as c } from '../content';
import { getElevationGrid, SECTOR_GRID } from '../api/elevation';
import { getTerrain, type LandCover } from '../api/overpass';
import { getPublicLand } from '../api/padus';
import { getWeather } from '../api/weather';
import { FT_PER_M, MI_PER_KM, type LatLng } from '../geo';
import { huntNotes } from '../notes';
import { drawRelief, meanGrade } from '../relief';
import { STATE_REGION } from '../data/game';
import type { Relief } from '../globe/Globe';
import { useSource } from '../useSource';
import type { Units } from './ConditionsPanel';
import { ErrorState, Panel, Skeleton } from './Panel';

const COVER_ORDER: (keyof LandCover)[] = ['forest', 'farmland', 'grass', 'wetland', 'water', 'developed', 'other'];

export function TerrainPanel({ loc, units, onRelief }: { loc: LatLng & { zip: string; stateCode: string }; units: Units; onRelief: (r: Relief | null) => void }) {
  const [elev, retryElev] = useSource(loc.zip, () => getElevationGrid(loc));
  const [osm, retryOsm] = useSource(loc.zip, () => getTerrain(loc));
  const [land] = useSource(loc.zip, () => getPublicLand(loc));
  const [wx] = useSource(loc.zip, () => getWeather(loc));
  const [wide] = useSource(loc.zip, () => getElevationGrid(loc, SECTOR_GRID.n, SECTOR_GRID.halfKm, false));
  const [slow, setSlow] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const imp = units === 'imperial';
  const h = (m: number) => (imp ? `${Math.round(m * FT_PER_M).toLocaleString()} ft` : `${Math.round(m).toLocaleString()} m`);
  const d = (km: number) => (imp ? `${(km * MI_PER_KM).toFixed(km * MI_PER_KM < 10 ? 1 : 0)} mi` : `${km.toFixed(km < 10 ? 1 : 0)} km`);

  useEffect(() => {
    setSlow(false);
    if (osm.status !== 'loading') return;
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, [osm.status]);

  const tile = useMemo(() => (elev.status === 'ok' ? drawRelief(elev.data, 180) : null), [elev]);
  useEffect(() => {
    // The globe gets the wide sector grid; fall back to the local one.
    const g = wide.status === 'ok' ? wide.data : elev.status === 'ok' ? elev.data : null;
    onRelief(g ? { canvas: drawRelief(g, 256, true).canvas, halfKm: g.halfKm, key: loc.zip } : null);
  }, [elev, wide, onRelief, loc.zip]);
  useEffect(() => {
    const el = tileRef.current;
    if (!el || !tile) return;
    tile.canvas.setAttribute('aria-hidden', 'true');
    el.replaceChildren(tile.canvas);
  }, [tile]);

  const dry = ['SW', 'MTN', 'PL'].includes(STATE_REGION[loc.stateCode] ?? '');
  const notes = huntNotes({
    grid: elev.status === 'ok' ? elev.data : undefined,
    osm: osm.status === 'ok' ? osm.data : undefined,
    land: land.status === 'ok' ? land.data : undefined,
    wx: wx.status === 'ok' ? wx.data : undefined,
    units,
    dry,
  });

  // Public land: PAD-US first (authoritative), then OSM protected areas not already listed.
  const publicLand = [
    ...(land.status === 'ok' ? land.data.map((u) => ({ name: u.name, kind: [u.type, u.manager !== 'Unknown' ? u.manager : ''].filter(Boolean).join(' · ') })) : []),
    ...(osm.status === 'ok' ? osm.data.publicLand : []),
  ].filter((u, i, a) => a.findIndex((x) => x.name.toLowerCase() === u.name.toLowerCase()) === i).slice(0, 7);

  let elevBody;
  if (elev.status === 'ok') {
    const g = elev.data;
    const min = Math.min(...g.values);
    const max = Math.max(...g.values);
    const grade = meanGrade(g);
    const kind = grade < 1.5 ? 'flat' : grade < 4 ? 'rolling' : grade < 9 ? 'hilly' : 'steep';
    elevBody = (
      <div className="terrain-top">
        <figure className="relief-tile">
          <div ref={tileRef} className="relief-canvas" role="img" aria-label={`${c.tileLabel(g.halfKm)}, contours every ${h(tile?.step ?? 0)}`} />
          <span className="relief-pin" aria-hidden />
          <figcaption>{c.tileLabel(g.halfKm)} · contours {h(tile?.step ?? 0)}</figcaption>
        </figure>
        <dl className="tally tally--stack">
          <div><dd>{h(g.center)}</dd><dt>{c.elevation}</dt></div>
          <div><dd>{h(min)}–{h(max)}</dd><dt>{c.range}</dt></div>
          <div><dd>{h(max - min)}</dd><dt>{c.relief} · {c.reliefKinds[kind]}</dt></div>
          <div><dd>{grade.toFixed(1)}°</dd><dt>{c.grade}</dt></div>
        </dl>
      </div>
    );
  } else if (elev.status === 'error') elevBody = <ErrorState kind={elev.kind} onRetry={retryElev} />;
  else elevBody = <Skeleton rows={3} tall />;

  let osmBody;
  if (osm.status === 'ok') {
    const t = osm.data;
    osmBody = (
      <>
        <h3 className="mini-h">{c.cover}</h3>
        <div className="cover-bar" role="img" aria-label={COVER_ORDER.map((k) => `${c.coverKinds[k]} ${Math.round(t.cover[k] * 100)}%`).join(', ')}>
          {COVER_ORDER.filter((k) => t.cover[k] > 0).map((k) => (
            <span key={k} className={`cv cv--${k}`} style={{ flexGrow: t.cover[k] }} title={`${c.coverKinds[k]} ${Math.round(t.cover[k] * 100)}%`} />
          ))}
        </div>
        <ul className="cover-legend">
          {COVER_ORDER.filter((k) => t.cover[k] > 0).map((k) => (
            <li key={k}><span className={`cv cv--${k}`} aria-hidden />{c.coverKinds[k]} <b>{Math.round(t.cover[k] * 100)}%</b></li>
          ))}
        </ul>
        <p className="fine">{c.coverNote}</p>
        <div className="terrain-cols">
          <div>
            <h3 className="mini-h">{c.access}</h3>
            <dl className="kv">
              <div><dt>{c.trails}</dt><dd>{d(t.km.trail)}</dd></div>
              <div><dt>{c.tracks2}</dt><dd>{d(t.km.track)}</dd></div>
              <div><dt>{c.roads}</dt><dd>{d(t.km.road)}</dd></div>
            </dl>
          </div>
          <div>
            <h3 className="mini-h">{c.water}</h3>
            <dl className="kv">
              <div><dt>{c.streams}</dt><dd>{d(t.km.stream)}</dd></div>
              <div><dt>{c.ponds}</dt><dd>{t.waterBodies}</dd></div>
              <div><dt>{c.springs}</dt><dd>{t.springs}</dd></div>
            </dl>
          </div>
        </div>
      </>
    );
  } else if (osm.status === 'error') osmBody = <ErrorState kind={osm.kind} message={c.osmFailed} onRetry={retryOsm} />;
  else
    osmBody = (
      <>
        {slow && <p className="fine">{c.osmSlow}</p>}
        <Skeleton rows={4} />
      </>
    );

  return (
    <Panel id="terrain" title={c.title} credit={c.credit} creditUrl={c.creditUrl} busy={elev.status === 'loading' || osm.status === 'loading'}>
      {elevBody}
      {osmBody}
      <h3 className="mini-h">{c.publicLand}</h3>
      {land.status === 'loading' && osm.status === 'loading' ? (
        <Skeleton rows={2} />
      ) : publicLand.length ? (
        <ul className="public-land">
          {publicLand.map((u) => <li key={u.name}><b>{u.name}</b> {u.kind && <span>{u.kind}</span>}</li>)}
        </ul>
      ) : (
        <p className="fine">{c.noPublic}</p>
      )}
      <div className="notes">
        <h3 className="mini-h">{c.notes}</h3>
        {notes.length ? (
          <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
        ) : (
          <Skeleton rows={3} />
        )}
        <p className="fine">{c.notesNote}</p>
      </div>
    </Panel>
  );
}
