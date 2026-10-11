import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getPalette } from './palette'

interface AirBlowerProps {
  airflowM3H: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  theme?: 'light' | 'dark'
  onSelectComponent?: (comp: string) => void
  selected?: boolean
}

export function AirBlower({
  airflowM3H,
  running,
  paused,
  reducedMotion,
  theme = 'dark',
  onSelectComponent,
  selected,
}: AirBlowerProps) {
  const impellorRef = useRef<THREE.Group>(null)
  const particlesRef = useRef<THREE.Group>(null)
  const p = getPalette(theme)

  // Speed scaled by airflow (nominal 661 Nm³/h)
  const effectiveAirflow = Math.max(100, airflowM3H || 661)
  const flowSpeed = Math.min(3.5, Math.max(0.4, (effectiveAirflow / 661) * 1.5))

  useFrame((_, delta) => {
    if (!running || paused || reducedMotion) return

    // Impellor spin
    if (impellorRef.current) {
      impellorRef.current.rotation.z += delta * flowSpeed * 10
    }

    // Air particles along the pipe to gasifier plenum
    if (particlesRef.current) {
      particlesRef.current.children.forEach((p) => {
        p.position.x += delta * flowSpeed
        if (p.position.x > 2.3) p.position.x = 0
      })
    }
  })

  return (
    <group position={[-8.4, 0.35, -2.2]} onClick={(e) => { e.stopPropagation(); onSelectComponent?.('gasifier'); }}>
      {/* Selection highlight */}
      {selected && (
        <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.1, 24]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Blower Volute / Scroll Housing */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.32, 20]} />
        <meshStandardMaterial color="#0284c7" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[0.25, 0.7, 0]}>
        <boxGeometry args={[0.45, 0.35, 0.3]} />
        <meshStandardMaterial color="#0284c7" metalness={0.65} roughness={0.3} />
      </mesh>

      {/* Internal Rotating Impellor Blades */}
      <group ref={impellorRef} position={[0, 0.45, 0.17]}>
        <mesh>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh
            key={i}
            position={[Math.cos((i * Math.PI) / 3) * 0.28, Math.sin((i * Math.PI) / 3) * 0.28, 0]}
            rotation={[0, 0, (i * Math.PI) / 3 + 0.3]}
          >
            <boxGeometry args={[0.26, 0.03, 0.02]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
          </mesh>
        ))}
      </group>

      {/* Electric Drive Motor */}
      <group position={[0, 0.45, -0.4]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.65, 16]} />
          <meshStandardMaterial color="#1e40af" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Motor Cooling Fins */}
        {[-0.2, -0.1, 0, 0.1, 0.2].map((z, idx) => (
          <mesh key={idx} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.33, 0.015, 6, 20]} />
            <meshStandardMaterial color="#1d4ed8" metalness={0.8} roughness={0.25} />
          </mesh>
        ))}
        {/* Terminal junction box */}
        <mesh position={[0.26, 0.2, 0]}>
          <boxGeometry args={[0.18, 0.18, 0.2]} />
          <meshStandardMaterial color="#3b82f6" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>

      {/* Inlet Air Filter Silencer Box */}
      <mesh position={[-0.6, 0.45, 0]}>
        <boxGeometry args={[0.42, 0.52, 0.48]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-0.82, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.1, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Structural Skid Base */}
      <mesh position={[-0.1, 0.05, -0.2]}>
        <boxGeometry args={[1.6, 0.12, 1.3]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Primary Air Discharge Pipe to Gasifier Plenum Windbox */}
      {/* Blower outlet is at X=0.45, Y=0.8, Z=0 (world X=-6.35, Y=1.15, Z=-1.8) */}
      {/* Routes along +X and +Z to gasifier air plenum flange at [-4.5, 0.35, 0] */}
      <group position={[0.45, 0.8, 0]}>
        {/* Vertical drop */}
        <mesh position={[0, -0.4, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.6, 14]} />
          <meshStandardMaterial color={p.pipes.combustionAir} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Elbow & Horizontal pipe forward */}
        <mesh position={[0.45, -0.7, 0.9]} rotation={[Math.PI / 2, Math.PI / 4, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 1.8, 14]} />
          <meshStandardMaterial color={p.pipes.combustionAir} metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Air Flow Particles */}
        <group ref={particlesRef} position={[0, -0.7, 0]}>
          {Array.from({ length: 5 }).map((_, i) => (
            <mesh key={i} position={[i * 0.45, 0, i * 0.35]}>
              <sphereGeometry args={[0.045, 6, 6]} />
              <meshStandardMaterial color={p.pipes.combustionAir} emissive={p.pipes.combustionAir} emissiveIntensity={0.8} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}
