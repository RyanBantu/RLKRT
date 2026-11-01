import { getJSON, r4 } from './http';
import type { LatLng } from '../geo';

// eBird API 2.0 via our /api/ebird function (adds the secret key server-side).
// Docs: https://documenter.getpostman.com/view/664302/S1ENwy59

export type EbirdObs = {
  speciesCode: string;
  comName: string;
  sciName: string;
  locName: string;
  obsDt: string; // local time at the location, "YYYY-MM-DD HH:mm" or "YYYY-MM-DD"
  howMany?: number;
  lat: number;
  lng: number;
};

export const EBIRD_DIST_KM = 40;

export function getRecentBirds(p: LatLng) {
  return getJSON<EbirdObs[]>(`/api/ebird?lat=${r4(p.lat)}&lng=${r4(p.lng)}&dist=${EBIRD_DIST_KM}&back=7`, { timeoutMs: 15000 });
}
