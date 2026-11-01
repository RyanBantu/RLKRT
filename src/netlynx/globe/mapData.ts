import * as THREE from 'three';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';
import landTopo from 'world-atlas/land-50m.json';
import countriesTopo from 'world-atlas/countries-110m.json';
import statesTopo from 'us-atlas/states-10m.json';

// Map geometry for the globe, from Natural Earth (world-atlas) and the U.S. Census (us-atlas).
// Fills are painted into an equirectangular canvas texture; borders and coastlines are real
// 3D lines so they stay crisp when the camera is a few hundred km above the ground.

export const PALETTE = {
  ocean: '#cbd6d6',
  land: '#f1ebdd',
  us: '#eadbbb',
  coast: '#9c8562',
  country: '#b39c78',
  state: '#c8b391',
  graticule: '#cbb495',
};

const rad = Math.PI / 180;

/** Lat/lng → unit-sphere position, matching three's SphereGeometry UV layout. */
export function toVec3(lat: number, lng: number, r = 1, out = new THREE.Vector3()) {
  const phi = ((lng + 180) / 360) * Math.PI * 2;
  const c = Math.cos(lat * rad);
  return out.set(-Math.cos(phi) * c * r, Math.sin(lat * rad) * r, Math.sin(phi) * c * r);
}

/** Globe rotation (x = pitch, y = yaw) that brings lat/lng to face the +Z camera. */
export function facing(lat: number, lng: number) {
  const v = toVec3(0, lng);
  return { yaw: -Math.atan2(v.x, v.z), pitch: lat * rad };
}

type Topo = Topology<{ land: GeometryCollection; countries: GeometryCollection; states: GeometryCollection; nation: GeometryCollection }>;
const land = landTopo as unknown as Topo;
const countries = countriesTopo as unknown as Topo;
const states = statesTopo as unknown as Topo;

function polygons(g: Polygon | MultiPolygon): Position[][][] {
  return g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
}

function paintRings(ctx: CanvasRenderingContext2D, polys: Position[][][], W: number, H: number) {
  ctx.beginPath();
  for (const poly of polys) {
    for (const ring of poly) {
      let prev: number | null = null;
      ring.forEach(([lng, lat], i) => {
        const x = ((lng + 180) / 360) * W;
        const y = ((90 - lat) / 180) * H;
        // Don't draw a stroke across the whole map where a ring crosses the antimeridian.
        if (i === 0 || (prev !== null && Math.abs(lng - prev) > 180)) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        prev = lng;
      });
      ctx.closePath();
    }
  }
  ctx.fill('evenodd');
}

export function makeLandTexture(maxSize: number) {
  const W = Math.min(8192, maxSize);
  const H = W / 2;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = PALETTE.ocean;
  ctx.fillRect(0, 0, W, H);

  const landFc = feature(land, land.objects.land);
  ctx.fillStyle = PALETTE.land;
  for (const f of landFc.features) paintRings(ctx, polygons(f.geometry as Polygon | MultiPolygon), W, H);

  const nation = feature(states, states.objects.nation);
  ctx.fillStyle = PALETTE.us;
  for (const f of nation.features) paintRings(ctx, polygons(f.geometry as Polygon | MultiPolygon), W, H);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function linesToPositions(ml: MultiLineString, r: number) {
  const out: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (const line of ml.coordinates) {
    for (let i = 1; i < line.length; i++) {
      const [lng0, lat0] = line[i - 1];
      const [lng1, lat1] = line[i];
      if (Math.abs(lng1 - lng0) > 180) continue;
      toVec3(lat0, lng0, r, a);
      toVec3(lat1, lng1, r, b);
      out.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  return new THREE.Float32BufferAttribute(out, 3);
}

function lineGeometry(ml: MultiLineString, r: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', linesToPositions(ml, r));
  return g;
}

export function makeBorderGeometries() {
  return {
    coast: lineGeometry(mesh(land, land.objects.land), 1.0004),
    countries: lineGeometry(mesh(countries, countries.objects.countries, (a, b) => a !== b), 1.0004),
    states: lineGeometry(mesh(states, states.objects.states, (a, b) => a !== b), 1.0004),
  };
}

export function makeGraticule(step = 10) {
  const lines: Position[][] = [];
  for (let lng = -180; lng < 180; lng += step) {
    const l: Position[] = [];
    for (let lat = -80; lat <= 80; lat += 2) l.push([lng, lat]);
    lines.push(l);
  }
  for (let lat = -80; lat <= 80; lat += step) {
    const l: Position[] = [];
    for (let lng = -180; lng <= 180; lng += 2) l.push([lng, lat]);
    lines.push(l);
  }
  return lineGeometry({ type: 'MultiLineString', coordinates: lines }, 1.0002);
}
