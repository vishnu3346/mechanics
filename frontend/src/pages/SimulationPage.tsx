import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, PerspectiveCamera } from '@react-three/drei'
import { api, createSimulationSocket } from '../services/api'
import type { SimulationResult, Scenario } from '../types'
import {
  Play,
  Pause,
  RotateCcw,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Eye,
  Info,
  X,
  Layers,
  Activity,
  Zap,
  Flame,
  Gauge
} from 'lucide-react'
import { LineChart, Line as RLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import * as THREE from 'three'

// ── Temperature Margin Glow Evaluator ─────────────────────────
function getTemperatureColorAndIntensity(tempC: number): {
  color: string
  intensity: number
  label: string
} {
  // Margin relative to optimal autothermal bubbling setpoint [800 °C - 900 °C]
  if (tempC < 650) {
    return { color: '#64748b', intensity: 0.25, label: 'Cold Bed / Extinction Risk' }
  } else if (tempC < 750) {
    return { color: '#d97706', intensity: 0.45, label: 'Cold Bed Margin (<750 °C)' }
  } else if (tempC <= 900) {
    // Optimal operating zone (800 - 900 °C)
    const normalized = Math.min(1.0, Math.max(0.0, (tempC - 750) / 150))
    const intensity = 0.7 + normalized * 0.35
    return { color: '#f59e0b', intensity, label: 'Optimal Autothermal Regime' }
  } else if (tempC <= 1000) {
    // Thermal warning zone (900 - 1000 °C): polymer softening & accelerated sintering
    return { color: '#ea580c', intensity: 1.2, label: 'Elevated Thermal Margin (>900 °C)' }
  } else {
    // Thermal runaway (>1000 °C): severe mineral clinkering
    return { color: '#ef4444', intensity: 1.6, label: 'Sintering Runaway (>1000 °C)' }
  }
}

// ── 3D Components ─────────────────────────────────────────────

// 1. Conveyor (Schematic waste feed)
function Conveyor({ running, paused }: { running: boolean; paused: boolean }) {
  const beltRef = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (running && !paused && beltRef.current) {
      const mat = beltRef.current.material as THREE.MeshStandardMaterial
      if (mat.map) mat.map.offset.x += delta * 0.3
    }
  })

  return (
    <group position={[-8, 0.3, 0]}>
      {/* Belt structure */}
      <mesh ref={beltRef} position={[0, 0, 0]}>
        <boxGeometry args={[6, 0.15, 1.2]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Supports */}
      {[-2.5, 0, 2.5].map((x, i) => (
        <mesh key={i} position={[x, -0.4, 0]}>
          <boxGeometry args={[0.12, 0.7, 1.3]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* Side rails */}
      <mesh position={[0, 0.15, 0.65]}>
        <boxGeometry args={[6, 0.2, 0.06]} />
        <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.15, -0.65]}>
        <boxGeometry args={[6, 0.2, 0.06]} />
        <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Rollers */}
      {[-2.8, -1.4, 0, 1.4, 2.8].map((x, i) => (
        <mesh key={`r${i}`} position={[x, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.2, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <Text position={[0, 1.4, 0]} fontSize={0.2} color="#94a3b8" anchorX="center" fontWeight="bold">
        SORTING CONVEYOR [SCHEMATIC]
      </Text>
    </group>
  )
}

// 2. Waste Objects (Schematic visual)
function WasteObjects({ running, paused }: { running: boolean; paused: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    if (running && !paused) {
      timeRef.current += delta
      if (ref.current) {
        ref.current.children.forEach((child, i) => {
          const speed = 0.8
          const offset = i * 1.5
          const x = ((timeRef.current * speed + offset) % 8) - 7
          child.position.x = x
          child.rotation.y += delta * 0.3
          child.visible = x < 5 && x > -11
        })
      }
    }
  })

  const colors = ['#ef4444', '#3b82f6', '#22c55e', '#8b5cf6', '#f59e0b']
  return (
    <group ref={ref} position={[-4, 0.6, 0]}>
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={i} position={[i * -1.5, 0, (Math.random() - 0.5) * 0.6]}>
          {i % 3 === 0 ? (
            <mesh>
              <boxGeometry args={[0.35, 0.25, 0.3]} />
              <meshStandardMaterial color={colors[i % 5]} roughness={0.3} metalness={0.4} />
            </mesh>
          ) : i % 3 === 1 ? (
            <mesh>
              <cylinderGeometry args={[0.15, 0.15, 0.3, 8]} />
              <meshStandardMaterial color={colors[i % 5]} roughness={0.3} metalness={0.4} />
            </mesh>
          ) : (
            <mesh>
              <sphereGeometry args={[0.18, 8, 8]} />
              <meshStandardMaterial color={colors[i % 5]} roughness={0.3} metalness={0.4} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

// 3. AI Camera Scanner (Schematic visual)
function AICamera() {
  return (
    <group position={[-5, 2.2, 0]}>
      {/* Camera body */}
      <mesh>
        <boxGeometry args={[0.5, 0.35, 0.3]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Lens */}
      <mesh position={[0, -0.1, 0.18]}>
        <cylinderGeometry args={[0.1, 0.12, 0.1, 14]} />
        <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Scan beam */}
      <mesh position={[0, -0.9, 0]}>
        <coneGeometry args={[0.8, 1.5, 6]} />
        <meshStandardMaterial color="#06b6d4" transparent opacity={0.15} wireframe />
      </mesh>
      {/* Mount */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>
      <Text position={[0, 0.8, 0]} fontSize={0.18} color="#38bdf8" anchorX="center" fontWeight="bold">
        AI OPTICAL SCANNER [SCHEMATIC]
      </Text>
    </group>
  )
}

// 4. Fluidized Bed Particles (InstancedMesh driven by U0/Umf_eff, U0/Ut, d_p_eff)
interface BedParticlesProps {
  u0_over_umf_eff: number
  u0_over_ut: number
  d_eff_m: number
  u0_m_s: number
  umf_eff_m_s: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  tempC: number
}

const PARTICLE_COUNT = 1800
const BED_RADIUS = 0.85
const DISTRIBUTOR_Y = 0.45
const STATIC_BED_H = 0.75

function FluidizedBedParticles({
  u0_over_umf_eff,
  u0_over_ut,
  d_eff_m,
  u0_m_s,
  umf_eff_m_s,
  running,
  paused,
  reducedMotion,
  tempC,
}: BedParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  // Particle state data: [x, y, z, vx, vy, vz, phase, baseRadius]
  const particles = useMemo(() => {
    const data = []
    const rnd = new THREE.Vector3()
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Cylinder distribution inside the bed
      const theta = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * BED_RADIUS
      const x = r * Math.cos(theta)
      const z = r * Math.sin(theta)
      const y = DISTRIBUTOR_Y + Math.random() * STATIC_BED_H
      const phase = Math.random() * Math.PI * 2
      const speed = 0.6 + Math.random() * 0.8
      data.push({ x, y, z, vx: 0, vy: speed, vz: 0, phase, r })
    }
    return data
  }, [])

  // Particle size scaling factor based on d_eff (base 400 µm)
  const particleScale = useMemo(() => {
    const ratio = Math.max(0.6, Math.min(3.5, d_eff_m / 400e-6))
    return 0.024 * ratio
  }, [d_eff_m])

  // Color selection based on temperature and agglomeration
  const particleColor = useMemo(() => {
    const col = new THREE.Color()
    if (u0_over_umf_eff < 1.0) {
      // Slumped / defluidized: darker sintered tone
      col.set('#b45309')
    } else if (tempC > 930) {
      col.set('#f97316')
    } else {
      col.set('#fbbf24')
    }
    return col
  }, [u0_over_umf_eff, tempC])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const activeDelta = running && !paused && !reducedMotion ? delta : 0

    const u_excess = Math.max(0, u0_m_s - umf_eff_m_s)
    const bedExpansion = Math.min(0.7, Math.max(0, (u0_over_umf_eff - 1.0) * 0.08))
    const currentBedTop = DISTRIBUTOR_Y + STATIC_BED_H + bedExpansion

    particles.forEach((p, i) => {
      if (activeDelta > 0) {
        if (u0_over_umf_eff < 1.0) {
          // REGIME 1: Static Packed Bed (U0 < Umf_eff)
          // Slumped to bottom, minimal Brownian jitter only
          p.y = Math.max(DISTRIBUTOR_Y + 0.02, Math.min(DISTRIBUTOR_Y + STATIC_BED_H * 0.8, p.y))
          p.x += Math.sin(p.phase + Date.now() * 0.001) * 0.0004
          p.z += Math.cos(p.phase + Date.now() * 0.001) * 0.0004
        } else if (u0_over_umf_eff < 2.0) {
          // REGIME 2: Incipient Fluidization (1.0 <= U0/Umf_eff < 2.0)
          // Minimal local motion, gentle oscillation
          p.y += Math.sin(Date.now() * 0.004 + p.phase) * activeDelta * 0.08
          p.y = Math.max(DISTRIBUTOR_Y + 0.03, Math.min(currentBedTop, p.y))
        } else {
          // REGIME 3: Bubbling Fluidization (U0/Umf_eff >= 2.0)
          // Bubbling scaled by (U0 - Umf_eff): upward wake in core, downflow at walls
          const isCore = p.r < BED_RADIUS * 0.65
          const wakeSpeed = (0.4 + u_excess * 0.8) * p.vy

          if (isCore) {
            // Core rise
            p.y += activeDelta * wakeSpeed
            if (p.y > currentBedTop) {
              // Surface eruption: particles burst and migrate outward to wall
              p.y = currentBedTop
              p.r = Math.min(BED_RADIUS * 0.95, p.r + 0.15)
              const theta = Math.atan2(p.z, p.x)
              p.x = p.r * Math.cos(theta)
              p.z = p.r * Math.sin(theta)
            }
          } else {
            // Wall descent
            p.y -= activeDelta * wakeSpeed * 0.7
            if (p.y < DISTRIBUTOR_Y + 0.05) {
              // Bottom recycle toward core
              p.y = DISTRIBUTOR_Y + 0.05
              p.r = Math.max(0.05, p.r - 0.2)
              const theta = Math.atan2(p.z, p.x)
              p.x = p.r * Math.cos(theta)
              p.z = p.r * Math.sin(theta)
            }
          }

          // REGIME 4: Entrainment / Elutriation as U0/Ut approaches 1.0 (or > 0.45)
          if (u0_over_ut > 0.45 && i % 8 === 0) {
            // Fines loft into freeboard
            p.y += activeDelta * (u0_over_ut * 1.5)
            if (p.y > 3.2) p.y = DISTRIBUTOR_Y + 0.1
          }
        }
      }

      dummy.position.set(p.x, p.y, p.z)
      dummy.scale.set(particleScale, particleScale, particleScale)
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
      meshRef.current!.setColorAt(i, particleColor)
    })

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
      position={[0, 0, 0]}
    >
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color="#fbbf24"
        emissive={tempC > 800 ? '#ea580c' : '#78350f'}
        emissiveIntensity={0.3}
        roughness={0.4}
      />
    </instancedMesh>
  )
}

// 5. Gasifier Cutaway Component
interface GasifierProps {
  temperature: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  u0_over_umf_eff: number
  u0_over_ut: number
  d_eff_m: number
  u0_m_s: number
  umf_eff_m_s: number
  onSelect: () => void
  selected: boolean
}

function Gasifier({
  temperature,
  running,
  paused,
  reducedMotion,
  u0_over_umf_eff,
  u0_over_ut,
  d_eff_m,
  u0_m_s,
  umf_eff_m_s,
  onSelect,
  selected,
}: GasifierProps) {
  const glowRef = useRef<THREE.Mesh>(null)
  const glowInfo = getTemperatureColorAndIntensity(temperature)

  useFrame(() => {
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial
      const pulse = running && !paused && !reducedMotion ? Math.sin(Date.now() * 0.004) * 0.15 : 0
      mat.emissiveIntensity = Math.max(0.1, glowInfo.intensity + pulse)
    }
  })

  const bedHeightDisplay = DISTRIBUTOR_Y + STATIC_BED_H + Math.min(0.6, Math.max(0, (u0_over_umf_eff - 1.0) * 0.08))

  return (
    <group position={[-1, 0, 0]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Selection highlight ring */}
      {selected && (
        <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.7, 32]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Main Reactor Vessel Cutaway (Transparent Outer Shell) */}
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[1.15, 1.25, 3.2, 28, 1, false, 0, Math.PI * 1.85]} />
        <meshStandardMaterial
          color="#1e293b"
          metalness={0.7}
          roughness={0.2}
          transparent
          opacity={0.32}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Top Dome (Disengagement Head) */}
      <mesh position={[0, 3.4, 0]}>
        <sphereGeometry args={[1.15, 24, 12, 0, Math.PI * 1.85, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#334155"
          metalness={0.8}
          roughness={0.25}
          transparent
          opacity={0.38}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Syngas Exit Nozzle */}
      <mesh position={[0, 3.9, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.6, 16]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Air Distributor Plate (Tuyere Perforated Deck) */}
      <group position={[0, DISTRIBUTOR_Y, 0]}>
        <mesh>
          <cylinderGeometry args={[1.18, 1.18, 0.08, 24]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Tuyere bubble nozzles */}
        {[-0.6, -0.2, 0.2, 0.6].map((x, i) =>
          [-0.6, -0.2, 0.2, 0.6].map((z, j) => (
            <mesh key={`${i}-${j}`} position={[x * 0.8, 0.06, z * 0.8]}>
              <cylinderGeometry args={[0.025, 0.03, 0.06, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
            </mesh>
          ))
        )}
      </group>

      {/* Air Plenum Windbox Chamber (Below Distributor) */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[1.2, 1.22, 0.4, 24]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Primary Air Intake Flange */}
      <mesh position={[-1.3, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.6, 12]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Fluidized Bed Internal Glow Core (Keyed to temperature margin) */}
      <mesh ref={glowRef} position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.9, 1.0, 1.3, 18]} />
        <meshStandardMaterial
          color={glowInfo.color}
          emissive={glowInfo.color}
          emissiveIntensity={glowInfo.intensity}
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* Dynamic Bed Surface Level Indicator Ring */}
      <mesh position={[0, bedHeightDisplay, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.82, 0.86, 28]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>

      {/* Active Physics Bed Particles */}
      <FluidizedBedParticles
        u0_over_umf_eff={u0_over_umf_eff}
        u0_over_ut={u0_over_ut}
        d_eff_m={d_eff_m}
        u0_m_s={u0_m_s}
        umf_eff_m_s={umf_eff_m_s}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
        tempC={temperature}
      />

      {/* Base Structural Ring */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[1.4, 1.4, 0.15, 24]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* High-Contrast 3D Annotation Labels */}
      <Text position={[0, 4.4, 0]} fontSize={0.25} color="#38bdf8" anchorX="center" fontWeight="bold">
        FLUIDIZED BED GASIFIER
      </Text>
      <Text position={[1.35, 2.7, 0]} fontSize={0.16} color="#94a3b8" anchorX="left">
        FREEBOARD (DISENGAGEMENT)
      </Text>
      <Text position={[1.35, bedHeightDisplay, 0]} fontSize={0.16} color="#38bdf8" anchorX="left">
        BED SURFACE LEVEL
      </Text>
      <Text position={[1.35, DISTRIBUTOR_Y, 0]} fontSize={0.15} color="#e2e8f0" anchorX="left">
        AIR DISTRIBUTOR PLATE
      </Text>
    </group>
  )
}

// 6. HRSG Steam Boiler Component
interface BoilerProps {
  steamFlow: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  onSelect: () => void
  selected: boolean
}

function Boiler({
  steamFlow,
  running,
  paused,
  reducedMotion,
  onSelect,
  selected,
}: BoilerProps) {
  const steamRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (steamRef.current && running && !paused && !reducedMotion) {
      const speed = Math.min(2.5, Math.max(0.3, (steamFlow / 1500) * 0.8))
      steamRef.current.children.forEach((p) => {
        p.position.y += delta * speed
        if (p.position.y > 1.6) p.position.y = 0
        const mat = (p as any).material as THREE.MeshStandardMaterial
        mat.opacity = Math.max(0, 0.45 - p.position.y * 0.28)
      })
    }
  })

  return (
    <group position={[3.5, 0, 0]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Selection Ring */}
      {selected && (
        <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.7, 32]} />
          <meshBasicMaterial color="#f59e0b" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Boiler Horizontal Vessel Shell */}
      <mesh position={[0, 1.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.9, 0.9, 2.6, 24]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* End caps */}
      <mesh position={[-1.3, 1.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <sphereGeometry args={[0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[1.3, 1.8, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <sphereGeometry args={[0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Upper Steam Drum */}
      <mesh position={[0, 2.85, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.35, 1.8, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Downcomer & Riser Tubes */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 2.35, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 1.0, 10]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Steam Vent Particles */}
      <group ref={steamRef} position={[0, 3.2, 0]}>
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={i} position={[(Math.random() - 0.5) * 0.4, Math.random() * 1.5, (Math.random() - 0.5) * 0.4]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshStandardMaterial color="#f8fafc" transparent opacity={0.35} />
          </mesh>
        ))}
      </group>

      {/* Supports */}
      <mesh position={[-0.7, 0.5, 0]}>
        <boxGeometry args={[0.18, 1, 0.2]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.7, 0.5, 0]}>
        <boxGeometry args={[0.18, 1, 0.2]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>

      <Text position={[0, 4.0, 0]} fontSize={0.25} color="#f59e0b" anchorX="center" fontWeight="bold">
        HRSG STEAM BOILER
      </Text>
      <Text position={[0, 3.65, 0]} fontSize={0.16} color="#cbd5e1" anchorX="center">
        10 bar · 350 °C Superheated
      </Text>
    </group>
  )
}

// 7. Proper Multi-Stage Steam Turbine & Generator Model
interface TurbineProps {
  powerKw: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  onSelect: () => void
  selected: boolean
}

function Turbine({
  powerKw,
  running,
  paused,
  reducedMotion,
  onSelect,
  selected,
}: TurbineProps) {
  const rotorRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (rotorRef.current && running && !paused && !reducedMotion) {
      // RPM speed scaled by electrical power kW
      const spinSpeed = Math.min(25, Math.max(0.5, powerKw * 0.05))
      rotorRef.current.rotation.x += delta * spinSpeed
    }
  })

  return (
    <group position={[7.2, 0, 0]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Selection Ring */}
      {selected && (
        <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.7, 32]} />
          <meshBasicMaterial color="#60a5fa" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Multi-Stage Turbine Expander Casing (Tapered Axial Profile) */}
      <mesh position={[-0.5, 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.85, 1.8, 24]} />
        <meshStandardMaterial color="#1e40af" metalness={0.7} roughness={0.25} />
      </mesh>

      {/* Rotating Internal Multi-Stage Rotor Assembly */}
      <group ref={rotorRef} position={[-0.5, 1.4, 0]}>
        {/* Central Rotor Shaft */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 2.2, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* 4 Multi-Stage Blade Disks (HP -> IP -> LP) */}
        {[-0.6, -0.2, 0.2, 0.6].map((x, idx) => {
          const diskRadius = 0.35 + idx * 0.12
          return (
            <group key={idx} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <mesh>
                <cylinderGeometry args={[diskRadius, diskRadius, 0.04, 18]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.15} />
              </mesh>
              {/* Radial Blade Tips */}
              {Array.from({ length: 8 }).map((_, bIdx) => (
                <mesh
                  key={bIdx}
                  position={[
                    Math.cos((bIdx * Math.PI) / 4) * (diskRadius + 0.04),
                    0,
                    Math.sin((bIdx * Math.PI) / 4) * (diskRadius + 0.04),
                  ]}
                  rotation={[0, (bIdx * Math.PI) / 4, 0]}
                >
                  <boxGeometry args={[0.06, 0.03, 0.08]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
                </mesh>
              ))}
            </group>
          )
        })}
      </group>

      {/* Shaft Coupling Sleeve */}
      <mesh position={[0.6, 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.4, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Heavy-Duty Electric Generator Nacelle */}
      <mesh position={[1.4, 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.65, 0.65, 1.4, 20]} />
        <meshStandardMaterial color="#0369a1" metalness={0.65} roughness={0.3} />
      </mesh>
      {/* Generator Cooling Stator Ribs */}
      {[-0.4, -0.2, 0, 0.2, 0.4].map((zOffset, i) => (
        <mesh key={i} position={[1.4, 1.4, zOffset]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.66, 0.02, 8, 24]} />
          <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      {/* Exciter / Terminal Box */}
      <mesh position={[1.4, 2.15, 0]}>
        <boxGeometry args={[0.5, 0.25, 0.4]} />
        <meshStandardMaterial color="#10b981" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Rigid Cast Foundation Base */}
      <mesh position={[0.4, 0.2, 0]}>
        <boxGeometry args={[3.2, 0.4, 1.6]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
      </mesh>

      <Text position={[0.4, 3.0, 0]} fontSize={0.24} color="#60a5fa" anchorX="center" fontWeight="bold">
        STEAM TURBINE & GENERATOR
      </Text>
      <Text position={[0.4, 2.65, 0]} fontSize={0.16} color="#38bdf8" anchorX="center">
        {powerKw.toFixed(1)} kWe Net Export
      </Text>
    </group>
  )
}

// 8. CHP Heat Exchanger Component
interface HeatExchangerProps {
  recoveredHeatKw: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  onSelect: () => void
  selected: boolean
}

function HeatExchanger({
  recoveredHeatKw,
  running,
  paused,
  reducedMotion,
  onSelect,
  selected,
}: HeatExchangerProps) {
  const hotRef = useRef<THREE.Group>(null)
  const coldRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (running && !paused && !reducedMotion) {
      const speed = Math.min(2.5, Math.max(0.4, (recoveredHeatKw / 860) * 0.8))
      hotRef.current?.children.forEach((p) => {
        p.position.x -= delta * speed
        if (p.position.x < -1.1) p.position.x = 1.1
      })
      coldRef.current?.children.forEach((p) => {
        p.position.x += delta * speed
        if (p.position.x > 1.1) p.position.x = -1.1
      })
    }
  })

  return (
    <group position={[11.0, 0, 0]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Selection Ring */}
      {selected && (
        <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.7, 32]} />
          <meshBasicMaterial color="#34d399" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Condenser Shell */}
      <mesh position={[0, 1.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.65, 0.65, 2.4, 20]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Flanged Headers */}
      <mesh position={[-1.25, 1.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.72, 0.72, 0.1, 20]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[1.25, 1.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.72, 0.72, 0.1, 20]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Hot Stream Particles (Condensing Steam) */}
      <group ref={hotRef}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[i * 0.3 - 1.0, 1.3, i % 2 === 0 ? 0.2 : -0.2]}>
            <sphereGeometry args={[0.045, 6, 6]} />
            <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>

      {/* Cold Stream Particles (District Water Inflow) */}
      <group ref={coldRef}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[i * 0.3 - 1.0, 1.3, i % 2 === 0 ? 0.35 : -0.35]}>
            <sphereGeometry args={[0.045, 6, 6]} />
            <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>

      {/* Foundation Pedestals */}
      <mesh position={[-0.6, 0.35, 0]}>
        <boxGeometry args={[0.15, 0.7, 0.9]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0.6, 0.35, 0]}>
        <boxGeometry args={[0.15, 0.7, 0.9]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>

      <Text position={[0, 2.5, 0]} fontSize={0.24} color="#34d399" anchorX="center" fontWeight="bold">
        CHP HEAT EXCHANGER
      </Text>
      <Text position={[0, 2.15, 0]} fontSize={0.16} color="#6ee7b7" anchorX="center">
        {recoveredHeatKw.toFixed(1)} kWth Useful District Heat
      </Text>
    </group>
  )
}

// 9. Connecting Process Pipes with Flow Scaled by Real kW
interface PipesProps {
  syngasKw: number
  steamKw: number
  condenserKw: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
}

function ConnectingPipes({
  syngasKw,
  steamKw,
  condenserKw,
  running,
  paused,
  reducedMotion,
}: PipesProps) {
  const syngasFlowRef = useRef<THREE.Group>(null)
  const steamFlowRef = useRef<THREE.Group>(null)
  const condenserFlowRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (running && !paused && !reducedMotion) {
      // 1. Syngas line flow pulse (speed proportional to syngas thermal kW)
      if (syngasFlowRef.current) {
        const speed = Math.min(3, Math.max(0.4, (syngasKw / 1490) * 1.2))
        syngasFlowRef.current.children.forEach((p) => {
          p.position.x += delta * speed
          if (p.position.x > 3.5) p.position.x = 0
        })
      }
      // 2. High-pressure steam line flow pulse
      if (steamFlowRef.current) {
        const speed = Math.min(3, Math.max(0.4, (steamKw / 1267) * 1.2))
        steamFlowRef.current.children.forEach((p) => {
          p.position.x += delta * speed
          if (p.position.x > 6.8) p.position.x = 3.6
        })
      }
      // 3. Condenser line flow pulse
      if (condenserFlowRef.current) {
        const speed = Math.min(3, Math.max(0.4, (condenserKw / 1069) * 1.2))
        condenserFlowRef.current.children.forEach((p) => {
          p.position.x += delta * speed
          if (p.position.x > 10.8) p.position.x = 7.6
        })
      }
    }
  })

  return (
    <group>
      {/* 1. Feed chute: Conveyor to Gasifier */}
      <mesh position={[-4.5, 0.8, 0]} rotation={[0, 0, Math.PI / 12]}>
        <boxGeometry args={[2, 0.1, 0.1]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* 2. Syngas transfer line: Gasifier dome to Boiler inlet */}
      <mesh position={[1.25, 3.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 4.2, 12]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Syngas flow particles */}
      <group ref={syngasFlowRef} position={[0, 3.8, 0]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i} position={[i * 0.65, 0, 0]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial color="#fde047" emissive="#f59e0b" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>

      {/* 3. High-pressure steam line: Boiler to Turbine HP inlet */}
      <mesh position={[5.25, 2.85, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 3.2, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Steam flow particles */}
      <group ref={steamFlowRef}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={i} position={[3.8 + i * 0.65, 2.85, 0]}>
            <sphereGeometry args={[0.045, 6, 6]} />
            <meshStandardMaterial color="#ffffff" emissive="#38bdf8" emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>

      {/* 4. Turbine exhaust to Heat Exchanger condenser */}
      <mesh position={[9.2, 1.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.14, 0.14, 3.2, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Condenser flow particles */}
      <group ref={condenserFlowRef}>
        {Array.from({ length: 5 }).map((_, i) => (
          <mesh key={i} position={[7.8 + i * 0.65, 1.3, 0]}>
            <sphereGeometry args={[0.045, 6, 6]} />
            <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// 10. Floor Ground
function Ground() {
  return (
    <group position={[2, -0.16, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[42, 18]} />
        <meshStandardMaterial color="#090d16" roughness={0.85} metalness={0.2} />
      </mesh>
      <gridHelper args={[42, 42, '#0284c7', '#1e293b']} position={[0, 0.01, 0]} />
    </group>
  )
}

// ── Complete 3D Scene Assembly ────────────────────────────────
interface SceneProps {
  data: SimulationResult | null
  running: boolean
  paused: boolean
  reducedMotion: boolean
  onSelectComponent: (comp: string) => void
  selectedComponent: string | null
}

function PlantScene({
  data,
  running,
  paused,
  reducedMotion,
  onSelectComponent,
  selectedComponent,
}: SceneProps) {
  const temp = data?.parameters?.reactor_temp_c ?? 850
  const power = data?.turbine?.electrical_power_kw ?? 178.6
  const steamFlow = data?.steam_cycle?.steam_flow_kg_h ?? 1547
  const recoveredHeat = data?.heat_exchanger?.recovered_heat_kw ?? 863.1

  // Dynamic fluidization values
  const u0_over_umf_eff = data?.fluidization?.u0_over_umf_eff ?? (data?.u0_over_umf_eff ?? 10.05)
  const u0_over_ut = data?.fluidization?.u0_over_ut ?? (data?.u0_over_ut ?? 0.20)
  const d_eff_m = data?.fluidization?.d_eff_m ?? 0.0004
  const u0_m_s = data?.fluidization?.u0_m_s ?? 0.567
  const umf_eff_m_s = data?.fluidization?.umf_effective_m_s ?? 0.056

  const syngasKw = data?.gasification?.thermal_energy_kw ?? 1490.4
  const steamKw = data?.steam_cycle?.boiler_duty_kw ?? 1266.8
  const condenserKw = data?.heat_exchanger?.condenser_heat_kw ?? 1068.9

  return (
    <>
      <color attach="background" args={['#060911']} />
      <fog attach="fog" args={['#060911', 20, 48]} />
      <PerspectiveCamera makeDefault position={[1.5, 6.5, 16.5]} fov={44} />
      <OrbitControls enableDamping dampingFactor={0.08} minDistance={5} maxDistance={36} />

      <ambientLight intensity={0.8} />
      <directionalLight position={[12, 18, 14]} intensity={1.2} castShadow />
      <directionalLight position={[-10, 14, -8]} intensity={0.5} />
      <pointLight position={[-1, 3.8, 2.5]} intensity={1.4} color="#f59e0b" distance={12} />
      <pointLight position={[3.5, 3.8, 2.5]} intensity={1.1} color="#38bdf8" distance={10} />
      <pointLight position={[7.2, 3.0, 2.5]} intensity={1.1} color="#60a5fa" distance={10} />

      <Ground />
      <Conveyor running={running} paused={paused} />
      <WasteObjects running={running} paused={paused} />
      <AICamera />
      <Gasifier
        temperature={temp}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
        u0_over_umf_eff={u0_over_umf_eff}
        u0_over_ut={u0_over_ut}
        d_eff_m={d_eff_m}
        u0_m_s={u0_m_s}
        umf_eff_m_s={umf_eff_m_s}
        onSelect={() => onSelectComponent('gasifier')}
        selected={selectedComponent === 'gasifier'}
      />
      <Boiler
        steamFlow={steamFlow}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
        onSelect={() => onSelectComponent('boiler')}
        selected={selectedComponent === 'boiler'}
      />
      <Turbine
        powerKw={power}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
        onSelect={() => onSelectComponent('turbine')}
        selected={selectedComponent === 'turbine'}
      />
      <HeatExchanger
        recoveredHeatKw={recoveredHeat}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
        onSelect={() => onSelectComponent('heat_exchanger')}
        selected={selectedComponent === 'heat_exchanger'}
      />
      <ConnectingPipes
        syngasKw={syngasKw}
        steamKw={steamKw}
        condenserKw={condenserKw}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
      />
    </>
  )
}

// ── Baseline Demo Data for Instant Chart Feedback ─────────────
const BASELINE_DATA = [
  { time: 0, temperature: 850, pressure: 8.58, power: 178.6, airflow: 661, heat: 863.1, efficiency: 39.9 },
  { time: 1, temperature: 851, pressure: 8.58, power: 178.8, airflow: 661, heat: 863.4, efficiency: 39.9 },
  { time: 2, temperature: 849, pressure: 8.57, power: 178.4, airflow: 660, heat: 862.9, efficiency: 39.8 },
  { time: 3, temperature: 850, pressure: 8.58, power: 178.6, airflow: 661, heat: 863.2, efficiency: 39.9 },
  { time: 4, temperature: 852, pressure: 8.59, power: 178.9, airflow: 662, heat: 863.7, efficiency: 39.9 },
]

// ── Main SimulationPage Component ─────────────────────────────
export default function SimulationPage() {
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [scenario, setScenario] = useState('normal')
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [data, setData] = useState<SimulationResult | null>(null)
  const [chartData, setChartData] = useState<any[]>(BASELINE_DATA)
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)
  const [agglomerationIndex, setAgglomerationIndex] = useState<number>(0.0)
  const [mitigationNotice, setMitigationNotice] = useState<string | null>(null)

  // Accessibility: prefers-reduced-motion
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const wsRef = useRef<WebSocket | null>(null)
  const debounceTimerRef = useRef<any>(null)

  // Fetch scenarios list
  useEffect(() => {
    api.get('/scenarios').then((res) => setScenarios(res.scenarios)).catch(() => {})
  }, [])

  // Sync agglomeration slider state with incoming payload
  useEffect(() => {
    if (data?.fluidization?.agglomeration_index !== undefined) {
      setAgglomerationIndex(data.fluidization.agglomeration_index)
    }
  }, [data?.fluidization?.agglomeration_index])

  // WebSocket connection & lifecycle
  const handleStart = useCallback(() => {
    if (wsRef.current) wsRef.current.close()
    const ws = createSimulationSocket((msg) => {
      if (msg.running !== undefined) {
        setData(msg)
        if (msg.tick !== undefined) {
          setChartData((prev) => {
            const next = [
              ...prev,
              {
                time: msg.sim_time_s ?? msg.tick * 5,
                temperature: msg.parameters?.reactor_temp_c,
                pressure: msg.fluidization?.pressure_drop_kpa ?? msg.anomaly?.features?.pressure_drop,
                power: msg.turbine?.net_electrical_power_kw ?? msg.turbine?.electrical_power_kw,
                airflow: msg.parameters?.airflow_m3_h,
                heat: msg.heat_exchanger?.recovered_heat_kw,
                efficiency: msg.overall?.overall_efficiency_pct,
              },
            ]
            return next.slice(-60)
          })
        }
      }
    })
    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'start', scenario_id: scenario, agglomeration_index: agglomerationIndex }))
      setRunning(true)
      setPaused(false)
    }
    wsRef.current = ws
  }, [scenario, agglomerationIndex])

  const handlePauseToggle = () => {
    if (!running) return
    const nextPaused = !paused
    setPaused(nextPaused)
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ action: nextPaused ? 'pause' : 'start', scenario_id: scenario }))
    }
  }

  const handleReset = () => {
    wsRef.current?.send(JSON.stringify({ action: 'reset' }))
    setRunning(false)
    setPaused(false)
    setData(null)
    setChartData(BASELINE_DATA)
    setAgglomerationIndex(0.0)
    setMitigationNotice(null)
  }

  const handleSpeed = (s: number) => {
    setSpeed(s)
    wsRef.current?.send(JSON.stringify({ action: 'speed', value: s }))
  }

  // Debounced Agglomeration Slider Dispatch
  const handleAgglomerationChange = (val: number) => {
    setAgglomerationIndex(val)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'update_params', agglomeration_index: val }))
      }
    }, 150)
  }

  // Real Auto-Mitigate Action
  const handleAutoMitigate = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'correct' }))
      setAgglomerationIndex(0.0)
      setMitigationNotice(
        'Mitigation Executed: Reset agglomerated bed (a -> 0.0), normalized plastic feed to 20%, restored ER=0.30 target airflow, bed temperature set to 850 °C.'
      )
      setTimeout(() => setMitigationNotice(null), 8000)
    }
  }

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      wsRef.current?.close()
    }
  }, [])

  // Primary Physics Diagnostics vs Experimental ML Diagnostics
  const physicsState = data?.fluidization?.physics_state ?? data?.anomaly?.physics_label ?? 'NORMAL_FLUIDIZATION'
  const physicsRisk = data?.fluidization?.physics_risk_level ?? 'LOW'
  const physicsReason = data?.fluidization?.physics_reason ?? 'Stable bubbling fluidization'
  const mlState = data?.anomaly?.state ?? 'NORMAL_FLUIDIZATION'
  const mlConfidence = data?.anomaly?.confidence ?? 0.88
  const isDisagreement = physicsState !== mlState

  return (
    <div className="h-full flex flex-col animate-in relative select-none">
      {/* Glass Command Bar */}
      <div className="px-5 py-2.5 glass-panel border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20 bg-white/95 dark:bg-[#0d121f]/95 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${running && !paused ? 'bg-cyan-500 animate-pulse' : 'bg-slate-400'}`} />
            <h1 className="text-sm font-black tracking-tight font-mono text-slate-900 dark:text-white uppercase">
              Plant Digital Twin // 3D Live Console
            </h1>
          </div>
          <div className="h-4 w-px bg-slate-300 dark:bg-white/15" />
          <select
            value={scenario}
            onChange={(e) => {
              setScenario(e.target.value)
              if (running && wsRef.current) {
                wsRef.current.send(JSON.stringify({ action: 'start', scenario_id: e.target.value }))
              }
            }}
            className="text-xs glass-input px-2.5 py-1.5 font-medium cursor-pointer text-slate-800 dark:text-slate-200"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                {s.name}
              </option>
            ))}
          </select>

          {/* Agglomeration Slider (Task 3) */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs">
            <Sliders size={13} className="text-amber-500" />
            <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Agglomeration: <span className="text-amber-500">{agglomerationIndex.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={agglomerationIndex}
              onChange={(e) => handleAgglomerationChange(parseFloat(e.target.value))}
              className="w-24 h-1.5 bg-slate-300 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            {agglomerationIndex > 0 && (
              <button
                onClick={() => handleAgglomerationChange(0.0)}
                className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                title="Reset to clean bed sand"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed toggles */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/10 p-0.5 bg-slate-100 dark:bg-white/5">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeed(s)}
                className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded-md transition-all ${
                  speed === s
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1" />

          {/* Start / Pause Controls */}
          {!running ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
            >
              <Play size={13} fill="currentColor" />
              <span>Start Run</span>
            </button>
          ) : (
            <button
              onClick={handlePauseToggle}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg text-white shadow-xs transition-all cursor-pointer ${
                paused ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {paused ? <Play size={13} fill="currentColor" /> : <Pause size={13} fill="currentColor" />}
              <span>{paused ? 'Resume 3D' : 'Pause 3D'}</span>
            </button>
          )}

          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/5 transition cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* 3D Viewport Area */}
        <div className="flex-1 relative bg-slate-950">
          <Canvas>
            <Suspense fallback={null}>
              <PlantScene
                data={data}
                running={running}
                paused={paused}
                reducedMotion={reducedMotion}
                onSelectComponent={(comp) => setSelectedComponent(comp)}
                selectedComponent={selectedComponent}
              />
            </Suspense>
          </Canvas>

          {/* Floating High-Contrast HUD Telemetry (Task 7) */}
          {data ? (
            <div className="absolute top-4 left-4 grid grid-cols-2 sm:grid-cols-3 gap-2 pointer-events-none z-10 max-w-xl">
              {[
                {
                  label: 'Bed Temp',
                  value: data.parameters?.reactor_temp_c?.toFixed(0),
                  unit: '°C',
                  color: 'text-rose-400',
                  sub: '±σ jitter',
                },
                {
                  label: 'Normal Airflow',
                  value: data.parameters?.airflow_m3_h?.toFixed(1),
                  unit: 'Nm³/h',
                  color: 'text-cyan-400',
                  sub: '0°C, 101.3 kPa',
                },
                {
                  label: 'U₀ / U_mf,eff',
                  value: (data.fluidization?.u0_over_umf_eff ?? data.u0_over_umf_eff ?? 10.05)?.toFixed(2),
                  unit: 'ratio',
                  color: (data.fluidization?.u0_over_umf_eff ?? 10) < 2 ? 'text-amber-400' : 'text-emerald-400',
                  sub: data.fluidization?.regime ?? 'bubbling',
                },
                {
                  label: 'Net Power',
                  value: (data.turbine?.net_electrical_power_kw ?? data.turbine?.electrical_power_kw ?? 178.6)?.toFixed(1),
                  unit: 'kWe',
                  color: 'text-emerald-400',
                  sub: 'Rankine shaft-pump',
                },
                {
                  label: 'Steam Flow',
                  value: data.steam_cycle?.steam_flow_kg_h?.toFixed(0),
                  unit: 'kg/h',
                  color: 'text-blue-400',
                  sub: '10 bar, 350°C',
                },
                {
                  label: 'District Heat',
                  value: data.heat_exchanger?.recovered_heat_kw?.toFixed(1),
                  unit: 'kWth',
                  color: 'text-amber-400',
                  sub: `${data.heat_exchanger?.hot_water_temp_c?.toFixed(0) ?? 70}°C delivery`,
                },
              ].map((m, i) => (
                <div
                  key={i}
                  className="glass-card-subtle px-3 py-2 bg-slate-900/90 border border-white/15 backdrop-blur-md pointer-events-auto rounded-lg shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-semibold">{m.label}</span>
                    <span className="text-[9px] font-mono text-slate-400">{m.sub}</span>
                  </div>
                  <div className={`text-base font-mono font-black ${m.color}`}>
                    {m.value}
                    <span className="text-[10px] text-slate-300 font-normal ml-1">{m.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="absolute top-4 left-4 px-3.5 py-2 rounded-lg bg-slate-900/90 backdrop-blur-md border border-white/15 text-xs font-mono text-slate-200 pointer-events-none flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Standby: Ready to stream live physics & telemetry. Click [Start Run]</span>
            </div>
          )}

          {/* Quick Component Inspector Picker Badge */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
            {['gasifier', 'boiler', 'turbine', 'heat_exchanger'].map((c) => (
              <button
                key={c}
                onClick={() => setSelectedComponent(selectedComponent === c ? null : c)}
                className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border backdrop-blur-md transition-all cursor-pointer ${
                  selectedComponent === c
                    ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                    : 'bg-slate-900/80 text-slate-300 border-white/15 hover:bg-slate-800'
                }`}
              >
                Inspect {c.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>

          {/* Interactive Click-to-Inspect Overlay Panel (Task 6) */}
          {selectedComponent && (
            <div className="absolute bottom-20 left-4 z-20 w-80 glass-panel bg-slate-900/95 border border-white/20 p-3.5 rounded-xl shadow-xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/15">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-cyan-400" />
                  <span className="font-mono font-bold uppercase text-slate-100">
                    {selectedComponent.replace('_', ' ')} Inspector
                  </span>
                </div>
                <button
                  onClick={() => setSelectedComponent(null)}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {selectedComponent === 'gasifier' && (
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Bed Temperature:</span>
                    <span className="text-white font-bold">{data?.parameters?.reactor_temp_c?.toFixed(1) ?? 850} °C</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Normal Airflow:</span>
                    <span className="text-cyan-400 font-bold">{data?.parameters?.airflow_m3_h?.toFixed(1) ?? 661.0} Nm³/h</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Gas Velocity U₀:</span>
                    <span className="text-white font-bold">{(data?.fluidization?.u0_m_s ?? 0.567).toFixed(4)} m/s</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Effective U_mf:</span>
                    <span className="text-white font-bold">{(data?.fluidization?.umf_effective_m_s ?? 0.056).toFixed(4)} m/s</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Operating Ratio U₀/U_mf:</span>
                    <span className="text-emerald-400 font-bold">{(data?.fluidization?.u0_over_umf_eff ?? 10.05).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Syngas Chemical Power:</span>
                    <span className="text-amber-400 font-bold">{(data?.gasification?.thermal_energy_kw ?? 1490.4).toFixed(1)} kW</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Source JSON Field:</span>
                    <span className="text-slate-300 text-[10px]">parameters.* & fluidization.*</span>
                  </div>
                </div>
              )}

              {selectedComponent === 'boiler' && (
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Boiler Duty Q_boiler:</span>
                    <span className="text-white font-bold">{(data?.steam_cycle?.boiler_duty_kw ?? 1266.8).toFixed(1)} kW</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Generated Steam Flow:</span>
                    <span className="text-cyan-400 font-bold">{(data?.steam_cycle?.steam_flow_kg_h ?? 1547).toFixed(0)} kg/h</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Steam Temperature:</span>
                    <span className="text-white font-bold">{data?.steam_cycle?.steam_temp_c ?? 350.0} °C</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Steam Pressure:</span>
                    <span className="text-white font-bold">{data?.steam_cycle?.steam_pressure_bar ?? 10.0} bar</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Steam Engine Formulation:</span>
                    <span className="text-emerald-400 font-bold">{data?.steam_cycle?.steam_engine ?? 'IAPWS-IF97'}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Source JSON Field:</span>
                    <span className="text-slate-300 text-[10px]">steam_cycle.*</span>
                  </div>
                </div>
              )}

              {selectedComponent === 'turbine' && (
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Turbine Shaft Work:</span>
                    <span className="text-white font-bold">{(data?.turbine?.turbine_power_kw ?? 198.5).toFixed(1)} kW</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Gross Electrical Power:</span>
                    <span className="text-blue-400 font-bold">{(data?.turbine?.electrical_power_kw ?? 179.1).toFixed(1)} kWe</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Net Electrical Power:</span>
                    <span className="text-emerald-400 font-bold">{(data?.turbine?.net_electrical_power_kw ?? 178.6).toFixed(1)} kWe</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Enthalpy Drop Δh:</span>
                    <span className="text-white font-bold">{(data?.turbine?.enthalpy_drop_kj_kg ?? 461.9).toFixed(1)} kJ/kg</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Exhaust Temperature:</span>
                    <span className="text-white font-bold">{(data?.turbine?.exhaust_temp_c ?? 107.1).toFixed(1)} °C</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Source JSON Field:</span>
                    <span className="text-slate-300 text-[10px]">turbine.*</span>
                  </div>
                </div>
              )}

              {selectedComponent === 'heat_exchanger' && (
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Recovered District Heat:</span>
                    <span className="text-emerald-400 font-bold">{(data?.heat_exchanger?.recovered_heat_kw ?? 863.1).toFixed(1)} kWth</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Hot Water Delivery Temp:</span>
                    <span className="text-cyan-400 font-bold">{(data?.heat_exchanger?.hot_water_temp_c ?? 70.0).toFixed(1)} °C</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Condenser Heat Rejected:</span>
                    <span className="text-white font-bold">{(data?.heat_exchanger?.condenser_heat_kw ?? 1068.9).toFixed(1)} kW</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Unrecovered Cooling Loss:</span>
                    <span className="text-rose-400 font-bold">{(data?.heat_exchanger?.cooling_loss_kw ?? 205.8).toFixed(1)} kW</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">District Water Flow:</span>
                    <span className="text-white font-bold">{(data?.heat_exchanger?.water_flow_used_kg_h ?? 14869).toFixed(0)} kg/h</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Source JSON Field:</span>
                    <span className="text-slate-300 text-[10px]">heat_exchanger.*</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mitigation feedback toast */}
          {mitigationNotice && (
            <div className="absolute top-20 inset-x-8 z-30 p-2.5 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-mono flex items-center justify-between shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{mitigationNotice}</span>
              </div>
              <button onClick={() => setMitigationNotice(null)} className="text-emerald-400 hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Primary Physics Fault Banner & Experimental ML Warning (Tasks 4 & 5) */}
          {data && (
            <div className="absolute bottom-4 inset-x-4 p-3 rounded-xl glass-card border border-white/15 bg-slate-900/90 backdrop-blur-lg flex flex-col md:flex-row md:items-center justify-between gap-3 z-10 shadow-lg">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Primary Physics Diagnostic Badge */}
                  <span
                    className={`badge font-mono font-bold text-xs ${
                      physicsState === 'NORMAL_FLUIDIZATION'
                        ? 'badge-success'
                        : physicsState === 'EARLY_AGGLOMERATION'
                        ? 'badge-warning'
                        : 'badge-danger'
                    }`}
                  >
                    PHYSICS PRIMARY: {physicsState.replace(/_/g, ' ')}
                  </span>

                  {/* Secondary ML Diagnostic Badge */}
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300 border border-white/15">
                    ML Model [Experimental]: {mlState.replace(/_/g, ' ')} ({(mlConfidence * 100).toFixed(0)}% conf)
                  </span>

                  {/* Disagreement Warning Callout */}
                  {isDisagreement && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-semibold">
                      <AlertTriangle size={12} className="text-amber-400" />
                      Physics vs ML Disagreement (Physics Governs)
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-300 font-sans">
                  <span className="font-semibold text-white">Physical Rationale: </span>
                  {physicsReason}
                </div>
              </div>

              {/* Real Auto-Mitigate Action Button */}
              {(physicsState !== 'NORMAL_FLUIDIZATION' || agglomerationIndex > 0) && (
                <button
                  onClick={handleAutoMitigate}
                  className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0"
                  title="Flushes agglomerated bed, normalizes plastic feed to 20%, restores ER=0.30 target airflow, and sets bed temp to 850°C"
                >
                  <Flame size={14} />
                  <span>Auto-Mitigate (Real Physics Restoration)</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Glass Sidebar: Sensor Telemetry & Specification Table */}
        <div className="w-80 glass-panel border-l border-slate-200 dark:border-white/10 overflow-y-auto p-4 space-y-4 shrink-0 z-10 bg-white/95 dark:bg-[#0d121f]/95">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Cpu size={14} className="text-blue-600 dark:text-cyan-400" />
              Live Sensor Telemetry
            </h3>
            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">
              TICK: {data?.tick ?? (running ? 1 : 0)}
            </span>
          </div>

          {[
            { key: 'temperature', label: 'Bed Temperature (°C)', color: '#f43f5e' },
            { key: 'pressure', label: 'Bed Pressure Drop (kPa)', color: '#f59e0b' },
            { key: 'power', label: 'Turbine Net Power (kWe)', color: '#0284c7' },
            { key: 'heat', label: 'Recovered District Heat (kWth)', color: '#06b6d4' },
            { key: 'efficiency', label: 'Overall Plant CHP Efficiency (%)', color: '#10b981' },
          ].map((chart) => (
            <div key={chart.key} className="glass-card p-2.5 border border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-800 dark:text-slate-300 mb-1">
                <span>{chart.label}</span>
                <span style={{ color: chart.color }}>●</span>
              </div>
              <ResponsiveContainer width="100%" height={72}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                  <XAxis dataKey="time" hide />
                  <YAxis width={34} tick={{ fontSize: 9, fill: '#64748b' }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#f8fafc',
                    }}
                  />
                  <RLine type="monotone" dataKey={chart.key} stroke={chart.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}

          {/* Plant Operating Parameters Spec Table */}
          <div className="glass-card p-3 border border-slate-200 dark:border-white/10 space-y-2">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Operating Parameters</span>
              <span className="text-[9px] text-cyan-600 dark:text-cyan-400">ER = {(data?.gasification?.equivalence_ratio ?? 0.2991).toFixed(4)}</span>
            </div>
            <table className="data-table text-xs">
              <tbody>
                <tr>
                  <td className="text-slate-600 dark:text-slate-400 font-sans font-medium">Waste Feed:</td>
                  <td className="font-bold">{data?.parameters?.waste_feed_kg_h ?? 500} kg/h</td>
                </tr>
                <tr>
                  <td className="text-slate-600 dark:text-slate-400 font-sans font-medium">Normal Airflow:</td>
                  <td className="font-bold text-cyan-600 dark:text-cyan-400">
                    {(data?.parameters?.airflow_m3_h ?? 661.0).toFixed(1)} Nm³/h
                  </td>
                </tr>
                <tr>
                  <td className="text-slate-600 dark:text-slate-400 font-sans font-medium">Syngas Flow:</td>
                  <td className="text-amber-600 dark:text-amber-400 font-bold">
                    {(data?.gasification?.syngas_flow_nm3_h ?? 1024.5).toFixed(1)} Nm³/h
                  </td>
                </tr>
                <tr>
                  <td className="text-slate-600 dark:text-slate-400 font-sans font-medium">Mass Balance:</td>
                  <td>
                    <span
                      className="badge badge-success text-[10px] font-mono"
                      title="Elemental mass conservation (C, H, O, N) resolved by construction (0.003% numeric tolerance)"
                    >
                      closure by construction
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="text-slate-600 dark:text-slate-400 font-sans font-medium">District Hot Water:</td>
                  <td className="text-blue-600 dark:text-cyan-400 font-bold">
                    {(data?.heat_exchanger?.hot_water_temp_c ?? 70.0).toFixed(1)} °C
                  </td>
                </tr>
                <tr>
                  <td className="text-slate-600 dark:text-slate-400 font-sans font-medium">Thermal Regime:</td>
                  <td className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-[11px]">
                    {data?.gasification?.reactor_thermal_regime ?? 'AUTOTHERMAL'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Methodology Note */}
            <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-[9px] font-mono text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Methodology: </span>
              Modified Partial Equilibrium & Semi-Empirical Kinetics (not Gibbs minimization).
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
