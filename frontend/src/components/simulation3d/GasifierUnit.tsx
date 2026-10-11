import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { UnitLabel, SubLabel } from './Labels'

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
  lowDetail = false,
  onSelectComponent,
  selected,
}: GasifierUnitProps) {
  const glowRef = useRef<THREE.Mesh>(null)
  const particlesMeshRef = useRef<THREE.InstancedMesh>(null)
  const glowInfo = getTemperatureColorAndIntensity(temperature)

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
    // 1. Glow pulsing
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

    particles.forEach((p, i) => {
      if (activeDelta > 0) {
        if (u0_over_umf_eff < 1.0) {
          // REGIME 1: Static Packed Bed (U0 < Umf_eff)
          p.y = Math.max(DISTRIBUTOR_Y + 0.02, Math.min(DISTRIBUTOR_Y + STATIC_BED_H * 0.8, p.y))
          p.x += Math.sin(p.phase + Date.now() * 0.001) * 0.0004
          p.z += Math.cos(p.phase + Date.now() * 0.001) * 0.0004
        } else if (u0_over_umf_eff < 2.0) {
          // REGIME 2: Incipient Fluidization (1.0 <= U0/Umf_eff < 2.0)
          p.y += Math.sin(Date.now() * 0.004 + p.phase) * activeDelta * 0.08
          p.y = Math.max(DISTRIBUTOR_Y + 0.03, Math.min(currentBedTop, p.y))
        } else {
          // REGIME 3: Bubbling Fluidization (U0/Umf_eff >= 2.0)
          const isCore = p.r < BED_RADIUS * 0.65
          const wakeSpeed = (0.4 + u_excess * 0.8) * p.vy

          if (isCore) {
            p.y += activeDelta * wakeSpeed
            if (p.y > currentBedTop) {
              p.y = currentBedTop
              p.r = Math.min(BED_RADIUS * 0.95, p.r + 0.15)
              const theta = Math.atan2(p.z, p.x)
              p.x = p.r * Math.cos(theta)
              p.z = p.r * Math.sin(theta)
            }
          } else {
            p.y -= activeDelta * wakeSpeed * 0.7
            if (p.y < DISTRIBUTOR_Y + 0.05) {
              p.y = DISTRIBUTOR_Y + 0.05
              p.r = Math.max(0.05, p.r - 0.2)
              const theta = Math.atan2(p.z, p.x)
              p.x = p.r * Math.cos(theta)
              p.z = p.r * Math.sin(theta)
            }
          }

          // REGIME 4: Entrainment / Elutriation into Freeboard
          if (u0_over_ut > 0.45 && i % 8 === 0) {
            p.y += activeDelta * (u0_over_ut * 1.5)
            if (p.y > 3.8) p.y = DISTRIBUTOR_Y + 0.1
          }
        }
      }

      dummy.position.set(p.x, p.y, p.z)
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
      {/* Selection highlight ring */}
      {selected && (
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.7, 1.9, 36]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* ── 1. Structural Support Legs & Anchor Plates ────────── */}
      {[
        [-0.95, -0.95],
        [-0.95, 0.95],
        [0.95, -0.95],
        [0.95, 0.95],
      ].map(([lx, lz], i) => (
        <group key={`leg-${i}`} position={[lx, 0.75, lz]}>
          {/* Vertical tubular column leg */}
          <mesh>
            <cylinderGeometry args={[0.07, 0.08, 1.5, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Diagonal gusset bracket to vessel wall */}
          <mesh position={[-lx * 0.15, 0.6, -lz * 0.15]} rotation={[0, 0, Math.PI / 6]}>
            <boxGeometry args={[0.04, 0.35, 0.08]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Sole plate at ground */}
          <mesh position={[0, -0.73, 0]}>
            <boxGeometry args={[0.26, 0.04, 0.26]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* ── 2. Ash Discharge Cone & Motorized Airlock Valve ────── */}
      <group position={[0, 0.2, 0]}>
        {/* Bottom conical ash hopper */}
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[1.15, 0.25, 0.45, 24]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.25} />
        </mesh>
        {/* Rotary airlock valve housing */}
        <mesh position={[0, -0.52, 0]}>
          <boxGeometry args={[0.32, 0.18, 0.32]} />
          <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Valve electric motor */}
        <mesh position={[0.24, -0.52, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.18, 12]} />
          <meshStandardMaterial color="#1e40af" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Ash discharge collection drum */}
        <mesh position={[0, -0.72, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.24, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.75} roughness={0.25} />
        </mesh>
      </group>

      {/* ── 3. Air Plenum Chamber (Windbox Below Distributor) ──── */}
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[1.18, 1.15, 0.52, 28]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Primary Air Intake Nozzle / Flange */}
      <mesh position={[-1.25, 0.48, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.35, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* ── 4. Air Distributor Plate (Tuyere Deck) ─────────────── */}
      <group position={[0, DISTRIBUTOR_Y, 0]}>
        <mesh>
          <cylinderGeometry args={[1.18, 1.18, 0.08, 28]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Tuyere bubble nozzles grid */}
        {[-0.6, -0.2, 0.2, 0.6].map((x, i) =>
          [-0.6, -0.2, 0.2, 0.6].map((z, j) => (
            <mesh key={`tuyere-${i}-${j}`} position={[x * 0.82, 0.06, z * 0.82]}>
              <cylinderGeometry args={[0.025, 0.03, 0.06, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
            </mesh>
          ))
        )}
      </group>

      {/* ── 5. Main Vessel Shell & Multi-Layer Refractory Cutaway ── */}
      {/* Outer Carbon Steel Shell (with front cutaway sector) */}
      <mesh position={[0, 2.25, 0]}>
        <cylinderGeometry
          args={[1.18, 1.18, 2.9, 32, 1, false, Math.PI * 0.25, Math.PI * 1.55]}
        />
        <meshStandardMaterial
          color="#1e293b"
          metalness={0.75}
          roughness={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Intermediate Insulating Fiber Blanket Layer (visible in cutaway) */}
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

      {/* Inner Alumina Refractory Brick Liner (visible in cutaway) */}
      <mesh position={[0, 2.25, 0]}>
        <cylinderGeometry
          args={[1.04, 1.04, 2.86, 32, 1, false, Math.PI * 0.25, Math.PI * 1.55]}
        />
        <meshStandardMaterial
          color="#b45309"
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
          color="#38bdf8"
          metalness={0.1}
          roughness={0.1}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── 6. Flanged Joints & Bolt Studs ─────────────────────── */}
      {[0.78, 2.2, 3.65].map((fy, idx) => (
        <group key={`flange-${idx}`} position={[0, fy, 0]}>
          <mesh>
            <cylinderGeometry args={[1.26, 1.26, 0.08, 32]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Bolt heads around flange perimeter */}
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
              <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ── 7. Top Dome (Disengagement Head) & Exit Nozzle ──────── */}
      <mesh position={[0, 3.75, 0]}>
        <sphereGeometry args={[1.18, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Top Syngas Discharge Nozzle */}
      <mesh position={[0, 4.4, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.55, 18]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* ── 8. Thermocouple Instrument Stubs ─────────────────────── */}
      {[
        { y: 0.48, label: 'TC1: Plenum Inflow' },
        { y: 1.05, label: 'TC2: Lower Bed Zone' },
        { y: 1.65, label: 'TC3: Active Bubbling Zone' },
        { y: 2.85, label: 'TC4: Freeboard Gas' },
      ].map((tc, idx) => (
        <group key={`tc-${idx}`} position={[0.95, tc.y, 0.72]}>
          {/* Radial thermowell boss */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.32, 10]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Blue explosion-proof transmitter head */}
          <mesh position={[0.2, 0, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.12, 12]} />
            <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* ── 9. Fluidized Bed Core Glow & Dynamic Level Ring ──────── */}
      {/* Dynamic Temperature Margin Glow Cylinder */}
      <mesh ref={glowRef} position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.9, 0.98, 1.4, 20]} />
        <meshStandardMaterial
          color={glowInfo.color}
          emissive={glowInfo.color}
          emissiveIntensity={glowInfo.intensity}
          transparent
          opacity={0.24}
        />
      </mesh>

      {/* Dynamic Bed Surface Level Ring */}
      <mesh position={[0, bedHeightDisplay, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.82, 0.88, 32]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} side={THREE.DoubleSide} />
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

      {/* ── 10. Labels with Thin Leader Lines (Staggered Heights) ── */}
      {/* Main Gasifier Label above vessel top */}
      <UnitLabel
        position={[0, 5.6, 0]}
        targetPosition={[0, 4.4, 0]}
        title="FLUIDIZED BED GASIFIER"
        subtitle={`${temperature.toFixed(0)} °C · Autothermal Bubbling Bed`}
        tag="REACTOR TWIN"
        tagColor="#f59e0b"
        accentColor="#f59e0b"
        onClick={() => onSelectComponent?.('gasifier')}
      />

      {/* Sub-labels on front side facing camera with dedicated leader lines */}
      <SubLabel
        position={[3.3, 3.5, 1.8]}
        targetPosition={[0.8, 3.2, 0.7]}
        text="FREEBOARD (DISENGAGEMENT)"
        color="#94a3b8"
      />

      <SubLabel
        position={[3.3, bedHeightDisplay, 1.8]}
        targetPosition={[0.7, bedHeightDisplay, 0.7]}
        text="BED SURFACE LEVEL"
        value={`H = ${(bedHeightDisplay - DISTRIBUTOR_Y).toFixed(2)}m`}
        color="#38bdf8"
      />

      <SubLabel
        position={[3.3, 1.1, 1.8]}
        targetPosition={[0.8, DISTRIBUTOR_Y, 0.7]}
        text="AIR DISTRIBUTOR PLATE"
        value="Tuyere Deck"
        color="#e2e8f0"
      />

      <SubLabel
        position={[3.3, 0.45, 1.8]}
        targetPosition={[0.8, 0.45, 0.7]}
        text="AIR PLENUM WINDBOX"
        color="#64748b"
      />
    </group>
  )
}
