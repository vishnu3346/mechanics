import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { UnitLabel } from './Labels'

interface TurbineUnitProps {
  powerKw: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  onSelectComponent?: (comp: string) => void
  selected?: boolean
}

export function TurbineUnit({
  powerKw,
  running,
  paused,
  reducedMotion,
  onSelectComponent,
  selected,
}: TurbineUnitProps) {
  const rotorRef = useRef<THREE.Group>(null)

  const effectivePower = Math.max(10, powerKw || 178.6)

  useFrame((_, delta) => {
    if (!running || paused || reducedMotion) return
    if (rotorRef.current) {
      // RPM speed scaled by electrical power kW
      const spinSpeed = Math.min(25, Math.max(0.5, effectivePower * 0.05))
      rotorRef.current.rotation.x += delta * spinSpeed
    }
  })

  return (
    <group position={[9.4, 0, 0]} onClick={(e) => { e.stopPropagation(); onSelectComponent?.('turbine'); }}>
      {/* Selection highlight ring */}
      {selected && (
        <mesh position={[0.4, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.7, 1.9, 36]} />
          <meshBasicMaterial color="#60a5fa" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* ── 1. Heavy Rigid Cast Concrete Foundation Skid ───────── */}
      <mesh position={[0.4, 0.22, 0]}>
        <boxGeometry args={[3.4, 0.44, 1.7]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* ── 2. Multi-Stage Turbine Expander Casing ──────────────── */}
      {/* Lower solid base casing */}
      <mesh position={[-0.55, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.88, 1.8, 24, 1, false, Math.PI * 0.5, Math.PI]} />
        <meshStandardMaterial color="#1e40af" metalness={0.75} roughness={0.25} />
      </mesh>

      {/* Upper Inspection Cutaway / Transparent Cover */}
      <mesh position={[-0.55, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.56, 0.89, 1.78, 24, 1, false, -Math.PI * 0.5, Math.PI]} />
        <meshStandardMaterial
          color="#38bdf8"
          transparent
          opacity={0.25}
          metalness={0.2}
          roughness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* HP Steam Inlet Flange (top left) */}
      <mesh position={[-1.25, 2.1, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.4, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* ── 3. Rotating Multi-Stage Rotor & Blading Assembly ───── */}
      <group ref={rotorRef} position={[-0.55, 1.45, 0]}>
        {/* Central High-Strength Rotor Shaft */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 2.2, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* 4 Multi-Stage Blade Wheels (High Pressure to Low Pressure Expansion) */}
        {[-0.6, -0.2, 0.2, 0.6].map((x, idx) => {
          const diskRadius = 0.32 + idx * 0.12
          const bladeCount = 10 + idx * 2
          return (
            <group key={`wheel-${idx}`} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              {/* Rotor disk hub */}
              <mesh>
                <cylinderGeometry args={[diskRadius, diskRadius, 0.045, 20]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.15} />
              </mesh>

              {/* Radial Aerofoil Rotor Blades */}
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
                    <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
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
        <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ── 5. Heavy Synchronous Generator Housing ─────────────── */}
      <mesh position={[1.45, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.68, 0.68, 1.45, 24]} />
        <meshStandardMaterial color="#0369a1" metalness={0.65} roughness={0.3} />
      </mesh>

      {/* Generator Stator Cooling Ribs / Rings */}
      {[-0.45, -0.22, 0, 0.22, 0.45].map((gx, i) => (
        <mesh key={`rib-${i}`} position={[1.45 + gx, 1.45, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.69, 0.025, 8, 24]} />
          <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Generator High-Voltage Terminal & Exciter Enclosure */}
      <mesh position={[1.45, 2.22, 0]}>
        <boxGeometry args={[0.55, 0.28, 0.45]} />
        <meshStandardMaterial color="#10b981" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* ── 6. Unit Label with Thin Leader Line (Staggered Height) ── */}
      <UnitLabel
        position={[0.4, 3.6, 0]}
        targetPosition={[0.4, 1.8, 0]}
        title="STEAM TURBINE & GENERATOR"
        subtitle={`${effectivePower.toFixed(1)} kWe Net Power Export`}
        tag="POWER GEN"
        tagColor="#60a5fa"
        accentColor="#60a5fa"
        onClick={() => onSelectComponent?.('turbine')}
      />
    </group>
  )
}
