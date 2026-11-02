import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { anchors, reducedMotion } from '../store';
import { live } from './rig';
import { ext, mirrorHalf, oct, scalePts, shape, cylZ, type P2 } from './shapes';
import { cellWrap, chipTop, fresnelBump, glowSprite, passives, pcbParts, pcbTextures, PCB } from './textures';

// Units are centimeters. The camera is 10 × 16 × 6.5 cm, centered on the origin,
// lens looking down +z. The door/body seam sits at z ≈ 0.9.

// ---------------------------------------------------------------------------
// Key outlines, measured off camera-reference.png (67.5 px per cm).
// ---------------------------------------------------------------------------
const OUTLINE = oct(10, 16, 1.55);
const inset = (d: number) => oct(10 - 2 * d, 16 - 2 * d, 1.55 - d * 0.41);
const IR_WINDOW = mirrorHalf([
  [0.55, 5.85], [0.82, 6.3], [3.45, 6.3], [4.05, 5.7], [4.05, 3.7], [3.1, 2.8], [1.35, 2.8], [0.78, 3.45], [0, 3.1],
]);
const HOOD = mirrorHalf([[0.55, 3.95], [1.25, 3.1], [2.15, 1.6], [2.05, -0.45], [1.25, -1.3]]);
const LENS_C: P2 = [0, 0.6];
const PIR_C: P2 = [0, -2.83];
const LIGHT_C: P2 = [0, -5.52];
const PIR_INNER = oct(3.2, 1.85, 0.18, ...PIR_C);
const LIGHT_INNER = oct(2.72, 0.9, 0.15, ...LIGHT_C);
const TAB = [[-0.78, 7.45], [0.78, 7.45], [0.78, 6.3], [0.55, 5.85], [-0.55, 5.85], [-0.78, 6.3]] as P2[];
const SIDE_PANEL = [[2.3, 2.25], [3.95, 2.95], [3.95, -5.4], [3.15, -6.65], [2.45, -6.65], [2.45, -1.3], [2.3, -0.7]] as P2[];
const LOCK_TAB = [[4.9, 1.9], [5.75, 1.6], [6.3, 1.05], [6.3, 0.05], [5.75, -0.45], [4.9, -0.6]] as P2[];
const LOCK_SLOT = [[5.45, 0.2], [6.0, 0.2], [6.0, 0.6], [5.45, 0.6]] as P2[];

const HINGE_X = -5.72;
const SEAM_Z = 0.91;
const HINGES = [3.8, -3.8];
const LATCHES = [3.8, -3.8];

export const LED_POSITIONS: P2[] = (() => {
  const half: P2[] = [];
  for (const [y, xs] of [[5.75, [3.2, 2.45, 1.7]], [5.05, [3.2, 2.45, 1.7]], [4.35, [2.45, 1.7]], [3.65, [2.45, 1.7]]] as [number, number[]][]) {
    for (const x of xs) half.push([x, y]);
  }
  return [...half, ...half.map(([x, y]) => [-x, y] as P2), [0.42, 5.05], [-0.42, 5.05], [0.42, 4.3], [-0.42, 4.3]];
})();

// ---------------------------------------------------------------------------
// Materials: each part gets its own instances so it can ghost independently.
// ---------------------------------------------------------------------------
function useCamoMaps() {
  const base = useTexture('/textures/camo.png');
  return useMemo(() => {
    const make = (rx: number, ry: number) => {
      const t = base.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.needsUpdate = true;
      return t;
    };
    return { flat: make(1 / 15, 1 / 15), round: make(0.24, 0.2) };
  }, [base]);
}

function makeMats(maps: ReturnType<typeof useCamoMaps>) {
  const camo = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.9, roughness: 0.78, color: '#e9e6e0' });
  return {
    camo: camo(maps.flat),
    camoRound: camo(maps.round),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#07080a', roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04,
      transparent: true, opacity: 0.9, envMapIntensity: 1.8,
    }),
    black: new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.45 }),
    matte: new THREE.MeshStandardMaterial({ color: '#0e0e0f', roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c9c9c6', metalness: 1, roughness: 0.25 }),
    brass: new THREE.MeshStandardMaterial({ color: '#b98d44', metalness: 1, roughness: 0.32 }),
    gold: new THREE.MeshStandardMaterial({ color: '#d7a64e', metalness: 1, roughness: 0.28 }),
    board: new THREE.MeshStandardMaterial({ color: '#173a2a', roughness: 0.55 }),
    darkBoard: new THREE.MeshStandardMaterial({ color: '#1b231f', roughness: 0.5 }),
    white: new THREE.MeshStandardMaterial({ color: '#f0ede4', roughness: 0.45 }),
    gasket: new THREE.MeshStandardMaterial({ color: '#e5641c', roughness: 0.5 }),
  };
}

// Ghosting: fade every material in a part to the given opacity.
function useGhost(ref: RefObject<THREE.Object3D | null>, get: () => number) {
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const op = get();
    if (g.userData.op !== undefined && Math.abs(g.userData.op - op) < 0.002) return;
    g.userData.op = op;
    if (!g.userData.mats) {
      const set = new Set<THREE.Material>();
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || o.userData.noGhost) return;
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => set.add(mm));
      });
      set.forEach((m) => {
        m.userData.baseOp ??= m.opacity;
        m.userData.baseT ??= m.transparent;
      });
      g.userData.mats = [...set];
    }
    for (const m of g.userData.mats as THREE.Material[]) {
      m.opacity = m.userData.baseOp * op;
      const transparent = m.userData.baseT || op < 0.995;
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true; // three bakes OPAQUE into the shader
      }
      m.depthWrite = op > 0.6;
    }
    g.visible = op > 0.01;
  });
}

/** Effects live on layer 1 so the contact-shadow camera (layer 0) ignores them. */
export const FX_LAYER = 1;
const fxLayer = (o: THREE.Object3D) => o.layers.set(FX_LAYER);

export function Anchor({ id, position }: { id: string; position: [number, number, number] }) {
  const ref = useRef<THREE.Object3D>(null);
  useEffect(() => {
    const o = ref.current!;
    anchors.set(id, o);
    return () => {
      if (anchors.get(id) === o) anchors.delete(id);
    };
  }, [id]);
  return <object3D ref={ref} position={position} />;
}

// ---------------------------------------------------------------------------
// Rear housing: shell, hinge halves, latches, lock tab, strap channels, tripod socket
// ---------------------------------------------------------------------------
function Body() {
  const ref = useRef<THREE.Group>(null);
  const maps = useCamoMaps();
  const m = useMemo(() => makeMats(maps), [maps]);
  const geo = useMemo(() => ({
    back: ext(shape(OUTLINE), -3.25, -2.6, 0.32, 3),
    walls: ext(shape(OUTLINE, [inset(0.35)]), -2.9, 0.85, 0.05),
    lip: ext(shape(oct(10.24, 16.24, 1.62), [oct(9.7, 15.7, 1.4)]), 0.25, 0.85, 0.08),
    lock: ext(shape(LOCK_TAB, [LOCK_SLOT]), 0.22, 0.6, 0.06),
    tripodHole: cylZ(0.3, 0.32),
    tripod: cylZ(0.52, 0.18),
  }), []);
  const latchBail = useRef<THREE.Group[]>([]);

  useGhost(ref, () => live.bodyOp);
  useFrame(() => {
    latchBail.current.forEach((g) => g && (g.rotation.y = live.latch * 1.25));
  });

  return (
    <group ref={ref}>
      <mesh geometry={geo.back} material={m.camo} />
      <mesh geometry={geo.walls} material={m.camo} />
      <mesh geometry={geo.lip} material={m.camo} />
      <mesh geometry={geo.lock} material={m.camo} />

      {HINGES.map((yc) => (
        <group key={yc}>
          <mesh position={[-5.3, yc, 0.42]} material={m.camo}>
            <boxGeometry args={[0.7, 3.4, 0.95]} />
          </mesh>
          {[0, 2, 4].map((i) => (
            <mesh key={i} position={[HINGE_X, yc - 1.36 + i * 0.68, SEAM_Z]} material={m.camoRound}>
              <cylinderGeometry args={[0.5, 0.5, 0.62, 28]} />
            </mesh>
          ))}
          <mesh position={[HINGE_X, yc, SEAM_Z]} material={m.metal}>
            <cylinderGeometry args={[0.12, 0.12, 3.62, 16]} />
          </mesh>
          {[1, -1].map((s) => (
            <mesh key={s} position={[HINGE_X, yc + s * 1.82, SEAM_Z]} material={m.metal}>
              <cylinderGeometry args={[0.2, 0.2, 0.05, 16]} />
            </mesh>
          ))}
        </group>
      ))}

      {LATCHES.map((yc, i) => (
        <group key={yc}>
          <mesh position={[5.2, yc, -0.3]} material={m.camo}>
            <boxGeometry args={[0.55, 3.0, 0.9]} />
          </mesh>
          <group ref={(g) => { if (g) latchBail.current[i] = g; }} position={[5.62, yc, -0.3]}>
            {[1.22, -1.22].map((y) => (
              <mesh key={y} material={m.metal} position={[0.16, y, 0.93]} rotation={[0, Math.atan2(0.32, 1.86), 0]}>
                <boxGeometry args={[0.1, 0.1, 1.9]} />
              </mesh>
            ))}
            <mesh position={[0.32, 0, 1.86]} material={m.metal}>
              <cylinderGeometry args={[0.07, 0.07, 2.55, 10]} />
            </mesh>
            <mesh position={[0.32, 0, 1.86]} material={m.camoRound}>
              <cylinderGeometry args={[0.55, 0.55, 2.2, 28]} />
            </mesh>
            {[1, -1].map((s) => (
              <mesh key={s} position={[0.32, s * 1.12, 1.86]} material={m.black}>
                <cylinderGeometry args={[0.58, 0.58, 0.08, 28]} />
              </mesh>
            ))}
          </group>
        </group>
      ))}

      {/* strap channels */}
      {[3.6, -3.6].map((yc) => (
        <group key={yc}>
          {[-4.2, 4.2].map((x) => (
            <mesh key={x} position={[x, yc, -3.45]} material={m.camo}>
              <boxGeometry args={[0.9, 1.5, 0.5]} />
            </mesh>
          ))}
          <mesh position={[0, yc, -3.82]} material={m.camo}>
            <boxGeometry args={[9.2, 1.5, 0.3]} />
          </mesh>
        </group>
      ))}
      {/* ¼"-20 tripod socket */}
      <mesh position={[0, -6.2, -3.32]} material={m.brass} geometry={geo.tripod} />
      <mesh position={[0, -6.2, -3.33]} material={m.matte} geometry={geo.tripodHole} />

      <Anchor id="hinge" position={[HINGE_X - 0.3, 3.8, SEAM_Z]} />
      <Anchor id="latch" position={[6.1, -3.8, 1.2]} />
      <Anchor id="housing" position={[-5.0, -6.2, -1.2]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Front door: the whole front face, swinging on the left hinge pins.
// ---------------------------------------------------------------------------
function Door() {
  const pivot = useRef<THREE.Group>(null);
  const ref = useRef<THREE.Group>(null);
  const maps = useCamoMaps();
  const m = useMemo(() => makeMats(maps), [maps]);
  const geo = useMemo(() => {
    const lensHole = { c: LENS_C, r: 1.24 };
    return {
      plate: ext(shape(OUTLINE, [IR_WINDOW, lensHole, PIR_INNER, LIGHT_INNER]), 2.78, 3.25, 0.18, 2),
      walls: ext(shape(OUTLINE, [inset(0.35)]), 0.97, 2.9, 0.05),
      rim: ext(shape(OUTLINE, [inset(0.62)]), 3.15, 3.52, 0.12, 2),
      rimStep: ext(shape(inset(0.62), [inset(0.95)]), 3.15, 3.34, 0.06),
      tab: ext(shape(TAB), 3.15, 3.55, 0.1, 1),
      irFrame: ext(shape(scalePts(IR_WINDOW, 1.07, 1.13, 0, 4.55), [IR_WINDOW]), 3.15, 3.42, 0.08, 1),
      hood: ext(shape(HOOD, [{ c: LENS_C, r: 1.3 }]), 3.15, 4.0, 0.34, 1),
      lensRing: ext(shape({ c: LENS_C, r: 1.66 }, [{ c: LENS_C, r: 1.24 }]), 3.85, 4.22, 0.1, 2),
      panelR: ext(shape(SIDE_PANEL), 3.15, 3.38, 0.07, 1),
      panelL: ext(shape(SIDE_PANEL.map(([x, y]) => [-x, y] as P2).reverse()), 3.15, 3.38, 0.07, 1),
      pirFrame: ext(shape(oct(4.3, 2.65, 0.55, ...PIR_C), [PIR_INNER]), 3.15, 3.72, 0.13, 1),
      lightFrame: ext(shape(oct(4.0, 1.55, 0.45, ...LIGHT_C), [LIGHT_INNER]), 3.15, 3.55, 0.11, 1),
      irGlass: ext(shape(IR_WINDOW), 2.86, 2.96),
      pirGlass: ext(shape(PIR_INNER), 2.98, 3.06),
      lightGlass: ext(shape(LIGHT_INNER), 2.98, 3.06),
      lock: ext(shape(LOCK_TAB, [LOCK_SLOT]), 1.2, 1.58, 0.06),
    };
  }, []);

  useGhost(ref, () => live.doorOp);
  useFrame(() => {
    if (pivot.current) pivot.current.rotation.y = -THREE.MathUtils.degToRad(live.door);
  });

  return (
    <group ref={pivot} position={[HINGE_X, 0, SEAM_Z]}>
      <group ref={ref} position={[-HINGE_X, 0, -SEAM_Z]}>
        <mesh geometry={geo.plate} material={m.camo} />
        <mesh geometry={geo.walls} material={m.camo} />
        <mesh geometry={geo.rim} material={m.camo} />
        <mesh geometry={geo.rimStep} material={m.camo} />
        <mesh geometry={geo.tab} material={m.camo} />
        <mesh geometry={geo.irFrame} material={m.camo} />
        <mesh geometry={geo.hood} material={m.camo} />
        <mesh geometry={geo.lensRing} material={m.camo} />
        <mesh geometry={geo.panelR} material={m.camo} />
        <mesh geometry={geo.panelL} material={m.camo} />
        <mesh geometry={geo.pirFrame} material={m.camo} />
        <mesh geometry={geo.lightFrame} material={m.camo} />
        <mesh geometry={geo.lock} material={m.camo} />
        <mesh geometry={geo.irGlass} material={m.glass} />
        <mesh geometry={geo.pirGlass} material={m.glass} />
        <mesh geometry={geo.lightGlass} material={m.glass} />

        {HINGES.map((yc) => (
          <group key={yc}>
            <mesh position={[-5.3, yc, 1.42]} material={m.camo}>
              <boxGeometry args={[0.7, 3.4, 0.95]} />
            </mesh>
            {[1, 3].map((i) => (
              <mesh key={i} position={[HINGE_X, yc - 1.36 + i * 0.68, SEAM_Z]} material={m.black}>
                <cylinderGeometry args={[0.48, 0.48, 0.66, 28]} />
              </mesh>
            ))}
          </group>
        ))}
        {LATCHES.map((yc) => (
          <mesh key={yc} position={[5.15, yc, 1.75]} material={m.camo}>
            <boxGeometry args={[0.4, 2.6, 0.7]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Gasket() {
  const ref = useRef<THREE.Group>(null);
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e5641c', roughness: 0.5 }), []);
  const geo = useMemo(() => ext(shape(inset(0.02), [inset(0.3)]), 0.84, 0.98, 0.04), []);
  useGhost(ref, () => live.gasketOp);
  return (
    <group ref={ref}>
      <mesh geometry={geo} material={m} />
      <Anchor id="gasket" position={[2.4, 7.95, 0.95]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Optics
// ---------------------------------------------------------------------------
function Lens() {
  const ref = useRef<THREE.Group>(null);
  const maps = useCamoMaps();
  const m = useMemo(() => {
    const base = makeMats(maps);
    return {
      ...base,
      lensGlass: new THREE.MeshPhysicalMaterial({
        color: '#05070b', roughness: 0.02, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02,
        iridescence: 0.5, iridescenceIOR: 1.5, envMapIntensity: 2.4,
      }),
      highlight: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }),
    };
  }, [maps]);
  const geo = useMemo(() => {
    const cap = new THREE.SphereGeometry(0.9, 40, 16, 0, Math.PI * 2, 0, 0.72);
    cap.rotateX(Math.PI / 2);
    return {
      barrel: cylZ(0.98, 1.45),
      front: cylZ(1.2, 0.75),
      step1: cylZ(1.02, 0.12),
      step2: cylZ(0.84, 0.1),
      seat: cylZ(0.82, 0.02),
      cap,
      thread: new THREE.TorusGeometry(0.99, 0.035, 8, 40),
    };
  }, []);
  useGhost(ref, () => live.lensOp);
  useFrame(() => ref.current && (ref.current.position.z = live.lensZ));

  return (
    <group ref={ref}>
      <group position={[LENS_C[0], LENS_C[1], 0]}>
        <mesh geometry={geo.barrel} material={m.black} position={[0, 0, 2.32]} />
        {[1.8, 2.0, 2.2, 2.4, 2.6, 2.8].map((z) => (
          <mesh key={z} geometry={geo.thread} material={m.black} position={[0, 0, z]} />
        ))}
        <mesh geometry={geo.front} material={m.matte} position={[0, 0, 3.4]} />
        <mesh geometry={geo.step1} material={m.black} position={[0, 0, 3.83]} />
        <mesh geometry={geo.step2} material={m.matte} position={[0, 0, 3.92]} />
        <mesh geometry={geo.seat} material={m.matte} position={[0, 0, 3.97]} />
        <mesh geometry={geo.cap} material={m.lensGlass} position={[0, 0, 3.1]} />
        <mesh material={m.highlight} position={[-0.26, 0.28, 4.01]}>
          <circleGeometry args={[0.09, 20]} />
        </mesh>
        <mesh material={m.highlight} position={[0.24, -0.2, 4.0]}>
          <circleGeometry args={[0.03, 12]} />
        </mesh>
        <Anchor id="lens" position={[0.95, 0.4, 3.95]} />
      </group>
    </group>
  );
}

function Sensor() {
  const ref = useRef<THREE.Group>(null);
  const maps = useCamoMaps();
  const m = useMemo(() => ({
    ...makeMats(maps),
    ceramic: new THREE.MeshStandardMaterial({ color: '#d9d0bd', roughness: 0.6 }),
    die: new THREE.MeshPhysicalMaterial({ color: '#2a1d42', metalness: 0.7, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.8 }),
    filter: new THREE.MeshPhysicalMaterial({
      color: '#86d7e8', metalness: 0.4, roughness: 0.05, transparent: true, opacity: 0.6, iridescence: 1, iridescenceIOR: 2,
    }),
  }), [maps]);
  const holder = useMemo(() => ext(shape(oct(2.5, 2.5, 0.3), [{ c: [0, 0], r: 0.98 }]), 0.62, 1.6, 0.06), []);
  useGhost(ref, () => live.sensorOp);
  useFrame(() => ref.current && (ref.current.position.z = live.sensorZ));
  return (
    <group ref={ref}>
      <group position={[LENS_C[0], LENS_C[1], 0]}>
        <mesh material={m.darkBoard} position={[0, 0, 0.55]}>
          <boxGeometry args={[3.0, 3.0, 0.14]} />
        </mesh>
        <mesh material={m.ceramic} position={[0, 0, 0.69]}>
          <boxGeometry args={[1.5, 1.3, 0.14]} />
        </mesh>
        <mesh material={m.die} position={[0, 0, 0.77]}>
          <boxGeometry args={[0.95, 0.72, 0.02]} />
        </mesh>
        <mesh geometry={holder} material={m.black} />
        <mesh material={m.filter} position={[0, 0, 1.68]}>
          <boxGeometry args={[1.2, 1.2, 0.05]} />
        </mesh>
        <Anchor id="sensor" position={[1.3, -1.2, 0.7]} />
        <Anchor id="irCut" position={[-0.55, 0.5, 1.7]} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Night vision: IR board, 24 LEDs, glow and a faint light cone
// ---------------------------------------------------------------------------
const coneShader = {
  vertexShader: /* glsl */ `
    varying float vZ; varying vec3 vN; varying vec3 vV;
    void main() {
      vZ = position.z;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uOp; uniform float uLen; uniform vec3 uColor;
    varying float vZ; varying vec3 vN; varying vec3 vV;
    void main() {
      float t = clamp(vZ / uLen, 0.0, 1.0);
      float facing = abs(dot(normalize(vN), normalize(vV)));
      float a = pow(1.0 - t, 1.6) * smoothstep(0.0, 0.08, t) * facing * 0.22;
      gl_FragColor = vec4(uColor, a * uOp);
    }`,
};

function IRBoard() {
  const ref = useRef<THREE.Group>(null);
  const maps = useCamoMaps();
  const m = useMemo(() => ({
    ...makeMats(maps),
    led: new THREE.MeshPhysicalMaterial({ color: '#2a1414', roughness: 0.12, clearcoat: 1, emissive: '#b00a04', emissiveIntensity: 0 }),
    ledBase: new THREE.MeshStandardMaterial({ color: '#3a3836', roughness: 0.4 }),
  }), [maps]);
  const glowMat = useMemo(() => new THREE.PointsMaterial({
    map: glowSprite(), color: '#c8100a', size: 1.3, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
  }), []);
  const cone = useMemo(() => {
    const len = 26;
    const g = new THREE.ConeGeometry(10, len, 48, 1, true);
    g.translate(0, -len / 2, 0);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      ...coneShader,
      uniforms: { uOp: { value: 0 }, uLen: { value: len }, uColor: { value: new THREE.Color('#9c1008') } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    return { g, mat };
  }, []);
  const geo = useMemo(() => {
    const pts = new THREE.BufferGeometry();
    pts.setAttribute('position', new THREE.Float32BufferAttribute(LED_POSITIONS.flatMap(([x, y]) => [x, y, 2.72]), 3));
    const dome = new THREE.SphereGeometry(0.22, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.rotateX(Math.PI / 2);
    return {
      board: ext(shape(scalePts(IR_WINDOW, 0.97, 0.95, 0, 4.55)), 2.2, 2.32, 0.02),
      pts,
      dome,
      base: cylZ(0.27, 0.1, 20),
    };
  }, []);

  useGhost(ref, () => live.irOp);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.z = live.irZ;
    m.led.emissiveIntensity = live.glow * 1.6;
    glowMat.opacity = live.glow * 0.7;
    cone.mat.uniforms.uOp.value = live.glow;
  });

  return (
    <group ref={ref}>
      <mesh geometry={geo.board} material={m.darkBoard} />
      {LED_POSITIONS.map(([x, y], i) => (
        <group key={i} position={[x, y, 0]}>
          <mesh geometry={geo.base} material={m.ledBase} position={[0, 0, 2.37]} />
          <mesh geometry={geo.dome} material={m.led} position={[0, 0, 2.42]} />
        </group>
      ))}
      <points geometry={geo.pts} material={glowMat} userData={{ noGhost: true }} onUpdate={fxLayer} />
      <mesh geometry={cone.g} material={cone.mat} position={[0, 4.55, 2.75]} userData={{ noGhost: true }} onUpdate={fxLayer} />
      <Anchor id="leds" position={[-3.2, 5.75, 2.7]} />
      <Anchor id="range" position={[3.6, 4.6, 9]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Trigger: PIR can, Fresnel plate, light sensor and detection fans
// ---------------------------------------------------------------------------
const fanShader = {
  vertexShader: /* glsl */ `
    varying vec2 vP;
    void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uOp; uniform float uTime; uniform float uR; uniform vec3 uColor;
    uniform float uA0; uniform float uA1;
    varying vec2 vP;
    void main() {
      float r = length(vP) / uR;
      float ang = atan(vP.y, vP.x);
      float edge = min(abs(ang - uA0), abs(ang - uA1));
      float x = fract(r * 4.0 - uTime * 0.5);
      float ring = smoothstep(0.0, 0.04, x) * (1.0 - smoothstep(0.04, 0.16, x));
      float a = (1.0 - r) * 0.34 + ring * 0.55 * (1.0 - r) + (1.0 - smoothstep(0.0, 0.012, edge)) * 0.6 * (1.0 - r);
      gl_FragColor = vec4(uColor, a * uOp);
    }`,
};

function PIR() {
  const ref = useRef<THREE.Group>(null);
  const maps = useCamoMaps();
  const bump = useMemo(() => fresnelBump(), []);
  const m = useMemo(() => ({
    ...makeMats(maps),
    fresnel: new THREE.MeshPhysicalMaterial({
      color: '#eeece4', roughness: 0.42, transparent: true, opacity: 0.92, bumpMap: bump, bumpScale: 4, clearcoat: 0.3,
    }),
    window: new THREE.MeshStandardMaterial({ color: '#3a2e3e', roughness: 0.2, metalness: 0.3 }),
    ldr: new THREE.MeshStandardMaterial({ color: '#7a3c1c', roughness: 0.4 }),
  }), [maps, bump]);
  const fans = useMemo(() => {
    const R = 24;
    return [-42, 0, 42].map((deg, i) => {
      const a0 = THREE.MathUtils.degToRad(90 + deg - 18), a1 = THREE.MathUtils.degToRad(90 + deg + 18);
      const g = new THREE.RingGeometry(0.4, R, 48, 4, a0, a1 - a0);
      const mat = new THREE.ShaderMaterial({
        ...fanShader,
        uniforms: {
          uOp: { value: 0 }, uTime: { value: 0 }, uR: { value: R }, uColor: { value: new THREE.Color('#e8901d') },
          uA0: { value: a0 }, uA1: { value: a1 },
        },
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      return { g, mat, tilt: [-0.1, 0.02, -0.1][i], delay: [0.25, 0, 0.25][i] };
    });
  }, []);
  const fanRefs = useRef<THREE.Mesh[]>([]);
  const geo = useMemo(() => ({ can: cylZ(0.48, 0.45), flange: cylZ(0.54, 0.06), ldr: cylZ(0.24, 0.18) }), []);

  useGhost(ref, () => live.pirOp);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.z = live.pirZ;
    fans.forEach((f, i) => {
      const s = THREE.MathUtils.clamp((live.fans - f.delay) / (1 - f.delay), 0, 1);
      const mesh = fanRefs.current[i];
      if (mesh) {
        mesh.scale.setScalar(Math.max(0.001, s));
        mesh.visible = s > 0.002;
      }
      f.mat.uniforms.uOp.value = s;
      f.mat.uniforms.uTime.value = reducedMotion ? 0.3 : clock.elapsedTime;
    });
  });

  return (
    <group ref={ref}>
      <group position={[PIR_C[0], PIR_C[1], 0]}>
        <mesh material={m.darkBoard} position={[0, 0, 1.5]}>
          <boxGeometry args={[3.2, 2.0, 0.12]} />
        </mesh>
        <mesh material={m.metal} position={[0, 0, 1.78]} geometry={geo.can} />
        <mesh material={m.metal} position={[0, 0, 1.6]} geometry={geo.flange} />
        <mesh material={m.window} position={[0, 0, 2.01]}>
          <boxGeometry args={[0.44, 0.34, 0.02]} />
        </mesh>
        <mesh material={m.fresnel} position={[0, 0, 2.66]}>
          <boxGeometry args={[3.1, 1.75, 0.08]} />
        </mesh>
        {/* light sensor behind the small lower window */}
        <group position={[0, LIGHT_C[1] - PIR_C[1], 0]}>
          <mesh material={m.darkBoard} position={[0, 0, 2.2]}>
            <boxGeometry args={[2.4, 0.8, 0.1]} />
          </mesh>
          <mesh material={m.ldr} position={[0, 0, 2.35]} geometry={geo.ldr} />
        </group>
        {fans.map((f, i) => (
          <mesh
            key={i}
            ref={(el) => { if (el) { fanRefs.current[i] = el; fxLayer(el); } }}
            geometry={f.g}
            material={f.mat}
            position={[0, 0, 2.75]}
            rotation={[Math.PI / 2 + f.tilt, 0, 0]}
            userData={{ noGhost: true }}
          />
        ))}
        <Anchor id="fresnel" position={[1.4, 0.75, 2.7]} />
        <Anchor id="pirCan" position={[-0.35, 0.2, 2.0]} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Main PCB with animated signal pulses
// ---------------------------------------------------------------------------
const pcbUniforms = { uTime: { value: 0 }, uPulse: { value: 0 } };

function MainBoard() {
  const ref = useRef<THREE.Group>(null);
  const sdRef = useRef<THREE.Group>(null);
  const maps = useCamoMaps();
  const lidSrc = useTexture('/brand/chip-lid.png');
  const m = useMemo(() => {
    const base = makeMats(maps);
    const { color, signal } = pcbTextures();
    const face = new THREE.MeshStandardMaterial({ map: color, roughness: 0.5, metalness: 0.1 });
    face.onBeforeCompile = (sh) => {
      sh.uniforms.uSignal = { value: signal };
      sh.uniforms.uTime = pcbUniforms.uTime;
      sh.uniforms.uPulse = pcbUniforms.uPulse;
      sh.fragmentShader = 'uniform sampler2D uSignal;\nuniform float uTime;\nuniform float uPulse;\n' +
        sh.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          vec4 sg = texture2D(uSignal, vMapUv);
          if (sg.g > 0.02) {
            float ph = sg.r / sg.g;
            float off = sg.b / sg.g;
            float x = fract(ph * 1.5 + off - uTime * 0.42);
            float head = smoothstep(0.0, 0.025, x) * (1.0 - smoothstep(0.025, 0.2, x));
            totalEmissiveRadiance += vec3(1.0, 0.5, 0.08) * sg.g * (head * 3.0 + 0.1) * uPulse;
          }`,
        );
    };
    const lid = lidSrc.clone();
    lid.colorSpace = THREE.SRGBColorSpace;
    lid.offset.set(0.09, 0.09);
    lid.repeat.set(0.82, 0.82);
    lid.anisotropy = 8;
    lid.needsUpdate = true;
    const lidMat = new THREE.MeshStandardMaterial({ map: lid, metalness: 0.35, roughness: 0.45 });
    const lidSide = new THREE.MeshStandardMaterial({ color: '#b9b6ae', metalness: 0.6, roughness: 0.4 });
    const top = (lines: string[]) => new THREE.MeshStandardMaterial({ map: chipTop(lines), roughness: 0.45 });
    return {
      ...base, face, lidMat, lidSide,
      ram: top(['RL-D4', '4Gb']),
      emmc: top(['eMMC', '32GB']),
      mcu: top(['RLW', 'M0+']),
      pmic: top(['RLP1', '12V']),
      ind: top(['4R7']),
      sdCard: new THREE.MeshStandardMaterial({ map: chipTop(['micro', 'SD'], false), roughness: 0.4 }),
      cap: new THREE.MeshStandardMaterial({ color: '#2b3442', metalness: 0.6, roughness: 0.35 }),
      capTop: new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 1, roughness: 0.3 }),
      mlcc: new THREE.MeshStandardMaterial({ color: '#b48a5c', roughness: 0.5 }),
      res: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.5 }),
    };
  }, [maps, lidSrc]);

  const capGeo = useMemo(() => ({ body: cylZ(0.3, 0.7), top: cylZ(0.28, 0.02) }), []);
  const z0 = -0.7; // board front plane
  const P = pcbParts;
  const chip = (id: keyof typeof pcbParts, h: number, top: THREE.Material, side: THREE.Material = m.black) => {
    const p = P[id];
    return (
      <mesh position={[p.x, p.y, z0 + h / 2]} material={[side, side, side, side, top, side]}>
        <boxGeometry args={[p.w, p.h, h]} />
      </mesh>
    );
  };

  const passiveMeshes = useMemo(() => {
    const mk = (kind: 0 | 1, mat: THREE.Material) => {
      const list = passives.filter((p) => p.kind === kind);
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.1, 0.08), mat, list.length);
      const o = new THREE.Object3D();
      list.forEach((p, i) => {
        o.position.set(p.x, p.y, z0 + 0.04);
        o.rotation.set(0, 0, p.rot);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      });
      return mesh;
    };
    return [mk(0, m.mlcc), mk(1, m.res)];
  }, [m]);

  useGhost(ref, () => live.pcbOp);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.z = live.pcbZ;
    pcbUniforms.uPulse.value = live.pulse;
    pcbUniforms.uTime.value = reducedMotion ? 0.35 : clock.elapsedTime;
    if (sdRef.current) sdRef.current.position.x = live.sd * 1.7;
  });

  return (
    <group ref={ref}>
      <mesh material={m.board} position={[0, 0, z0 - 0.08]}>
        <boxGeometry args={[PCB.w, PCB.h, 0.16]} />
      </mesh>
      <mesh material={m.face} position={[0, 0, z0 + 0.001]}>
        <planeGeometry args={[PCB.w, PCB.h]} />
      </mesh>

      {chip('isp', 0.24, m.lidMat, m.lidSide)}
      {chip('ram', 0.12, m.ram)}
      {chip('emmc', 0.14, m.emmc)}
      {chip('mcu', 0.1, m.mcu)}
      {chip('pmic', 0.1, m.pmic)}
      {chip('ind', 0.5, m.ind, m.matte)}

      {(['capA', 'capB'] as const).map((id) => (
        <group key={id} position={[P[id].x, P[id].y, z0]}>
          <mesh material={m.cap} position={[0, 0, 0.35]} geometry={capGeo.body} />
          <mesh material={m.capTop} position={[0, 0, 0.71]} geometry={capGeo.top} />
        </group>
      ))}

      {(['connTop', 'connPir', 'connBatt'] as const).map((id) => (
        <group key={id} position={[P[id].x, P[id].y, z0]}>
          <mesh material={m.white} position={[0, 0, 0.22]}>
            <boxGeometry args={[P[id].w, P[id].h, 0.44]} />
          </mesh>
          {Array.from({ length: Math.round(P[id].w / 0.25) - 1 }, (_, i) => (
            <mesh key={i} material={m.matte} position={[-P[id].w / 2 + 0.25 * (i + 1), 0, 0.45]}>
              <boxGeometry args={[0.13, 0.22, 0.02]} />
            </mesh>
          ))}
        </group>
      ))}

      {passiveMeshes.map((mesh, i) => <primitive key={i} object={mesh} />)}

      {/* microSD slot and card */}
      <group position={[P.sd.x, P.sd.y, z0]}>
        <mesh material={m.metal} position={[0, 0, 0.12]}>
          <boxGeometry args={[P.sd.w, P.sd.h, 0.04]} />
        </mesh>
        <group ref={sdRef}>
          <mesh material={[m.black, m.black, m.black, m.black, m.sdCard, m.black]} position={[0.3, 0, 0.07]}>
            <boxGeometry args={[1.5, 1.1, 0.07]} />
          </mesh>
          <Anchor id="sd" position={[1.0, 0, 0.12]} />
        </group>
      </group>

      <Anchor id="isp" position={[P.isp.x - 0.7, P.isp.y + 0.6, z0 + 0.25]} />
      <Anchor id="mcu" position={[P.mcu.x, P.mcu.y, z0 + 0.1]} />
      <Anchor id="pmic" position={[P.pmic.x, P.pmic.y, z0 + 0.1]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Power: tray of 8 AA cells and the DC / solar input
// ---------------------------------------------------------------------------
function Battery() {
  const ref = useRef<THREE.Group>(null);
  const maps = useCamoMaps();
  const wrap = useMemo(() => cellWrap(), []);
  const m = useMemo(() => ({
    ...makeMats(maps),
    cell: new THREE.MeshStandardMaterial({ map: wrap, roughness: 0.35, metalness: 0.2 }),
    tray: new THREE.MeshStandardMaterial({ color: '#232323', roughness: 0.7 }),
  }), [maps, wrap]);
  const geo = useMemo(() => ({
    // open towards the back so the cells show when the tray slides out
    walls: ext(shape(oct(7.4, 11.4, 0.6), [oct(7.0, 11.0, 0.45)]), -2.78, -1.3, 0.04),
    base: ext(shape(oct(7.4, 11.4, 0.6)), -1.4, -1.22, 0.03),
    cell: new THREE.CylinderGeometry(0.7, 0.7, 4.9, 32),
    nub: new THREE.CylinderGeometry(0.25, 0.25, 0.14, 16),
    plug: new THREE.CylinderGeometry(0.42, 0.42, 0.6, 24),
  }), []);
  useGhost(ref, () => live.battOp);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.z = live.battZ;
    ref.current.position.y = live.battY;
  });
  const xs = [-2.4, -0.8, 0.8, 2.4];
  return (
    <group ref={ref}>
      <mesh geometry={geo.base} material={m.tray} />
      <mesh geometry={geo.walls} material={m.tray} />
      <mesh material={m.tray} position={[0, 0, -2.0]}>
        <boxGeometry args={[7.0, 0.22, 1.4]} />
      </mesh>
      {xs.flatMap((x, i) => [2.7, -2.7].map((y, j) => {
        const flip = (i + j) % 2 ? Math.PI : 0;
        return (
          <group key={`${i}-${j}`} position={[x, y, -1.98]} rotation={[0, 0, flip]}>
            <mesh geometry={geo.cell} material={m.cell} rotation={[0, Math.PI / 2, 0]} />
            <mesh geometry={geo.nub} material={m.metal} position={[0, 2.52, 0]} />
          </group>
        );
      }))}
      {/* DC / solar input plug on the tray foot */}
      <mesh geometry={geo.plug} material={m.black} position={[2.6, -5.95, -2.0]} />
      <mesh material={m.metal} position={[2.6, -6.27, -2.0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.06, 16]} />
      </mesh>
      <Anchor id="cells" position={[-2.4, 2.7, -2.7]} />
      <Anchor id="standby" position={[2.4, -1.4, -2.7]} />
      <Anchor id="dc" position={[2.6, -6.3, -2.0]} />
    </group>
  );
}

export function CameraModel() {
  return (
    <group>
      <Body />
      <Gasket />
      <Door />
      <Lens />
      <Sensor />
      <IRBoard />
      <PIR />
      <MainBoard />
      <Battery />
    </group>
  );
}
