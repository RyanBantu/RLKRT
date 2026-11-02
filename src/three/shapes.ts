import * as THREE from 'three';

export type P2 = [number, number];
export type Hole = P2[] | { c: P2; r: number };

/** Rectangle with chamfered corners (an octagon), counter-clockwise. */
export function oct(w: number, h: number, c: number, cx = 0, cy = 0): P2[] {
  const x = w / 2, y = h / 2;
  return [
    [cx - x + c, cy - y], [cx + x - c, cy - y], [cx + x, cy - y + c], [cx + x, cy + y - c],
    [cx + x - c, cy + y], [cx - x + c, cy + y], [cx - x, cy + y - c], [cx - x, cy - y + c],
  ];
}

/** Build a symmetric outline from its right half (top-center → bottom-center, clockwise). */
export function mirrorHalf(right: P2[]): P2[] {
  const left = right.slice().reverse().map(([x, y]) => [-x, y] as P2).filter(([x]) => x !== 0);
  return [...right, ...left];
}

export function scalePts(pts: P2[], sx: number, sy: number, cx = 0, cy = 0): P2[] {
  return pts.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
}

const v2 = (p: P2) => new THREE.Vector2(p[0], p[1]);

export function shape(outer: P2[] | { c: P2; r: number }, holes: Hole[] = []) {
  const s = new THREE.Shape();
  if (Array.isArray(outer)) s.setFromPoints(outer.map(v2));
  else s.absarc(outer.c[0], outer.c[1], outer.r, 0, Math.PI * 2, false);
  for (const h of holes) {
    const p = new THREE.Path();
    if (Array.isArray(h)) p.setFromPoints(h.map(v2));
    else p.absarc(h.c[0], h.c[1], h.r, 0, Math.PI * 2, true);
    s.holes.push(p);
  }
  return s;
}

// UVs in centimeters. Side walls run the texture's vertical grain along the wall height,
// so bark furrows stay upright all the way round the housing.
const uvGen = {
  generateTopUV(_g: THREE.ExtrudeGeometry, v: number[], a: number, b: number, c: number) {
    return [a, b, c].map((i) => new THREE.Vector2(v[i * 3], v[i * 3 + 1]));
  },
  generateSideWallUV(_g: THREE.ExtrudeGeometry, v: number[], a: number, b: number, c: number, d: number) {
    const horizontal = Math.abs(v[a * 3 + 1] - v[b * 3 + 1]) < Math.abs(v[a * 3] - v[b * 3]);
    return [a, b, c, d].map((i) =>
      horizontal ? new THREE.Vector2(v[i * 3], v[i * 3 + 2]) : new THREE.Vector2(v[i * 3 + 2], v[i * 3 + 1]),
    );
  },
};

/** Extrude a shape between z0 and z1 with a bevel that stays inside the outline. */
export function ext(s: THREE.Shape, z0: number, z1: number, bevel = 0, segments = 2) {
  const depth = z1 - z0;
  const b = Math.min(bevel, depth * 0.45);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.001, depth - 2 * b),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: segments,
    curveSegments: 40,
    UVGenerator: uvGen,
  });
  g.translate(0, 0, z0 + b);
  return g;
}

/** Cylinder whose axis runs along +z instead of +y. */
export function cylZ(r: number, len: number, seg = 32, open = false) {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, open);
  g.rotateX(Math.PI / 2);
  return g;
}
