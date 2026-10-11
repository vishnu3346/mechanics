import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { UnitTag, SelectionOutlineRing } from './Labels'
import { getPalette } from './palette'

interface HeatExchangerUnitProps {
  recoveredHeatKw: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  theme?: 'light' | 'dark'
  onSelectComponent?: (comp: string) => void
  selected?: boolean
}

export function HeatExchangerUnit({
  recoveredHeatKw,
  running,
  paused,
  reducedMotion,
  theme = 'dark',
  onSelectComponent,
  selected,
}: HeatExchangerUnitProps) {
  const hotRef = useRef<THREE.Group>(null)
  const coldRef = useRef<THREE.Group>(null)
  const supplyArrowRef = useRef<THREE.Group>(null)
  const returnArrowRef = useRef<THREE.Group>(null)
  const p = getPalette(theme)

  const effectiveHeat = Math.max(100, recoveredHeatKw || 863.1)
  const flowSpeed = Math.min(2.8, Math.max(0.4, (effectiveHeat / 863) * 1.2))

  useFrame((_, delta) => {
    if (!running || paused || reducedMotion) return

    // Hot steam condensing stream (inflow from left, towards right)
    if (hotRef.current) {
      hotRef.current.children.forEach((pt) => {
        pt.position.x += delta * flowSpeed
        if (pt.position.x > 1.25) pt.position.x = -1.25
      })
    }

    // Cold district water stream (counter-current, right to left)
    if (coldRef.current) {
      coldRef.current.children.forEach((pt) => {
        pt.position.x -= delta * flowSpeed * 1.1
        if (pt.position.x < -1.25) pt.position.x = 1.25
      })
    }

    // Direction arrow cycling
    if (supplyArrowRef.current) {
      supplyArrowRef.current.children.forEach((ar) => {
        ar.position.z += delta * flowSpeed * 0.8
        if (ar.position.z > 2.0) ar.position.z = 0.5
      })
    }
    if (returnArrowRef.current) {
      returnArrowRef.current.children.forEach((ar) => {
        ar.position.z -= delta * flowSpeed * 0.8
        if (ar.position.z < 0.5) ar.position.z = 2.0
      })
    }
  })

  return (
    <group position={[14.4, 0, 0]} onClick={(e) => { e.stopPropagation(); onSelectComponent?.('heat_exchanger'); }}>
      {/* Selection highlight outline */}
      {selected && <SelectionOutlineRing radius={1.8} color="#34d399" />}

      {/* ── 1. Structural Concrete Pedestal & Support Cradles ─────── */}
      {[-0.8, 0.8].map((sx, idx) => (
        <group key={`saddle-hx-${idx}`} position={[sx, 0.45, 0]}>
          <mesh>
            <boxGeometry args={[0.22, 0.9, 1.3]} />
            <meshStandardMaterial color={p.surroundings.plinths} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <boxGeometry args={[0.3, 0.05, 1.45]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* ── 2. Shell-and-Tube Condenser Vessel Shell (Light Steel) ── */}
      {/* Cylindrical Condenser Shell */}
      <mesh position={[0, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.68, 0.68, 2.5, 24]} />
        <meshStandardMaterial color={p.equipment.hexShell} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Rear Dished Channel Head (Steam Exhaust Inflow End) */}
      <mesh position={[-1.25, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <sphereGeometry args={[0.68, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={p.equipment.hexDishedHeads} metalness={0.75} roughness={0.25} />
      </mesh>

      {/* Front Channel Bonnet with Cutaway Revealing Tube Sheet */}
      <mesh position={[1.3, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.74, 0.74, 0.12, 24]} />
        <meshStandardMaterial color={p.equipment.hexAccents} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Visible Tube Sheet & Tubes Pattern */}
      <group position={[1.31, 1.45, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <circleGeometry args={[0.66, 24]} />
          <meshStandardMaterial color={p.equipment.hexTubeSheet} metalness={0.85} roughness={0.15} />
        </mesh>
        {[-0.4, -0.2, 0, 0.2, 0.4].map((tx, row) =>
          [-0.4, -0.2, 0, 0.2, 0.4].map((ty, col) => {
            if (tx * tx + ty * ty > 0.35) return null
            return (
              <mesh key={`tube-${row}-${col}`} position={[tx, ty, 0.01]}>
                <ringGeometry args={[0.02, 0.038, 12]} />
                <meshBasicMaterial color={p.equipment.hexAccents} />
              </mesh>
            )
          })
        )}
      </group>

      {/* ── 3. Internal Thermal Flow Paths ─────────────────────── */}
      {/* Hot Condensing Steam Stream */}
      <group ref={hotRef}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`hot-${i}`} position={[i * 0.3 - 1.05, 1.55, i % 2 === 0 ? 0.22 : -0.22]}>
            <sphereGeometry args={[0.045, 6, 6]} />
            <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>

      {/* Cold District Water Inflow Stream */}
      <group ref={coldRef}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`cold-${i}`} position={[i * 0.3 - 1.05, 1.35, i % 2 === 0 ? 0.32 : -0.32]}>
            <sphereGeometry args={[0.045, 6, 6]} />
            <meshStandardMaterial color={p.pipes.districtReturn} emissive={p.pipes.districtReturn} emissiveIntensity={0.7} />
          </mesh>
        ))}
      </group>

      {/* ── 4. District Network Supply & Return Piping ─────────── */}
      {/* Hot District Supply Pipe (Blue delivery to district heating) */}
      <group position={[0.6, 1.0, 0]}>
        <mesh position={[0, -0.4, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.8, 12]} />
          <meshStandardMaterial color={p.pipes.districtSupply} metalness={0.7} roughness={0.3} />
        </mesh>
        <group ref={supplyArrowRef} position={[0, -0.4, 0]}>
          {[0.8, 1.6].map((az, idx) => (
            <mesh key={`s-arrow-${idx}`} position={[0, 0, az]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.12, 0.18, 8]} />
              <meshStandardMaterial color={p.pipes.districtSupply} emissive={p.pipes.districtSupply} emissiveIntensity={0.8} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Cold District Return Pipe (Cyan return inflow) */}
      <group position={[-0.6, 1.0, 0]}>
        <mesh position={[0, -0.4, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.8, 12]} />
          <meshStandardMaterial color={p.pipes.districtReturn} metalness={0.7} roughness={0.3} />
        </mesh>
        <group ref={returnArrowRef} position={[0, -0.4, 0]}>
          {[1.6, 0.8].map((az, idx) => (
            <mesh key={`r-arrow-${idx}`} position={[0, 0, az]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.12, 0.18, 8]} />
              <meshStandardMaterial color={p.pipes.districtReturn} emissive={p.pipes.districtReturn} emissiveIntensity={0.8} />
            </mesh>
          ))}
        </group>
      </group>

      {/* ── 5. Decluttered Unit Tag (Clean Scene, Details on Click) ── */}
      <UnitTag
        position={[0, 3.8, 0]}
        targetPosition={[0, 2.0, 0]}
        unitNumber={5}
        name="Heat Exchanger"
        headline={`${effectiveHeat.toFixed(1)} kWth`}
        accentColor="#34d399"
        selected={selected}
        onClick={() => onSelectComponent?.('heat_exchanger')}
      />
    </group>
  )
}
