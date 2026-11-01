import { getJSON, r4 } from './http';
import type { LatLng } from '../geo';

// iNaturalist API v1, observations/species_counts: https://api.inaturalist.org/v1/docs/
// Public, no key. Research-grade + needs-ID ("verifiable") mammals and birds within the radius.

export type InatCount = { count: number; name: string; commonName?: string; rank: string };

type Raw = {
  total_results: number;
  results: { count: number; taxon: { name: string; rank: string; preferred_common_name?: string } }[];
};

export const INAT_RADIUS_KM = 40;

export async function getSpeciesCounts(p: LatLng): Promise<InatCount[]> {
  const raw = await getJSON<Raw>(
    `https://api.inaturalist.org/v1/observations/species_counts?lat=${r4(p.lat)}&lng=${r4(p.lng)}` +
      `&radius=${INAT_RADIUS_KM}&iconic_taxa=Mammalia,Aves&verifiable=true&per_page=500`,
    { timeoutMs: 15000 },
  );
  return raw.results.map((r) => ({ count: r.count, name: r.taxon.name, commonName: r.taxon.preferred_common_name, rank: r.taxon.rank }));
}
