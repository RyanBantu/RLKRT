import { cached, getJSON, r4 } from './http';
import { offsetKm, type LatLng } from '../geo';

// Open-Meteo elevation API: https://open-meteo.com/en/docs/elevation-api
// Copernicus 90 m DEM; up to 100 coordinates per request.

export const GRID_N = 9; // GRID_N × GRID_N samples
export const GRID_HALF_KM = 12; // grid spans ±12 km around the centre
/** Wider, coarser grid that shades the whole sector on the globe. */
export const SECTOR_GRID = { n: 10, halfKm: 48 };

export type ElevationGrid = {
  center: number; // metres
  n: number;
  halfKm: number;
  /** Row-major, north row first, metres. */
  values: number[];
  points: LatLng[];
};

export function gridPoints(c: LatLng, n = GRID_N, halfKm = GRID_HALF_KM) {
  const pts: LatLng[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const dx = (i / (n - 1) - 0.5) * 2 * halfKm;
      const dy = (0.5 - j / (n - 1)) * 2 * halfKm;
      pts.push(offsetKm(c, dx, dy));
    }
  }
  return pts;
}

export function getElevationGrid(c: LatLng, n = GRID_N, halfKm = GRID_HALF_KM, withCenter = true): Promise<ElevationGrid> {
  return cached(`elev:${r4(c.lat)},${r4(c.lng)}:${n}:${halfKm}`, async () => {
    const grid = gridPoints(c, n, halfKm);
    const pts = withCenter ? [c, ...grid] : grid;
    const url =
      `https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => r4(p.lat)).join(',')}` +
      `&longitude=${pts.map((p) => r4(p.lng)).join(',')}`;
    const raw = await getJSON<{ elevation: number[] }>(url);
    if (!raw.elevation || raw.elevation.length !== pts.length) throw new Error('bad elevation');
    const off = withCenter ? 1 : 0;
    return { center: raw.elevation[0], n, halfKm, values: raw.elevation.slice(off), points: grid };
  });
}
