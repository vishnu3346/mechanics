import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { UnitTag, SelectionOutlineRing } from './Labels'
import { getPalette } from './palette'

// Temperature Margin Glow Evaluator (Retained from UI-2)
export function getTemperatureColorAndIntensity(tempC: number): {
  color: string
  intensity: number
  label: string
} {
  if (tempC < 650) {
    return { color: '#64748b', intensity: 0.25, label: 'Cold Bed / Extinction Risk' }
  } else if (tempC < 750) {
    return { color: '#d97706', intensity: 0.45, label: 'Cold Bed Margin (<750 °C)' }
  } else if (tempC <= 900) {
    const normalized = Math.min(1.0, Math.max(0.0, (tempC - 750) / 150))
    const intensity = 0.7 + normalized * 0.35
    return { color: '#f59e0b', intensity, label: 'Optimal Autothermal Regime' }
  } else if (tempC <= 1000) {
    return { color: '#ea580c', intensity: 1.2, label: 'Elevated Thermal Margin (>900 °C)' }
  } else {
    return { color: '#ef4444', intensity: 1.6, label: 'Sintering Runaway (>1000 °C)' }
  }
}

interface GasifierUnitProps {
  temperature: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  u0_over_umf_eff: number
  u0_over_ut: number
  d_eff_m: number
  u0_m_s: number
  umf_eff_m_s: number
  theme?: 'light' | 'dark'
  lowDetail?: boolean
  onSelectComponent?: (comp: string) => void
  selected?: boolean
}

const PARTICLE_COUNT = 1600
const BED_RADIUS = 0.85
const DISTRIBUTOR_Y = 0.75
const STATIC_BED_H = 0.75

export function GasifierUnit({
  temperature,
  running,
  paused,
  reducedMotion,
  u0_over_umf_eff,
  u0_over_ut,
  d_eff_m,
  u0_m_s,
  umf_eff_m_s,
  theme = 'dark',
  lowDetail = false,
  onSelectComponent,
  selected,
}: GasifierUnitProps) {
  const glowRef = useRef<THREE.Mesh>(null)
  const particlesMeshRef = useRef<THREE.InstancedMesh>(null)
  const glowInfo = getTemperatureColorAndIntensity(temperature)
  const p = getPalette(theme)

  const particleCount = lowDetail ? 800 : PARTICLE_COUNT

  // Particle state data: [x, y, z, vy, phase, r]
  const particles = useMemo(() => {
    const data = []
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * BED_RADIUS
      const x = r * Math.cos(theta)
      const z = r * Math.sin(theta)
      const y = DISTRIBUTOR_Y + Math.random() * STATIC_BED_H
      const phase = Math.random() * Math.PI * 2
      const speed = 0.6 + Math.random() * 0.8
      data.push({ x, y, z, vy: speed, phase, r })
    }
    return data
  }, [particleCount])

  // Particle size based on d_eff
  const particleScale = useMemo(() => {
    const ratio = Math.max(0.6, Math.min(3.5, d_eff_m / 400e-6))
    return 0.024 * ratio
  }, [d_eff_m])

  // Particle color based on thermal/defluidization regime
  const particleColor = useMemo(() => {
    const col = new THREE.Color()
    if (u0_over_umf_eff < 1.0) {
      col.set('#b45309') // slumped agglomerated bed
    } else if (temperature > 930) {
      col.set('#f97316')
    } else {
      col.set('#fbbf24')
    }
    return col
  }, [u0_over_umf_eff, temperature])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Dynamic bed height display
  const bedExpansion = Math.min(0.7, Math.max(0, (u0_over_umf_eff - 1.0) * 0.08))
  const bedHeightDisplay = DISTRIBUTOR_Y + STATIC_BED_H + bedExpansion

  useFrame((_, delta) => {
    // 1. Core glow pulsing (ONLY inside hot cutaway interior)
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial
      const pulse = running && !paused && !reducedMotion ? Math.sin(Date.now() * 0.004) * 0.15 : 0
      mat.emissiveIntensity = Math.max(0.1, glowInfo.intensity + pulse)
    }

    // 2. Fluidized bed particles physics animation (Retained from UI-2)
    if (!particlesMeshRef.current) return
    const activeDelta = running && !paused && !reducedMotion ? delta : 0

    const u_excess = Math.max(0, u0_m_s - umf_eff_m_s)
    const currentBedTop = DISTRIBUTOR_Y + STATIC_BED_H + bedExpansion

    particles.forEach((pState, i) => {
      if (activeDelta > 0) {
        if (u0_over_umf_eff < 1.0) {
          // REGIME 1: Static Packed Bed (U0 < Umf_eff)
          pState.y = Math.max(DISTRIBUTOR_Y + 0.02, Math.min(DISTRIBUTOR_Y + STATIC_BED_H * 0.8, pState.y))
          pState.x += Math.sin(pState.phase + Date.now() * 0.001) * 0.0004
          pState.z += Math.cos(pState.phase + Date.now() * 0.001) * 0.0004
        } else if (u0_over_umf_eff < 2.0) {
          // REGIME 2: Incipient Fluidization (1.0 <= U0/Umf_eff < 2.0)
          pState.y += Math.sin(Date.now() * 0.004 + pState.phase) * activeDelta * 0.08
          pState.y = Math.max(DISTRIBUTOR_Y + 0.03, Math.min(currentBedTop, pState.y))
        } else {
          // REGIME 3: Bubbling Fluidization (U0/Umf_eff >= 2.0)
          const isCore = pState.r < BED_RADIUS * 0.65
          const wakeSpeed = (0.4 + u_excess * 0.8) * pState.vy

          if (isCore) {
            pState.y += activeDelta * wakeSpeed
            if (pState.y > currentBedTop) {
              pState.y = currentBedTop
              pState.r = Math.min(BED_RADIUS * 0.95, pState.r + 0.15)
              const theta = Math.atan2(pState.z, pState.x)
              pState.x = pState.r * Math.cos(theta)
              pState.z = pState.r * Math.sin(theta)
            }
          } else {
            pState.y -= activeDelta * wakeSpeed * 0.7
            if (pState.y < DISTRIBUTOR_Y + 0.05) {
              pState.y = DISTRIBUTOR_Y + 0.05
              pState.r = Math.max(0.05, pState.r - 0.2)
              const theta = Math.atan2(pState.z, pState.x)
              pState.x = pState.r * Math.cos(theta)
              pState.z = pState.r * Math.sin(theta)
            }
          }

          // REGIME 4: Entrainment / Elutriation into Freeboard
          if (u0_over_ut > 0.45 && i % 8 === 0) {
            pState.y += activeDelta * (u0_over_ut * 1.5)
            if (pState.y > 3.8) pState.y = DISTRIBUTOR_Y + 0.1
          }
        }
      }

      dummy.position.set(pState.x, pState.y, pState.z)
      dummy.scale.set(particleScale, particleScale, particleScale)
      dummy.updateMatrix()
      particlesMeshRef.current!.setMatrixAt(i, dummy.matrix)
      particlesMeshRef.current!.setColorAt(i, particleColor)
    })

    particlesMeshRef.current.instanceMatrix.needsUpdate = true
    if (particlesMeshRef.current.instanceColor) {
      particlesMeshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <group position={[-4.5, 0, 0]} onClick={(e) => { e.stopPropagation(); onSelectComponent?.('gasifier'); }}>
      {/* Selection highlight outline */}
      {selected && <SelectionOutlineRing radius={1.9} color="#38bdf8" />}

      {/* ── 1. Structural Support Legs & Anchor Plates ────────── */}
      {[
        [-0.95, -0.95],
        [-0.95, 0.95],
        [0.95, -0.95],
        [0.95, 0.95],
      ].map(([lx, lz], i) => (
        <group key={`leg-${i}`} position={[lx, 0.75, lz]}>
          <mesh>
            <cylinderGeometry args={[0.07, 0.08, 1.5, 12]} />
            <meshStandardMaterial color={p.equipment.gasifierLegs} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[-lx * 0.15, 0.6, -lz * 0.15]} rotation={[0, 0, Math.PI / 6]}>
            <boxGeometry args={[0.04, 0.35, 0.08]} />
            <meshStandardMaterial color={p.equipment.gasifierBands} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.73, 0]}>
            <boxGeometry args={[0.26, 0.04, 0.26]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* ── 2. Ash Discharge Cone & Motorized Airlock Valve ────── */}
      <group position={[0, 0.2, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[1.15, 0.25, 0.45, 24]} />
          <meshStandardMaterial color={p.equipment.gasifierBands} metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, -0.52, 0]}>
          <boxGeometry args={[0.32, 0.18, 0.32]} />
          <meshStandardMaterial color={p.equipment.pumpCasing} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.24, -0.52, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.18, 12]} />
          <meshStandardMaterial color={p.equipment.pumpMotor} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.72, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.24, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.75} roughness={0.25} />
        </mesh>
      </group>

      {/* ── 3. Air Plenum Chamber (Windbox Below Distributor) ──── */}
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[1.18, 1.15, 0.52, 28]} />
        <meshStandardMaterial color={p.equipment.gasifierBands} metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Primary Air Intake Nozzle */}
      <mesh position={[-1.25, 0.48, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.35, 16]} />
        <meshStandardMaterial color={p.equipment.gasifierBands} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* ── 4. Air Distributor Plate (Tuyere Deck) ─────────────── */}
      <group position={[0, DISTRIBUTOR_Y, 0]}>
        <mesh>
          <cylinderGeometry args={[1.18, 1.18, 0.08, 28]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
        </mesh>
        {[-0.6, -0.2, 0.2, 0.6].map((x, i) =>
          [-0.6, -0.2, 0.2, 0.6].map((z, j) => (
            <mesh key={`tuyere-${i}-${j}`} position={[x * 0.82, 0.06, z * 0.82]}>
              <cylinderGeometry args={[0.025, 0.03, 0.06, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
            </mesh>
          ))
        )}
      </group>

      {/* ── 5. Main Vessel Shell & Warm Terracotta Refractory ──── */}
      {/* Outer Shell in High-Contrast Warm Terracotta Refractory with Cutaway */}
      <mesh position={[0, 2.25, 0]}>
        <cylinderGeometry
          args={[1.18, 1.18, 2.9, 32, 1, false, Math.PI * 0.25, Math.PI * 1.55]}
        />
        <meshStandardMaterial
          color={p.equipment.gasifierShell}
          metalness={0.4}
          roughness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Intermediate Insulating Blanket (visible in cutaway) */}
      <mesh position={[0, 2.25, 0]}>
        <cylinderGeometry
          args={[1.12, 1.12, 2.88, 32, 1, false, Math.PI * 0.25, Math.PI * 1.55]}
        />
        <meshStandardMaterial
          color="#e2e8f0"
          roughness={0.8}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner Alumina Refractory Brick Liner */}
      <mesh position={[0, 2.25, 0]}>
        <cylinderGeometry
          args={[1.04, 1.04, 2.86, 32, 1, false, Math.PI * 0.25, Math.PI * 1.55]}
        />
        <meshStandardMaterial
          color={p.equipment.gasifierLiner}
          roughness={0.9}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Transparent Front Observation Window Panel */}
      <mesh position={[0, 2.25, 0]}>
        <cylinderGeometry
          args={[1.19, 1.19, 2.88, 24, 1, false, -Math.PI * 0.25, Math.PI * 0.5]}
        />
        <meshStandardMaterial
          color={p.equipment.gasifierObservationGlass}
          metalness={0.1}
          roughness={0.1}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── 6. Structural Steel Bands & Flanges (High Contrast) ─ */}
      {[0.78, 2.2, 3.65].map((fy, idx) => (
        <group key={`flange-${idx}`} position={[0, fy, 0]}>
          <mesh>
            <cylinderGeometry args={[1.26, 1.26, 0.08, 32]} />
            <meshStandardMaterial color={p.equipment.gasifierBands} metalness={0.85} roughness={0.2} />
          </mesh>
          {Array.from({ length: 12 }).map((_, bIdx) => (
            <mesh
              key={`bolt-${bIdx}`}
              position={[
                Math.cos((bIdx * Math.PI) / 6) * 1.22,
                0,
                Math.sin((bIdx * Math.PI) / 6) * 1.22,
              ]}
            >
              <boxGeometry args={[0.03, 0.1, 0.03]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ── 7. Top Dome (Disengagement Head) & Exit Nozzle ──────── */}
      <mesh position={[0, 3.75, 0]}>
        <sphereGeometry args={[1.18, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={p.equipment.gasifierBands} metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 4.4, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.55, 18]} />
        <meshStandardMaterial color={p.equipment.gasifierBands} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* ── 8. Fluidized Bed Core Glow & Dynamic Level Ring ──────── */}
      {/* Emissive glow ONLY on hot internal bed core inside cutaway */}
      <mesh ref={glowRef} position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.9, 0.98, 1.4, 20]} />
        <meshStandardMaterial
          color={glowInfo.color}
          emissive={glowInfo.color}
          emissiveIntensity={glowInfo.intensity}
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* Dynamic Bed Surface Level Ring */}
      <mesh position={[0, bedHeightDisplay, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.82, 0.88, 32]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* Active Physics Instanced Particles */}
      <instancedMesh
        ref={particlesMeshRef}
        args={[undefined, undefined, particleCount]}
        position={[0, 0, 0]}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive={temperature > 800 ? '#ea580c' : '#78350f'}
          emissiveIntensity={0.3}
          roughness={0.4}
        />
      </instancedMesh>

      {/* ── 9. Decluttered Unit Tag (Clean Scene, Details on Click) ── */}
      <UnitTag
        position={[0, 5.2, 0]}
        targetPosition={[0, 4.4, 0]}
        unitNumber={2}
        name="Bed Gasifier"
        headline={`${temperature.toFixed(0)} °C`}
        accentColor="#f59e0b"
        selected={selected}
        onClick={() => onSelectComponent?.('gasifier')}
      />
    </group>
  )
}
