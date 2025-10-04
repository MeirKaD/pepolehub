'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Torus, Cylinder } from '@react-three/drei';
import * as THREE from 'three';

function MagnifyingGlass({ position, speed }: { position: [number, number, number]; speed: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    groupRef.current.rotation.z = state.clock.elapsedTime * speed * 0.3;
    groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.5;
    groupRef.current.position.x = position[0] + Math.cos(state.clock.elapsedTime * speed * 0.3) * 0.3;
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, 0, Math.PI / 4]}>
      {/* Glass lens rim - blue metallic gradient */}
      <Torus args={[0.8, 0.1, 16, 32]}>
        <meshStandardMaterial
          color="#2563eb"
          metalness={1.0}
          roughness={0.05}
          emissive="#3b82f6"
          emissiveIntensity={0.3}
        />
      </Torus>

      {/* Glass lens */}
      <mesh>
        <circleGeometry args={[0.8, 32]} />
        <meshPhysicalMaterial
          color="#60a5fa"
          transparent
          opacity={0.3}
          metalness={0.2}
          roughness={0.1}
          transmission={0.9}
          thickness={0.5}
        />
      </mesh>

      {/* Handle - blue metallic */}
      <Cylinder args={[0.08, 0.08, 1.5, 16]} position={[0, -1.55, 0]} rotation={[0, 0, 0]}>
        <meshStandardMaterial
          color="#1d4ed8"
          metalness={1.0}
          roughness={0.1}
          emissive="#2563eb"
          emissiveIntensity={0.2}
        />
      </Cylinder>
    </group>
  );
}

export function FloatingOrbs() {
  return (
    <div className="absolute inset-0 -z-10 opacity-50">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} />
        <pointLight position={[0, 0, 5]} intensity={0.8} color="#60a5fa" />

        <MagnifyingGlass position={[-4, 1, 0]} speed={0.4} />
        <MagnifyingGlass position={[4, -0.5, -2]} speed={0.6} />
        <MagnifyingGlass position={[0, -2, -1]} speed={0.5} />
      </Canvas>
    </div>
  );
}
