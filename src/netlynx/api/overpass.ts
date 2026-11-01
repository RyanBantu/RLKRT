import { ApiError, cached, r4 } from './http';
import { offsetKm, type LatLng } from '../geo';

// OpenStreetMap via the Overpass API (https://wiki.openstreetmap.org/wiki/Overpass_API), ODbL.
// One batched query per sector:
//  • land cover: `is_in` at ~37 sample points across a 10 km circle (cheap, unlike fetching polygons)
//  • lengths of trails, tracks, roads and streams via `length()`
//  • counts of springs and ponds/lakes, and named protected areas
// Tags are trimmed with `convert` so the response stays small. Falls back to a second server.

export const OSM_RADIUS_KM = 10;
// Tried in order with per-server timeouts (ms); a busy server (429/502/503/504), timeout or
// network error moves on to the next. Worst case is about 2.5 minutes before the panel shows its error.
const SERVERS: [string, number][] = [
  ['https://overpass-api.de/api/interpreter', 90000],
  ['https://overpass.kumi.systems/api/interpreter', 60000],
];

export type LandCover = { forest: number; wetland: number; farmland: number; water: number; grass: number; developed: number; other: number };
export type Terrain = {
  cover: LandCover; // shares 0–1 of sample points
  samples: number;
  publicLand: { name: string; kind: string }[];
  publicShare: number; // share of sample points inside a protected area
  km: { trail: number; track: number; road: number; stream: number };
  springs: number;
  waterBodies: number;
};

function samplePoints(c: LatLng) {
  const pts: LatLng[] = [c];
  for (const [ring, n] of [[3.4, 6], [6.7, 12], [9.6, 18]] as const) {
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * (k + (n === 12 ? 0.5 : 0))) / n;
      pts.push(offsetKm(c, ring * Math.sin(a), ring * Math.cos(a)));
    }
  }
  return pts;
}

function buildQuery(c: LatLng, pts: LatLng[]) {
  const around = `(around:${OSM_RADIUS_KM * 1000},${r4(c.lat)},${r4(c.lng)})`;
  const keep = 'convert a lu=t["landuse"],nat=t["natural"],b=t["boundary"],lei=t["leisure"],pc=t["protect_class"],name=t["name"]';
  const lines = ['[out:json][timeout:85];'];
  pts.forEach((p, i) => {
    lines.push(
      `is_in(${p.lat.toFixed(5)},${p.lng.toFixed(5)})->.a;` +
        `(area.a[landuse];area.a[natural];area.a[boundary~"^(protected_area|national_park)$"];area.a[leisure=nature_reserve];)->.h;` +
        `.h ${keep};out;make pt i=${i};out;`,
    );
  });
  const len = (name: string, sel: string) => `way${around}${sel};make len name="${name}",m=sum(length());out;`;
  lines.push(len('trail', '[highway~"^(path|footway|bridleway|cycleway)$"]'));
  lines.push(len('track', '[highway=track]'));
  lines.push(len('road', '[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service)$"]'));
  lines.push(len('stream', '[waterway~"^(stream|river|brook)$"]'));
  lines.push(`node${around}[natural=spring];make cnt name="springs",n=count(nodes);out;`);
  lines.push(`(way${around}[natural=water];relation${around}[natural=water];);make cnt name="water",n=count(ways)+count(relations);out;`);
  lines.push(`(way${around}[boundary~"^(protected_area|national_park)$"][name];relation${around}[boundary~"^(protected_area|national_park)$"][name];way${around}[leisure=nature_reserve][name];relation${around}[leisure=nature_reserve][name];)->.p;.p ${keep};out;make end;out;`);
  return lines.join('\n');
}

type El = { type: string; tags?: Record<string, string> };

function classify(tags: Record<string, string>[]): keyof LandCover {
  const has = (k: 'lu' | 'nat', ...v: string[]) => tags.some((t) => v.includes(t[k]));
  if (has('nat', 'water') || has('lu', 'reservoir', 'basin')) return 'water';
  if (has('nat', 'wetland')) return 'wetland';
  if (has('lu', 'forest') || has('nat', 'wood')) return 'forest';
  if (has('lu', 'farmland', 'orchard', 'vineyard', 'farmyard', 'greenhouse_horticulture')) return 'farmland';
  if (has('lu', 'residential', 'commercial', 'industrial', 'retail', 'construction', 'railway')) return 'developed';
  if (has('lu', 'meadow', 'grass', 'recreation_ground') || has('nat', 'grassland', 'scrub', 'heath')) return 'grass';
  return 'other';
}

function parse(els: El[], samples: number): Terrain {
  const cover: LandCover = { forest: 0, wetland: 0, farmland: 0, water: 0, grass: 0, developed: 0, other: 0 };
  const km = { trail: 0, track: 0, road: 0, stream: 0 };
  let springs = 0;
  let waterBodies = 0;
  let inPublic = 0;
  const publicLand = new Map<string, string>();
  const kindOf = (t: Record<string, string>) =>
    t.b === 'national_park' ? 'National park' : t.lei === 'nature_reserve' ? 'Nature reserve' : t.pc === '6' ? 'Managed resource land' : 'Protected area';

  let buf: Record<string, string>[] = [];
  let tail = false; // after the last sample point we're reading the protected-area list
  for (const e of els) {
    const t = e.tags ?? {};
    if (e.type === 'pt') {
      cover[classify(buf)]++;
      if (buf.some((x) => x.b || x.lei === 'nature_reserve')) inPublic++;
      buf = [];
    } else if (e.type === 'len') {
      km[t.name as keyof typeof km] = Number(t.m) / 1000 || 0;
      tail = true;
    } else if (e.type === 'cnt') {
      if (t.name === 'springs') springs = Number(t.n) || 0;
      else waterBodies = Number(t.n) || 0;
    } else if (e.type === 'a') {
      if (tail) {
        if (t.name) publicLand.set(t.name, kindOf(t));
      } else buf.push(t);
    }
  }
  for (const k of Object.keys(cover) as (keyof LandCover)[]) cover[k] /= samples;
  return {
    cover,
    samples,
    publicLand: [...publicLand].map(([name, kind]) => ({ name, kind })).slice(0, 8),
    publicShare: inPublic / samples,
    km,
    springs,
    waterBodies,
  };
}

async function post(server: string, query: string, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(server, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new ApiError('http', r.status);
    const j = (await r.json()) as { elements?: El[]; remark?: string };
    if (!j.elements || !j.elements.some((e) => e.type === 'end')) throw new ApiError('bad_data');
    return j.elements;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(ctrl.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}

export function getTerrain(c: LatLng): Promise<Terrain> {
  return cached(`osm:${r4(c.lat)},${r4(c.lng)}`, async () => {
    const pts = samplePoints(c);
    const q = buildQuery(c, pts);
    let last: unknown;
    for (const [server, timeoutMs] of SERVERS) {
      try {
        return parse(await post(server, q, timeoutMs), pts.length);
      } catch (e) {
        last = e;
        // Only busy/timeout/network errors are worth another server.
        if (e instanceof ApiError && e.kind === 'http' && e.status && ![429, 502, 503, 504].includes(e.status)) throw e;
      }
    }
    throw last;
  });
}
