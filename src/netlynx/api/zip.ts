import { ApiError, getJSON } from './http';

// Zippopotam.us: https://api.zippopotam.us/us/{zip} — no key, CORS-enabled, 404 for unknown ZIPs.

export type ZipPlace = {
  zip: string;
  place: string;
  state: string;
  stateCode: string;
  lat: number;
  lng: number;
};

type Raw = {
  'post code': string;
  places: { 'place name': string; state: string; 'state abbreviation': string; latitude: string; longitude: string }[];
};

export const isZip = (s: string) => /^\d{5}$/.test(s);

export async function lookupZip(zip: string): Promise<ZipPlace> {
  if (!isZip(zip)) throw new ApiError('not_found');
  const raw = await getJSON<Raw>(`https://api.zippopotam.us/us/${zip}`, { timeoutMs: 8000, statusKinds: { 404: 'not_found' } });
  const p = raw.places?.[0];
  if (!p) throw new ApiError('not_found');
  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new ApiError('bad_data');
  return { zip, place: p['place name'], state: p.state, stateCode: p['state abbreviation'], lat, lng };
}
