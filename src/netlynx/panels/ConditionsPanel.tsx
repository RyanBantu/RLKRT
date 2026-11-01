import { useEffect, useState } from 'react';
import { conditions as c } from '../content';
import { getWeather, type Weather } from '../api/weather';
import { compass16, type LatLng } from '../geo';
import { fmtClock, isoMinutes, moonPhase, skyLabel } from '../sky';
import { useSource } from '../useSource';
import { ErrorState, Panel, Skeleton } from './Panel';

export type Units = 'imperial' | 'metric';

export const fmtTemp = (cDeg: number, u: Units) => `${Math.round(u === 'imperial' ? cDeg * 1.8 + 32 : cDeg)}°${u === 'imperial' ? 'F' : 'C'}`;
export const fmtSpeed = (kmh: number, u: Units) => `${Math.round(u === 'imperial' ? kmh * 0.621371 : kmh)} ${u === 'imperial' ? 'mph' : 'km/h'}`;
const fmtPrecip = (mm: number, u: Units) => (u === 'imperial' ? `${(mm / 25.4).toFixed(2)} in` : `${mm.toFixed(1)} mm`);
const fmtPressure = (hpa: number, u: Units) => (u === 'imperial' ? `${(hpa * 0.02953).toFixed(2)} inHg` : `${Math.round(hpa)} hPa`);

export function pressureTrend(w: Weather): 'rising' | 'falling' | 'steady' {
  if (w.pressure6hAgo == null) return 'steady';
  const d = w.current.pressure - w.pressure6hAgo;
  return d > 1 ? 'rising' : d < -1 ? 'falling' : 'steady';
}

function LocalClock({ tz }: { tz: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(now);
  const zone = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value;
  const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(now);
  return (
    <div className="clock">
      <span className="big">{time}</span>
      <span className="sub">{zone} · {day}</span>
    </div>
  );
}

function WindArrow({ from }: { from: number }) {
  // Arrow points the way the wind is blowing (from + 180°).
  return (
    <svg className="compass" viewBox="-24 -24 48 48" aria-hidden>
      <circle r="21" />
      {['N', 'E', 'S', 'W'].map((l, i) => (
        <text key={l} x={Math.sin((i * Math.PI) / 2) * 15.5} y={-Math.cos((i * Math.PI) / 2) * 15.5 + 3}>{l}</text>
      ))}
      <g transform={`rotate(${from + 180})`}>
        <path d="M0 -12 L5 4 L0 1 L-5 4 Z" />
        <line x1="0" y1="1" x2="0" y2="12" />
      </g>
    </svg>
  );
}

function Moon({ fraction }: { fraction: number }) {
  // Terminator drawn as an ellipse; lit side on the right while waxing (northern hemisphere).
  const k = Math.cos(2 * Math.PI * fraction); // 1 new → -1 full
  const waxing = fraction < 0.5;
  const rx = Math.abs(k) * 10;
  const lit = waxing
    ? `M0 -10 A10 10 0 0 1 0 10 A${rx} 10 0 0 ${k > 0 ? 0 : 1} 0 -10`
    : `M0 -10 A10 10 0 0 0 0 10 A${rx} 10 0 0 ${k > 0 ? 1 : 0} 0 -10`;
  return (
    <svg className="moon" viewBox="-12 -12 24 24" aria-hidden>
      <circle r="10" className="moon-dark" />
      <path d={lit} className="moon-lit" />
    </svg>
  );
}

function PrecipBars({ w, units }: { w: Weather; units: Units }) {
  const max = Math.max(0.5, ...w.hourly.map((h) => h.precip));
  const dry = w.hourly.every((h) => h.precip === 0 && (h.prob ?? 0) < 10);
  const label = (iso: string) => fmtClock(isoMinutes(iso)).replace(':00', '').replace(' ', '').toLowerCase();
  return (
    <figure className="bars">
      <div className="bars-plot" role="img" aria-label={`${c.next24}: hourly precipitation`}>
        {w.hourly.map((h) => (
          <div className="bar-slot" key={h.time} title={`${label(h.time)} · ${fmtPrecip(h.precip, units)}${h.prob != null ? ` · ${h.prob}% ${c.chanceLabel}` : ''}`}>
            {h.prob != null && <span className="bar-prob" style={{ height: `${h.prob}%` }} />}
            <span className="bar" style={{ height: `${(h.precip / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="bars-axis" aria-hidden>
        {w.hourly.filter((_, i) => i % 6 === 0).map((h) => <span key={h.time}>{label(h.time)}</span>)}
      </div>
      <figcaption>
        {dry && <b className="dry">{c.dry} · </b>}
        <span className="key key--amt" /> amount (max {fmtPrecip(max, units)}) <span className="key key--prob" /> {c.chanceLabel}
      </figcaption>
      <table className="sr-only">
        <caption>{c.next24}</caption>
        <tbody>
          {w.hourly.map((h) => (
            <tr key={h.time}><th>{label(h.time)}</th><td>{fmtPrecip(h.precip, units)}</td><td>{h.prob ?? '–'}%</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function ConditionsPanel({ loc, units, setUnits }: { loc: LatLng & { zip: string }; units: Units; setUnits: (u: Units) => void }) {
  const [src, retry] = useSource(loc.zip, () => getWeather(loc));
  const moon = moonPhase();

  const toggle = (
    <div className="seg" role="group" aria-label={c.unitsLabel}>
      <button aria-pressed={units === 'imperial'} onClick={() => setUnits('imperial')}>{c.imperial}</button>
      <button aria-pressed={units === 'metric'} onClick={() => setUnits('metric')}>{c.metric}</button>
    </div>
  );

  let body;
  if (src.status === 'ok') {
    const w = src.data;
    const rise = isoMinutes(w.sunrise);
    const set = isoMinutes(w.sunset);
    const trend = pressureTrend(w);
    const dp = w.pressure6hAgo == null ? 0 : w.current.pressure - w.pressure6hAgo;
    body = (
      <>
        <div className="cond-top">
          <LocalClock tz={w.timezone} />
          <div className="temp">
            <span className="big">{fmtTemp(w.current.temperature, units)}</span>
            <span className="sub">{skyLabel(w.current.code)} · {c.feelsLike} {fmtTemp(w.current.feelsLike, units)}</span>
          </div>
        </div>
        <ol className="light-line" aria-label="Daylight">
          <li><b>{c.firstLight}</b><span>{fmtClock(rise - 30)}</span></li>
          <li><b>{c.sunrise}</b><span>{fmtClock(rise)}</span></li>
          <li><b>{c.sunset}</b><span>{fmtClock(set)}</span></li>
          <li><b>{c.lastLight}</b><span>{fmtClock(set + 30)}</span></li>
        </ol>
        <p className="fine">{c.lightNote}</p>
        <div className="cond-grid">
          <div className="cell">
            <WindArrow from={w.current.windDir} />
            <div>
              <b>{c.wind}</b>
              <span className="val">{fmtSpeed(w.current.windSpeed, units)}</span>
              <span className="sub">{c.from} {compass16(w.current.windDir)} · {c.gusts} {fmtSpeed(w.current.windGusts, units)}</span>
            </div>
          </div>
          <div className="cell">
            <span className={`trend trend--${trend}`} aria-hidden>{trend === 'rising' ? '▲' : trend === 'falling' ? '▼' : '▶'}</span>
            <div>
              <b>{c.pressure}</b>
              <span className="val">{fmtPressure(w.current.pressure, units)}</span>
              <span className="sub">{c.trend[trend]} {dp >= 0 ? '+' : '−'}{Math.abs(dp).toFixed(1)} hPa {c.trendNote}</span>
            </div>
          </div>
          <div className="cell">
            <Moon fraction={moon.fraction} />
            <div>
              <b>{c.moon}</b>
              <span className="val">{moon.name}</span>
              <span className="sub">{Math.round(moon.illumination * 100)}% {c.illuminated}</span>
            </div>
          </div>
          <div className="cell">
            <svg className="drop" viewBox="0 0 20 24" aria-hidden><path d="M10 1 C10 1 2 11 2 15.5 A8 8 0 0 0 18 15.5 C18 11 10 1 10 1 Z" /></svg>
            <div>
              <b>{c.precipNow}</b>
              <span className="val">{fmtPrecip(w.current.precip, units)}</span>
              <span className="sub">{w.hourly[0]?.prob != null ? `${w.hourly[0].prob}% ${c.chanceLabel} this hour` : ''}</span>
            </div>
          </div>
        </div>
        <h3 className="mini-h">{c.next24}</h3>
        <PrecipBars w={w} units={units} />
      </>
    );
  } else if (src.status === 'error') {
    body = <ErrorState kind={src.kind} onRetry={retry} />;
  } else body = <Skeleton rows={6} tall />;

  return (
    <Panel id="conditions" title={c.title} credit={c.credit} creditUrl={c.creditUrl} actions={toggle} busy={src.status === 'loading'}>
      {body}
    </Panel>
  );
}
