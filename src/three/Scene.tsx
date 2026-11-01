import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { CameraModel, FX_LAYER } from './CameraModel';
import { Projector, Rig } from './rig';

function Studio() {
  return (
    <>
      <ambientLight intensity={0.18} color="#fff4e6" />
      <directionalLight position={[-26, 30, 14]} intensity={3.0} color="#fff6ea" />
      <directionalLight position={[25, 8, 12]} intensity={0.6} color="#f2f4ff" />
      <directionalLight position={[-10, 12, -25]} intensity={0.5} color="#eef2ff" />
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#5d5850']} />
        <Lightformer form="rect" intensity={2.4} color="#fff3e2" position={[0, 14, 6]} scale={[30, 12, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#fff0da" position={[-16, 4, 12]} scale={[12, 20, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#ffffff" position={[16, 2, 10]} scale={[10, 20, 1]} />
        <Lightformer form="ring" intensity={1.4} color="#ffe6c4" position={[5, 3, 20]} scale={5} />
        <Lightformer form="rect" intensity={0.7} color="#f3ede2" position={[0, -6, -16]} scale={[30, 8, 1]} />
      </Environment>
    </>
  );
}

export default function Scene({ active }: { active: boolean }) {
  const model = useRef<THREE.Group>(null);
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 30, position: [0, 0, 60], near: 1, far: 500 }}
      onCreated={({ gl, camera, scene }) => {
        scene.environmentIntensity = 0.55;
        camera.layers.enable(FX_LAYER);
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.setClearColor(0x000000, 0);
      }}
    >
      <Suspense fallback={null}>
        <Studio />
        <group ref={model}>
          <CameraModel />
        </group>
        <ContactShadows position={[0, -8.05, 0]} scale={70} blur={2.4} far={14} opacity={0.55} resolution={512} color="#3b3022" />
        <Rig model={model} />
        <Projector />
      </Suspense>
    </Canvas>
  );
}
