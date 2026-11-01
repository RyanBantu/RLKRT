import type { ElevationGrid } from './api/elevation';
import type { Terrain } from './api/overpass';
import type { PublicUnit } from './api/padus';
import type { Weather } from './api/weather';
import { compass8, FT_PER_M, MI_PER_KM } from './geo';
import { moonPhase } from './sky';
import type { Units } from './panels/ConditionsPanel';

// Rule-based hunt notes. Each rule reads whatever sources have loaded; nothing here is AI-generated.

type In = { grid?: ElevationGrid; osm?: Terrain; land?: PublicUnit[]; wx?: Weather; units: Units; dry: boolean };

export function huntNotes({ grid, osm, land, wx, units, dry }: In): string[] {
  const out: string[] = [];
  const imp = units === 'imperial';
  const len = (m: number) => (imp ? `${Math.round(m * FT_PER_M).toLocaleString()} ft` : `${Math.round(m).toLocaleString()} m`);
  const dist = (km: number) => (imp ? `${Math.round(km * MI_PER_KM)} mi` : `${Math.round(km)} km`);
  const speed = (kmh: number) => (imp ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`);

  if (grid) {
    const relief = Math.max(...grid.values) - Math.min(...grid.values);
    const cover = osm && osm.cover.forest >= 0.35 ? 'Heavy timber' : osm && osm.cover.farmland >= 0.3 ? 'Farm country' : 'Broken country';
    if (relief >= 300) out.push(`${cover} with ${len(relief)} of relief: glass benches and saddles at first light, and hang cameras where trails cross them.`);
    else if (relief >= 90) out.push(`${cover} with ${len(relief)} of relief: deer bed on points and just below ridgelines; cameras go on the benches and draws between.`);
    else out.push(`Flat ground (${len(relief)} of relief): movement follows cover edges, fencelines and drainages rather than terrain.`);
  }

  if (osm) {
    if (osm.cover.farmland >= 0.3) out.push('Lots of cropland: inside field corners and the first cover off a field are the best camera sites.');
    if (osm.cover.wetland >= 0.08) out.push('Wetland in the sector: the edges hold bedded deer and draw ducks; a camera on a dry crossing between wet ground works well.');
    if (osm.cover.developed >= 0.4) out.push('Mostly developed within 6 mi: look to greenbelts, creek corridors and any permitted suburban hunts.');
    const streams = osm.km.stream;
    if (streams >= 5) out.push(`${dist(streams)} of streams within 6 mi: creek crossings make natural camera funnels.`);
    else if (dry && streams < 2) out.push('Little surface water: any stock tank, seep or spring will be a hub. Put a camera on it.');
    if (osm.springs > 0) out.push(`${osm.springs} mapped spring${osm.springs === 1 ? '' : 's'} nearby: worth checking for tracks in dry spells.`);
    if (osm.km.trail >= 15) out.push(`${dist(osm.km.trail)} of trails within 6 mi: expect foot traffic, so get past the first mile from trailheads.`);
  }

  const PRIORITY = [/national forest/i, /bureau of land|blm/i, /wildlife management|wildlife area|game land|hunting/i, /national grassland|state forest/i, /trust/i];
  const big = PRIORITY.map((re) => land?.find((u) => re.test(`${u.name} ${u.type} ${u.manager}`))).find(Boolean);
  if (big) out.push(`${big.name} is within 6 mi: check its access, camera rules and hunting regulations before you go.`);

  if (wx) {
    const w = wx.current;
    if (w.windSpeed < 5) out.push('Calm air: scent pools and sinks downhill in the evening, so stay above where you expect animals.');
    else {
      const from = compass8(w.windDir);
      const to = compass8(w.windDir + 180);
      out.push(`Wind from the ${from} at ${speed(w.windSpeed)}: approach from the ${to}.`);
    }
    if (w.windGusts >= 40) out.push('Gusty: animals bed tight in leeward cover. Check the sheltered side of ridges.');
    if (wx.pressure6hAgo != null) {
      const d = w.pressure - wx.pressure6hAgo;
      if (d < -1) out.push('Pressure falling ahead of a front: expect movement.');
      else if (d > 1) out.push('Pressure rising behind a front: the first clear, cold morning after it is prime.');
      else out.push('Steady pressure: animals should keep to their usual pattern.');
    }
    const t = w.temperature;
    if (t <= 0) out.push('Below freezing: midday movement to food and sunny south-facing slopes picks up.');
    else if (t >= 27) out.push('Hot: movement squeezes into the last half hour of light and toward water.');
    const wet = wx.hourly.slice(0, 6).reduce((s, h) => s + h.precip, 0);
    if (wet >= 0.5) out.push('Rain in the next few hours: deer often move just after it stops.');
  }

  const moon = moonPhase();
  if (moon.illumination > 0.85) out.push('Near full moon: more night feeding, so midday sits can pay off.');
  else if (moon.illumination < 0.15) out.push('Dark moon: dawn and dusk movement is usually strongest.');

  return out.slice(0, 8);
}
