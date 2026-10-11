import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { UnitTag, SelectionOutlineRing } from './Labels'
import { getPalette } from './palette'

interface TurbineUnitProps {
  powerKw: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  theme?: 'light' | 'dark'
  onSelectComponent?: (comp: string) => void
  selected?: boolean
}

export function TurbineUnit({
  powerKw,
  running,
  paused,
  reducedMotion,
  theme = 'dark',
  onSelectComponent,
  selected,
}: TurbineUnitProps) {
  const rotorRef = useRef<THREE.Group>(null)
  const p = getPalette(theme)

  const effectivePower = Math.max(10, powerKw || 178.6)
  const rpm = Math.min(3000, (effectivePower / 180) * 3000)
  const rotSpeed = (rpm / 60) * Math.PI * 0.15

  useFrame((_, delta) => {
    if (!running || paused || reducedMotion) return
    if (rotorRef.current) {
      rotorRef.current.rotation.x += delta * rotSpeed
    }
  })

  return (
    <group position={[9.4, 0, 0]} onClick={(e) => { e.stopPropagation(); onSelectComponent?.('turbine'); }}>
      {/* Selection highlight outline */}
      {selected && <SelectionOutlineRing radius={1.9} color="#38bdf8" />}

      {/* ── 1. Heavy Foundation Pedestal & Anchor Sole Plates ───── */}
      <mesh position={[0.4, 0.35, 0]}>
        <boxGeometry args={[4.2, 0.7, 1.8]} />
        <meshStandardMaterial color={p.surroundings.plinths} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ── 2. Turbine High/Intermediate Pressure Casing (Silver) ─ */}
      <mesh position={[-0.85, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.75, 1.6, 24]} />
        <meshStandardMaterial color={p.equipment.turbineCasing} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Casing Flange Split-Line Bolting */}
      <mesh position={[-0.85, 1.45, 0]}>
        <boxGeometry args={[1.65, 0.08, 1.55]} />
        <meshStandardMaterial color={p.equipment.turbineCasing} metalness={0.85} roughness={0.2} />
      </mesh>

      {/* ── 3. High-Speed Rotating Shaft & Turbine Rotor Blading ── */}
      <group ref={rotorRef} position={[-0.85, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        {/* Main Central Rotor Shaft */}
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 1.8, 16]} />
          <meshStandardMaterial color={p.equipment.turbineShaft} metalness={0.9} roughness={0.15} />
        </mesh>

        {/* 3 Multistage Reaction Rotor Wheel Discs with Blades (Turbine Blue) */}
        {[-0.4, 0.0, 0.4].map((discY, dIdx) => {
          const diskRadius = 0.38 + dIdx * 0.07
          const bladeCount = 12
          return (
            <group key={`disc-${dIdx}`} position={[0, discY, 0]}>
              <mesh>
                <cylinderGeometry args={[diskRadius, diskRadius, 0.06, 20]} />
                <meshStandardMaterial color={p.equipment.turbineBlades} metalness={0.85} roughness={0.2} />
              </mesh>
              {Array.from({ length: bladeCount }).map((_, bIdx) => {
                const angle = (bIdx * Math.PI * 2) / bladeCount
                return (
                  <mesh
                    key={`blade-${bIdx}`}
                    position={[
                      Math.cos(angle) * (diskRadius + 0.05),
                      0,
                      Math.sin(angle) * (diskRadius + 0.05),
                    ]}
                    rotation={[0, angle + 0.2, 0]}
                  >
                    <boxGeometry args={[0.08, 0.03, 0.09]} />
                    <meshStandardMaterial color={p.equipment.turbineBlades} metalness={0.9} roughness={0.15} />
                  </mesh>
                )
              })}
            </group>
          )
        })}
      </group>

      {/* ── 4. Flexible Shaft Coupling Sleeve ──────────────────── */}
      <mesh position={[0.55, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.38, 16]} />
        <meshStandardMaterial color={p.equipment.turbineShaft} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ── 5. Heavy Synchronous Generator Housing (Dark Blue) ─── */}
      <mesh position={[1.45, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.68, 0.68, 1.45, 24]} />
        <meshStandardMaterial color={p.equipment.generatorCasing} metalness={0.65} roughness={0.3} />
      </mesh>

      {/* Generator Stator Cooling Ribs / Rings */}
      {[-0.45, -0.22, 0, 0.22, 0.45].map((gx, i) => (
        <mesh key={`rib-${i}`} position={[1.45 + gx, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.69, 0.025, 8, 24]} />
          <meshStandardMaterial color={p.equipment.generatorRibs} metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Generator High-Voltage Terminal & Exciter Enclosure */}
      <mesh position={[1.45, 2.22, 0]}>
        <boxGeometry args={[0.55, 0.28, 0.45]} />
        <meshStandardMaterial color={p.equipment.generatorExciter} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* ── 6. Decluttered Unit Tag (Clean Scene, Details on Click) ── */}
      <UnitTag
        position={[0.4, 3.8, 0]}
        targetPosition={[0.4, 2.2, 0]}
        unitNumber={4}
        name="Steam Turbine"
        headline={`${effectivePower.toFixed(1)} kWe`}
        accentColor="#38bdf8"
        selected={selected}
        onClick={() => onSelectComponent?.('turbine')}
      />
    </group>
  )
}
