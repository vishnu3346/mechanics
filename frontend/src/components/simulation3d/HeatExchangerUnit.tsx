import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { UnitLabel } from './Labels'

interface HeatExchangerUnitProps {
  recoveredHeatKw: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  onSelectComponent?: (comp: string) => void
  selected?: boolean
}

export function HeatExchangerUnit({
  recoveredHeatKw,
  running,
  paused,
  reducedMotion,
  onSelectComponent,
  selected,
}: HeatExchangerUnitProps) {
  const hotRef = useRef<THREE.Group>(null)
  const coldRef = useRef<THREE.Group>(null)
  const supplyArrowRef = useRef<THREE.Group>(null)
  const returnArrowRef = useRef<THREE.Group>(null)

  const effectiveHeat = Math.max(100, recoveredHeatKw || 863.1)
  const flowSpeed = Math.min(3.0, Math.max(0.4, (effectiveHeat / 860) * 1.0))

  useFrame((_, delta) => {
    if (!running || paused || reducedMotion) return

    // Hot steam condensation flow (moves left -> right)
    if (hotRef.current) {
      hotRef.current.children.forEach((p) => {
        p.position.x += delta * flowSpeed
        if (p.position.x > 1.1) p.position.x = -1.1
      })
    }

    // Cold district water counter-current flow (moves right -> left)
    if (coldRef.current) {
      coldRef.current.children.forEach((p) => {
        p.position.x -= delta * flowSpeed
        if (p.position.x < -1.1) p.position.x = 1.1
      })
    }

    // District supply/return flow arrows
    if (supplyArrowRef.current) {
      supplyArrowRef.current.children.forEach((a) => {
        a.position.z += delta * flowSpeed * 0.8
        if (a.position.z > 2.5) a.position.z = 0.5
      })
    }
    if (returnArrowRef.current) {
      returnArrowRef.current.children.forEach((a) => {
        a.position.z -= delta * flowSpeed * 0.8
        if (a.position.z < 0.5) a.position.z = 2.5
      })
    }
  })

  return (
    <group position={[14.4, 0, -0.2]} onClick={(e) => { e.stopPropagation(); onSelectComponent?.('heat_exchanger'); }}>
      {/* Selection highlight ring */}
      {selected && (
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.7, 1.9, 36]} />
          <meshBasicMaterial color="#34d399" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* ── 1. Structural Pedestal Stands ──────────────────────── */}
      {[-0.75, 0.75].map((px, i) => (
        <group key={`stand-${i}`} position={[px, 0.45, 0]}>
          <mesh>
            <boxGeometry args={[0.2, 0.9, 1.0]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <boxGeometry args={[0.3, 0.05, 1.15]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* ── 2. Cylindrical Condenser / Heat Exchanger Shell ─────── */}
      <mesh position={[0, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.68, 0.68, 2.5, 24]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.25} />
      </mesh>

      {/* Heavy Flanged End Channel Bonnets */}
      <mesh position={[-1.3, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.74, 0.74, 0.12, 24]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[1.3, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.74, 0.74, 0.12, 24]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Visible Tube Sheet & Tubes Pattern (Cutaway end) */}
      <group position={[1.31, 1.45, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <circleGeometry args={[0.66, 24]} />
          <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.15} />
        </mesh>
        {/* Tube Sheet Holes / Tube Ends Grid */}
        {[-0.4, -0.2, 0, 0.2, 0.4].map((tx, row) =>
          [-0.4, -0.2, 0, 0.2, 0.4].map((ty, col) => {
            if (tx * tx + ty * ty > 0.35) return null
            return (
              <mesh key={`tube-${row}-${col}`} position={[tx, ty, 0.01]}>
                <ringGeometry args={[0.02, 0.038, 12]} />
                <meshBasicMaterial color="#0284c7" />
              </mesh>
            )
          })
        )}
      </group>

      {/* ── 3. Internal Thermal Flow Paths ─────────────────────── */}
      {/* Hot Stream Particles (Condensing Steam) */}
      <group ref={hotRef}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`hot-${i}`} position={[i * 0.3 - 1.05, 1.55, i % 2 === 0 ? 0.22 : -0.22]}>
            <sphereGeometry args={[0.045, 6, 6]} />
            <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>

      {/* Cold Stream Particles (District Water Inflow) */}
      <group ref={coldRef}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`cold-${i}`} position={[i * 0.3 - 1.05, 1.35, i % 2 === 0 ? 0.32 : -0.32]}>
            <sphereGeometry args={[0.045, 6, 6]} />
            <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>

      {/* ── 4. District Network Supply & Return Piping ─────────── */}
      {/* Hot Supply Pipe (70 °C delivery, to district network towards +Z foreground) */}
      <group position={[0.6, 1.0, 0]}>
        <mesh position={[0, -0.4, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.8, 12]} />
          <meshStandardMaterial color="#ef4444" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* District supply flow direction arrows */}
        <group ref={supplyArrowRef} position={[0, -0.4, 0]}>
          {[0.8, 1.6].map((az, idx) => (
            <mesh key={`s-arrow-${idx}`} position={[0, 0, az]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.12, 0.18, 8]} />
              <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.9} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Cold Return Pipe (District return inflow from +Z towards condenser) */}
      <group position={[-0.6, 1.0, 0]}>
        <mesh position={[0, -0.4, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.8, 12]} />
          <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* District return flow direction arrows */}
        <group ref={returnArrowRef} position={[0, -0.4, 0]}>
          {[1.6, 0.8].map((az, idx) => (
            <mesh key={`r-arrow-${idx}`} position={[0, 0, az]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.12, 0.18, 8]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.9} />
            </mesh>
          ))}
        </group>
      </group>

      {/* ── 5. Unit Label with Thin Leader Line (Staggered Height) ── */}
      <UnitLabel
        position={[0, 4.0, 0]}
        targetPosition={[0, 1.8, 0]}
        title="CHP HEAT EXCHANGER"
        subtitle={`${effectiveHeat.toFixed(1)} kWth Useful District Heat (70 °C)`}
        tag="DISTRICT HEAT"
        tagColor="#34d399"
        accentColor="#34d399"
        onClick={() => onSelectComponent?.('heat_exchanger')}
      />
    </group>
  )
}
