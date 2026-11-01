import { getJSON, r4 } from './http';
import type { LatLng } from '../geo';

// USGS Protected Areas Database (PAD-US), "Public Access" layer on ArcGIS Online.
// Public domain (USGS). https://www.usgs.gov/programs/gap-analysis-project/science/pad-us-data-overview

const LAYER = 'https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/PADUS_Public_Access/FeatureServer/0/query';

export type PublicUnit = { name: string; manager: string; type: string; access: string; acres: number };

const ACCESS: Record<string, string> = { OA: 'Open access', RA: 'Restricted access', XA: 'Closed', UK: 'Access unknown' };

export async function getPublicLand(c: LatLng, radiusKm = 10): Promise<PublicUnit[]> {
  const url =
    `${LAYER}?geometry=${r4(c.lng)},${r4(c.lat)}&geometryType=esriGeometryPoint&inSR=4326` +
    `&distance=${radiusKm * 1000}&units=esriSRUnit_Meter&spatialRel=esriSpatialRelIntersects` +
    `&where=${encodeURIComponent("Pub_Access IN ('OA','RA')")}` +
    '&outFields=Unit_Nm,MngNm_Desc,DesTp_Desc,Pub_Access,GIS_Acres&orderByFields=GIS_Acres%20DESC' +
    '&returnGeometry=false&resultRecordCount=40&f=json';
  const raw = await getJSON<{ features?: { attributes: Record<string, string | number> }[]; error?: unknown }>(url, { timeoutMs: 12000 });
  if (!raw.features) throw new Error('padus');
  const seen = new Set<string>();
  const out: PublicUnit[] = [];
  for (const f of raw.features) {
    const a = f.attributes;
    const name = String(a.Unit_Nm ?? '').trim();
    if (!name || /^unknown/i.test(name) || seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      manager: String(a.MngNm_Desc ?? ''),
      type: String(a.DesTp_Desc ?? ''),
      access: ACCESS[String(a.Pub_Access)] ?? '',
      acres: Number(a.GIS_Acres) || 0,
    });
  }
  return out.slice(0, 8);
}
