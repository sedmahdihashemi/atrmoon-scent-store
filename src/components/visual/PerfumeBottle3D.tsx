import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows, Float } from "@react-three/drei";
import * as THREE from "three";

/**
 * Procedural amber perfume bottle — lathe body + cap + cord label.
 * Soft rotation always. Cursor parallax tilt on hover (desktop) and
 * device-orientation tilt on touch devices.
 */
function BottleMesh() {
  const group = useRef<THREE.Group>(null!);
  const { mouse, size } = useThree();
  const target = useRef({ x: 0, y: 0 });

  // Lathe profile — a soft narrow-shouldered flacon
  const bodyGeom = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    // base → shoulder → neck (in world units)
    const profile: [number, number][] = [
      [0.0, -1.20],
      [0.55, -1.20],
      [0.82, -1.15],
      [0.92, -1.00],
      [0.95, -0.60],
      [0.95, 0.10],
      [0.92, 0.50],
      [0.80, 0.78],
      [0.55, 0.92],
      [0.32, 0.98],
      [0.26, 1.05],
      [0.26, 1.18],
    ];
    for (const [r, y] of profile) pts.push(new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 96);
    g.computeVertexNormals();
    return g;
  }, []);

  const capGeom = useMemo(
    () => new THREE.CylinderGeometry(0.34, 0.34, 0.55, 64, 1, false),
    [],
  );

  useFrame((_, delta) => {
    if (!group.current) return;
    // soft continuous rotation
    group.current.rotation.y += delta * 0.35;
    // cursor parallax — easing toward mouse position
    target.current.x = mouse.y * 0.25;
    target.current.y += (mouse.x * 0.35 - target.current.y) * 0.05;
    group.current.rotation.x +=
      (target.current.x - group.current.rotation.x) * 0.05;
    group.current.position.x +=
      (mouse.x * 0.15 - group.current.position.x) * 0.04;
    group.current.position.y +=
      (-mouse.y * 0.08 - group.current.position.y) * 0.04;
  });

  return (
    <Float speed={1.2} rotationIntensity={0} floatIntensity={0.35}>
      <group ref={group} position={[0, 0, 0]}>
        {/* amber glass body */}
        <mesh geometry={bodyGeom} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#7a3a1a"
            transmission={0.92}
            thickness={1.4}
            roughness={0.08}
            metalness={0}
            ior={1.5}
            attenuationColor="#c97a3a"
            attenuationDistance={1.2}
            clearcoat={1}
            clearcoatRoughness={0.05}
          />
        </mesh>

        {/* amber liquid — slightly smaller copy */}
        <mesh geometry={bodyGeom} scale={[0.96, 0.86, 0.96]} position={[0, -0.05, 0]}>
          <meshPhysicalMaterial
            color="#b6651c"
            transmission={0.55}
            thickness={1.8}
            roughness={0.15}
            ior={1.42}
            attenuationColor="#8a3d0c"
            attenuationDistance={0.6}
          />
        </mesh>

        {/* brushed gold cap */}
        <mesh geometry={capGeom} position={[0, 1.45, 0]} castShadow>
          <meshPhysicalMaterial
            color="#c9a24a"
            metalness={1}
            roughness={0.28}
            clearcoat={0.4}
          />
        </mesh>
        {/* cap rim */}
        <mesh position={[0, 1.18, 0]}>
          <torusGeometry args={[0.34, 0.025, 16, 64]} />
          <meshStandardMaterial color="#8a6a26" metalness={1} roughness={0.4} />
        </mesh>

        {/* paper label band */}
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.96, 0.96, 0.55, 96, 1, true]} />
          <meshStandardMaterial
            color="#efe6d3"
            roughness={0.95}
            metalness={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </Float>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      {/* moonlight key */}
      <directionalLight
        position={[-3, 4, 3]}
        intensity={1.6}
        color="#e8e4d4"
        castShadow
      />
      {/* warm fill */}
      <pointLight position={[3, 1, 2]} intensity={1.1} color="#d6a86b" />
      {/* rim */}
      <pointLight position={[0, -2, -3]} intensity={0.6} color="#5fa7a3" />
    </>
  );
}

export function PerfumeBottle3D({ className }: { className?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <div className={className} aria-hidden />;
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.2, 5.2], fov: 28 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <Lights />
          <BottleMesh />
          <ContactShadows
            position={[0, -1.35, 0]}
            opacity={0.45}
            scale={6}
            blur={2.6}
            far={3}
            color="#2a1a10"
          />
          <Environment preset="sunset" />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default PerfumeBottle3D;