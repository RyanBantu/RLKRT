// Small geodesy helpers (spherical Earth, good to well under 1% at these ranges).

export const EARTH_KM = 6371;
const rad = Math.PI / 180;

export type LatLng = { lat: number; lng: number };

export function distanceKm(a: LatLng, b: LatLng) {
  const x =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(x));
}

/** Point reached by travelling `km` from `p` on initial bearing `deg` (0 = north). */
export function destination(p: LatLng, km: number, deg: number): LatLng {
  const d = km / EARTH_KM;
  const b = deg * rad;
  const la = p.lat * rad;
  const lo = p.lng * rad;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: la2 / rad, lng: ((lo2 / rad + 540) % 360) - 180 };
}

/** Offset in km east (dx) and north (dy) → lat/lng (fine for tens of km). */
export function offsetKm(p: LatLng, dx: number, dy: number): LatLng {
  return { lat: p.lat + dy / 111.32, lng: p.lng + dx / (111.32 * Math.cos(p.lat * rad)) };
}

export const MI_PER_KM = 0.621371;
export const FT_PER_M = 3.28084;

export function formatCoord({ lat, lng }: LatLng) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
}

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass16 = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
const POINTS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compass8 = (deg: number) => POINTS8[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
