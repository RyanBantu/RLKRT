import { useEffect, useMemo, useRef, type PointerEvent, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { EARTH_KM } from '../geo';
import { facing, makeBorderGeometries, makeGraticule, makeLandTexture, PALETTE, toVec3 } from './mapData';

export type GlobeTarget = { lat: number; lng: number; key: string };
export type BirdPoint = { lat: number; lng: number; game: boolean };
export type Relief = { canvas: HTMLCanvasElement; halfKm: number; key: string };

type Props = {
  target: GlobeTarget | null;
  birds: BirdPoint[];
  relief: Relief | null;
  reducedMotion: boolean;
  active: boolean;
  /** Bumped by the parent to recenter on the target after a drag. */
  recenter: number;
  onLocked?: () => void;
};

const AMBER = '#e8901d';
const INK = '#2a2925';
const SECTOR_KM = 40.23; // 25 miles
const FOV = 30;
const IDLE_DIST = 4.3;
const LOCK_ALT = 0.07; // camera height above the surface, in Earth radii (~480 km)
const US = { lat: 39, lng: -97 };

// Shared mutable view state (kept out of React so drags and animation don't re-render).
type View = { yaw: number; pitch: number; dist: number; dragYaw: number; dragPitch: number; spin: boolean };

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Local tangent frame at lat/lng: +Z out of the ground, +Y north, +X east. */
function tangentFrame(lat: number, lng: number, r: number) {
  const n = toVec3(lat, lng, 1);
  const east = new THREE.Vector3(0, 1, 0).cross(n).normalize();
  const north = n.clone().cross(east).normalize();
  const m = new THREE.Matrix4().makeBasis(east, north, n);
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  return { position: n.clone().multiplyScalar(r), quaternion: q };
}

function Earth() {
  const gl = useThree((s) => s.gl);
  const tex = useMemo(() => makeLandTexture(gl.capabilities.maxTextureSize), [gl]);
  const borders = useMemo(makeBorderGeometries, []);
  const graticule = useMemo(() => makeGraticule(10), []);
  useEffect(() => () => {
    tex.dispose();
    Object.values(borders).forEach((g) => g.dispose());
    graticule.dispose();
  }, [tex, borders, graticule]);
  return (
    <>
      <mesh>
        <sphereGeometry args={[1, 128, 96]} />
        <meshLambertMaterial map={tex} />
      </mesh>
      <lineSegments geometry={graticule}>
        <lineBasicMaterial color={PALETTE.graticule} transparent opacity={0.45} />
      </lineSegments>
      <lineSegments geometry={borders.coast}>
        <lineBasicMaterial color={PALETTE.coast} transparent opacity={0.7} />
      </lineSegments>
      <lineSegments geometry={borders.countries}>
        <lineBasicMaterial color={PALETTE.country} transparent opacity={0.9} />
      </lineSegments>
      <lineSegments geometry={borders.states}>
        <lineBasicMaterial color={PALETTE.state} />
      </lineSegments>
    </>
  );
}

const atmosphereShader = {
  uniforms: { color: { value: new THREE.Color('#e4d6bb') } },
  vertexShader: /* glsl */ `
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    varying vec3 vN;
    varying vec3 vV;
    void main() {
      float rim = 1.0 - abs(dot(vN, vV));
      float a = pow(smoothstep(0.0, 1.0, rim), 2.6) * 0.5;
      gl_FragColor = vec4(color, a);
    }`,
};

function Atmosphere() {
  return (
    <mesh scale={1.07}>
      <sphereGeometry args={[1, 64, 48]} />
      <shaderMaterial args={[atmosphereShader]} transparent depthWrite={false} side={THREE.BackSide} />
    </mesh>
  );
}

function Sector({ target, reducedMotion }: { target: GlobeTarget; reducedMotion: boolean }) {
  const frame = useMemo(() => tangentFrame(target.lat, target.lng, 1.0006), [target]);
  const r = SECTOR_KM / EARTH_KM;
  const hex = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      pts.push([Math.cos(a) * r, Math.sin(a) * r, 0]);
    }
    return pts;
  }, [r]);
  const fill = useMemo(() => {
    const s = new THREE.Shape(hex.map(([x, y]) => new THREE.Vector2(x, y)));
    return new THREE.ShapeGeometry(s);
  }, [hex]);
  const ring = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= 64; k++) pts.push([Math.cos((k / 64) * Math.PI * 2), Math.sin((k / 64) * Math.PI * 2), 0]);
    return pts;
  }, []);
  const tick = useMemo(() => {
    // Short crosshair ticks outside the hex.
    const t: [number, number, number][][] = [];
    for (let k = 0; k < 4; k++) {
      const a = (Math.PI / 2) * k;
      t.push([[Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08, 0], [Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, 0]]);
    }
    return t;
  }, [r]);
  const pulse = useRef<THREE.Group>(null);
  const pulseMat = useRef<THREE.Material & { opacity: number }>(null);
  const born = useRef(performance.now());
  useEffect(() => { born.current = performance.now(); }, [target]);

  useFrame(() => {
    if (!pulse.current) return;
    const t = (performance.now() - born.current) / 1000;
    if (reducedMotion) {
      pulse.current.scale.setScalar(r * 1.15);
      if (pulseMat.current) pulseMat.current.opacity = 0.5;
      return;
    }
    const p = (t % 2.2) / 2.2;
    pulse.current.scale.setScalar(r * (0.95 + p * 0.75));
    if (pulseMat.current) pulseMat.current.opacity = (1 - p) * 0.9;
  });

  return (
    <group position={frame.position} quaternion={frame.quaternion}>
      <mesh geometry={fill} renderOrder={2}>
        <meshBasicMaterial color={AMBER} transparent opacity={0.13} depthWrite={false} />
      </mesh>
      <Line points={hex} color={AMBER} lineWidth={2.2} renderOrder={3} />
      {tick.map((p, i) => <Line key={i} points={p} color={INK} lineWidth={1.4} renderOrder={3} />)}
      <group ref={pulse}>
        <Line points={ring} color={AMBER} lineWidth={1.6} transparent ref={(l) => { if (l) pulseMat.current = l.material as never; }} renderOrder={3} />
      </group>
      <mesh renderOrder={4}>
        <circleGeometry args={[r * 0.05, 24]} />
        <meshBasicMaterial color={AMBER} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ReliefPatch({ relief, target }: { relief: Relief; target: GlobeTarget }) {
  const frame = useMemo(() => tangentFrame(target.lat, target.lng, 1.0003), [target]);
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(relief.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [relief]);
  useEffect(() => () => tex.dispose(), [tex]);
  const s = (relief.halfKm * 2) / EARTH_KM;
  return (
    <group position={frame.position} quaternion={frame.quaternion}>
      <mesh renderOrder={1}>
        <planeGeometry args={[s, s]} />
        <meshBasicMaterial map={tex} transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </group>
  );
}

const dotShader = {
  uniforms: { size: { value: 6 } },
  vertexShader: /* glsl */ `
    attribute float game;
    uniform float size;
    varying float vGame;
    void main() {
      vGame = game;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (1.0 + game * 0.35);
    }`,
  fragmentShader: /* glsl */ `
    varying float vGame;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      vec3 ink = vec3(0.17, 0.2, 0.15);
      vec3 amber = vec3(0.91, 0.565, 0.114);
      vec3 c = mix(ink, amber, vGame);
      c = mix(c, vec3(0.97, 0.95, 0.92), smoothstep(0.32, 0.4, d));
      gl_FragColor = vec4(c, 0.95);
    }`,
};

function Birds({ birds }: { birds: BirdPoint[] }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(birds.length * 3);
    const game = new Float32Array(birds.length);
    const v = new THREE.Vector3();
    birds.forEach((b, i) => {
      toVec3(b.lat, b.lng, 1.0009, v).toArray(pos, i * 3);
      game[i] = b.game ? 1 : 0;
    });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('game', new THREE.BufferAttribute(game, 1));
    return g;
  }, [birds]);
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({ ...dotShader, uniforms: { size: { value: 6 * dpr } }, transparent: true, depthWrite: false });
    return m;
  }, [dpr]);
  useEffect(() => () => geo.dispose(), [geo]);
  if (!birds.length) return null;
  return <points geometry={geo} material={mat} renderOrder={5} />;
}

/** Drives globe rotation and camera distance: idle spin, fly-to, drag, recenter. */
function Rig({ view, target, reducedMotion, recenter, onLocked, children }: {
  view: View; target: GlobeTarget | null; reducedMotion: boolean; recenter: number; onLocked?: () => void; children: ReactNode;
}) {
  const globe = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const fly = useRef<{ from: View; to: { yaw: number; pitch: number; dist: number }; t: number; dur: number; done: boolean } | null>(null);
  const onLockedRef = useRef(onLocked);
  onLockedRef.current = onLocked;

  // Idle framing: the globe sits right of the intro card on wide screens, above it on narrow ones.
  const idle = useMemo(() => {
    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height);
    if (w < 1000) {
      const f = Math.min(0.58, (0.86 * w) / h);
      return { dist: 1 / (f * Math.tan((FOV * Math.PI) / 360)), sx: 0, sy: 0.5 - (f / 2 + 0.05) };
    }
    const f = Math.min(0.86, (0.56 * w) / h);
    return { dist: 1 / (f * Math.tan((FOV * Math.PI) / 360)), sx: 0.16, sy: 0 };
  }, [size]);
  const shift = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!target) {
      view.dist = idle.dist;
      shift.current = { x: idle.sx, y: idle.sy };
    }
  }, [idle, target, view]);

  useEffect(() => {
    if (!target) {
      view.spin = !reducedMotion;
      fly.current = null;
      return;
    }
    view.spin = false;
    const f = facing(target.lat, target.lng);
    // Fold the current yaw (including any drag) and take the short way round.
    const curYaw = view.yaw + view.dragYaw;
    const curPitch = view.pitch + view.dragPitch;
    let yaw = f.yaw;
    while (yaw - curYaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw - curYaw < -Math.PI) yaw += Math.PI * 2;
    view.yaw = curYaw;
    view.pitch = curPitch;
    view.dragYaw = 0;
    view.dragPitch = 0;
    const to = { yaw, pitch: f.pitch, dist: 1 + LOCK_ALT };
    if (reducedMotion) {
      Object.assign(view, to);
      fly.current = null;
      onLockedRef.current?.();
    } else {
      fly.current = { from: { ...view }, to, t: 0, dur: 2.6, done: false };
    }
  }, [target, reducedMotion, view]);

  useEffect(() => {
    if (!recenter) return;
    view.dragYaw = 0;
    view.dragPitch = 0;
  }, [recenter, view]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const f = fly.current;
    if (view.spin) view.yaw += dt * 0.05;
    if (f && !f.done) {
      f.t = Math.min(1, f.t + dt / f.dur);
      const rT = ease(clamp01(f.t / 0.75));
      const zT = ease(clamp01((f.t - 0.2) / 0.8));
      view.yaw = f.from.yaw + (f.to.yaw - f.from.yaw) * rT;
      view.pitch = f.from.pitch + (f.to.pitch - f.from.pitch) * rT;
      view.dist = Math.exp(Math.log(f.from.dist) + (Math.log(f.to.dist) - Math.log(f.from.dist)) * zT);
      if (f.t >= 1) {
        f.done = true;
        onLockedRef.current?.();
      }
    }
    if (globe.current) {
      const pitch = Math.max(-1.45, Math.min(1.45, view.pitch + view.dragPitch));
      globe.current.rotation.set(pitch, view.yaw + view.dragYaw, 0);
    }
    // Ease the idle offset away once a sector is targeted.
    const s = shift.current;
    const goal = target ? { x: 0, y: 0 } : { x: idle.sx, y: idle.sy };
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 3);
    s.x += (goal.x - s.x) * k;
    s.y += (goal.y - s.y) * k;
    camera.setViewOffset(size.width, size.height, -s.x * size.width, s.y * size.height, size.width, size.height);
    camera.position.set(0, 0, view.dist);
    camera.near = Math.max(0.0005, (view.dist - 1) * 0.2);
    camera.far = view.dist + 2;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  });

  return <group ref={globe}>{children}</group>;
}

export default function Globe(p: Props) {
  const view = useRef<View>({ ...facing(US.lat, US.lng), dist: IDLE_DIST, dragYaw: 0, dragPitch: 0, spin: !p.reducedMotion });
  const last = useRef<{ x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const onDown = (e: PointerEvent) => {
    last.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    view.current.spin = false;
  };
  const onMove = (e: PointerEvent) => {
    if (!last.current || !wrap.current) return;
    const v = view.current;
    // Radians of globe per screen pixel at the current zoom.
    const visible = 2 * (v.dist - 1) * Math.tan((FOV * Math.PI) / 360);
    const k = Math.min(visible, 2.2) / wrap.current.clientHeight;
    v.dragYaw += (e.clientX - last.current.x) * k;
    v.dragPitch += (e.clientY - last.current.y) * k;
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => {
    last.current = null;
    if (!p.target && !p.reducedMotion) view.current.spin = true;
  };

  return (
    <div
      ref={wrap}
      className="nl-globe-canvas"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <Canvas
        frameloop={p.active ? 'always' : 'never'}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: FOV, position: [0, 0, IDLE_DIST], near: 0.01, far: 10 }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <ambientLight intensity={2.1} />
        <directionalLight position={[-3, 2.5, 4]} intensity={0.9} />
        <Rig view={view.current} target={p.target} reducedMotion={p.reducedMotion} recenter={p.recenter} onLocked={p.onLocked}>
          <Earth />
          {p.target && p.relief && <ReliefPatch relief={p.relief} target={p.target} />}
          {p.target && <Sector target={p.target} reducedMotion={p.reducedMotion} />}
          <Birds birds={p.birds} />
        </Rig>
        <Atmosphere />
      </Canvas>
    </div>
  );
}

