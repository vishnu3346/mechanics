import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { UnitLabel } from './Labels'

interface CycloneAndStackProps {
  running: boolean
  paused: boolean
  reducedMotion: boolean
  onSelectComponent?: (comp: string) => void
}

export function CycloneAndStack({
  running,
  paused,
  reducedMotion,
  onSelectComponent,
}: CycloneAndStackProps) {
  const plumeRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!running || paused || reducedMotion) return
    if (plumeRef.current) {
      plumeRef.current.children.forEach((p) => {
        p.position.y += delta * 0.8
        if (p.position.y > 1.8) {
          p.position.y = 0
          p.position.x = (Math.random() - 0.5) * 0.2
        }
        const mat = (p as any).material as THREE.MeshStandardMaterial
        mat.opacity = Math.max(0, 0.35 - p.position.y * 0.18)
      })
    }
  })

  return (
    <group>
      {/* ── 1. Cyclone Separator (Schematic on Syngas Line) ─────── */}
      <group position={[0.5, 2.4, -0.6]} onClick={(e) => { e.stopPropagation(); onSelectComponent?.('gasifier'); }}>
        {/* Upper Cylindrical Barrel */}
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.9, 20]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Barrel top cover plate */}
        <mesh position={[0, 1.32, 0]}>
          <cylinderGeometry args={[0.58, 0.58, 0.06, 20]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Tangential Inlet Duct from Gasifier */}
        <mesh position={[-0.45, 0.95, 0.28]} rotation={[0, -Math.PI / 6, 0]}>
          <boxGeometry args={[0.65, 0.35, 0.28]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Lower Inverted Conical Body */}
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.55, 0.15, 1.0, 20]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Dipleg & Dust Lock Hopper at bottom */}
        <mesh position={[0, -0.75, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.35, 14]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.25} />
        </mesh>
        {/* Double flap slide gate valve */}
        <mesh position={[0, -0.98, 0]}>
          <boxGeometry args={[0.26, 0.14, 0.26]} />
          <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Fly-ash collection bin */}
        <mesh position={[0, -1.22, 0]}>
          <cylinderGeometry args={[0.24, 0.24, 0.35, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Top Vortex Finder Exit Pipe */}
        <mesh position={[0, 1.6, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.6, 16]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Structural Steel Saddle / Frame */}
        <mesh position={[0, 0.4, 0]}>
          <torusGeometry args={[0.58, 0.04, 8, 20]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>
        {[-0.45, 0.45].map((sx, i) => (
          <mesh key={i} position={[sx, -0.5, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.8, 8]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}

        {/* Cyclone Label (Marked Schematic) */}
        <UnitLabel
          position={[0, 3.1, 0]}
          targetPosition={[0, 1.6, 0]}
          title="CYCLONE SEPARATOR"
          subtitle="Particulate fly-ash separation"
          schematic
          accentColor="#0ea5e9"
          onClick={() => onSelectComponent?.('gasifier')}
        />
      </group>

      {/* ── 2. Exhaust Flue Gas Stack (Schematic Post-Boiler) ───── */}
      <group position={[6.0, 0, -3.2]}>
        {/* Concrete Foundation Pedestal */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.7, 0.8, 0.4, 20]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.15} />
        </mesh>

        {/* Main Tall Cylindrical Stack Body */}
        <mesh position={[0, 3.4, 0]}>
          <cylinderGeometry args={[0.38, 0.52, 6.0, 24]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* White/Red Aviation Warning Bands near top */}
        <mesh position={[0, 5.4, 0]}>
          <cylinderGeometry args={[0.405, 0.42, 0.6, 24]} />
          <meshStandardMaterial color="#ef4444" roughness={0.4} metalness={0.2} />
        </mesh>
        <mesh position={[0, 6.0, 0]}>
          <cylinderGeometry args={[0.395, 0.405, 0.6, 24]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} metalness={0.2} />
        </mesh>

        {/* Emissions Sampling Gallery Platform & Railings */}
        <group position={[0, 4.6, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.95, 24]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.96, 0.96, 0.7, 24, 1, true]} />
            <meshStandardMaterial color="#f59e0b" wireframe />
          </mesh>
        </group>

        {/* Access Caged Ladder on Stack Side */}
        <mesh position={[0.45, 3.0, 0]}>
          <boxGeometry args={[0.06, 5.2, 0.18]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.3} />
        </mesh>

        {/* Stack Top Discharge Ring */}
        <mesh position={[0, 6.45, 0]}>
          <torusGeometry args={[0.38, 0.03, 8, 20]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Clean Flue Gas Exhaust Plume */}
        <group ref={plumeRef} position={[0, 6.5, 0]}>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={i} position={[(Math.random() - 0.5) * 0.2, i * 0.22, (Math.random() - 0.5) * 0.2]}>
              <sphereGeometry args={[0.1 + i * 0.02, 6, 6]} />
              <meshStandardMaterial color="#cbd5e1" transparent opacity={0.25} />
            </mesh>
          ))}
        </group>

        {/* Stack Label (Marked Schematic) */}
        <UnitLabel
          position={[0, 7.3, 0]}
          targetPosition={[0, 6.5, 0]}
          title="EXHAUST STACK"
          subtitle="Continuous Emission Monitoring (CEMS)"
          schematic
          accentColor="#64748b"
        />
      </group>
    </group>
  )
}
