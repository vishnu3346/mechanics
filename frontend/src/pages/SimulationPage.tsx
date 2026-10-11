import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, PerspectiveCamera } from '@react-three/drei'
import { api, createSimulationSocket } from '../services/api'
import type { SimulationResult, Scenario } from '../types'
import { Play, Pause, RotateCcw, Cpu, Sparkles } from 'lucide-react'
import { LineChart, Line as RLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import * as THREE from 'three'

// ── 3D Plant Components ──────────────────────────────────────

function Conveyor({ running }: { running: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const beltRef = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (running && beltRef.current) {
      const mat = beltRef.current.material as THREE.MeshStandardMaterial
      if (mat.map) mat.map.offset.x += delta * 0.3
    }
  })
  return (
    <group ref={ref} position={[-8, 0.3, 0]}>
      {/* Belt structure */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[6, 0.15, 1.2]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Supports */}
      {[-2.5, 0, 2.5].map((x, i) => (
        <mesh key={i} position={[x, -0.4, 0]}>
          <boxGeometry args={[0.12, 0.7, 1.3]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* Side rails */}
      <mesh position={[0, 0.15, 0.65]}>
        <boxGeometry args={[6, 0.2, 0.06]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.15, -0.65]}>
        <boxGeometry args={[6, 0.2, 0.06]} />
        <meshStandardMaterial color="#64748b" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Rollers */}
      {[-2.8, -1.4, 0, 1.4, 2.8].map((x, i) => (
        <mesh key={`r${i}`} position={[x, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.2, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <Text position={[0, 1.4, 0]} fontSize={0.22} color="#94a3b8" anchorX="center" fontWeight="bold">
        SORTING CONVEYOR
      </Text>
    </group>
  )
}

function WasteObjects({ running }: { running: boolean }) {
  const ref = useRef<THREE.Group>(null)
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    if (running) timeRef.current += delta
    if (ref.current) {
      ref.current.children.forEach((child, i) => {
        const speed = 0.8
        const offset = i * 1.5
        let x = ((timeRef.current * speed + offset) % 8) - 7
        child.position.x = x
        child.rotation.y += delta * 0.3
        child.visible = x < 5 && x > -11
      })
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

function AICamera() {
  return (
    <group position={[-5, 2.2, 0]}>
      {/* Camera body */}
      <mesh>
        <boxGeometry args={[0.5, 0.35, 0.3]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Lens */}
      <mesh position={[0, -0.1, 0.18]}>
        <cylinderGeometry args={[0.1, 0.12, 0.1, 12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Scan beam */}
      <mesh position={[0, -0.9, 0]}>
        <coneGeometry args={[0.8, 1.5, 4]} />
        <meshStandardMaterial color="#06b6d4" transparent opacity={0.15} wireframe />
      </mesh>
      {/* Mount */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
      </mesh>
      <Text position={[0, 0.8, 0]} fontSize={0.2} color="#38bdf8" anchorX="center" fontWeight="bold">
        AI OPTICAL SCANNER
      </Text>
    </group>
  )
}

function Gasifier({ temperature, running }: { temperature: number; running: boolean }) {
  const particlesRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (particlesRef.current && running) {
      particlesRef.current.children.forEach((p, i) => {
        p.position.y += delta * (0.5 + i * 0.1)
        if (p.position.y > 2.5) p.position.y = -0.5
        p.position.x += Math.sin(Date.now() * 0.003 + i) * delta * 0.15
      })
    }
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial
      const intensity = running ? Math.min(1, temperature / 900) : 0.2
      mat.emissiveIntensity = intensity * (0.8 + Math.sin(Date.now() * 0.005) * 0.2)
    }
  })

  const heatColor = temperature > 800 ? '#ef4444' : temperature > 700 ? '#f59e0b' : '#64748b'

  return (
    <group position={[-1, 0, 0]}>
      {/* Main reactor vessel */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[1.1, 1.2, 3, 20]} />
        <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.25} />
      </mesh>
      {/* Top dome */}
      <mesh position={[0, 3.0, 0]}>
        <sphereGeometry args={[1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.25} />
      </mesh>
      {/* Inner glow */}
      <mesh ref={glowRef} position={[0, 1, 0]}>
        <cylinderGeometry args={[0.95, 1.05, 2, 16]} />
        <meshStandardMaterial color={heatColor} emissive={heatColor} emissiveIntensity={0.6} transparent opacity={0.35} />
      </mesh>
      {/* Fluidized bed particles */}
      <group ref={particlesRef}>
        {Array.from({ length: 20 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              (Math.random() - 0.5) * 1.5,
              Math.random() * 2,
              (Math.random() - 0.5) * 1.5,
            ]}
          >
            <sphereGeometry args={[0.045, 6, 6]} />
            <meshStandardMaterial color={i % 2 === 0 ? '#fbbf24' : '#fb923c'} emissive={heatColor} emissiveIntensity={0.4} />
          </mesh>
        ))}
      </group>
      {/* Air inlet */}
      <mesh position={[-1.3, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 0.6, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Base support ring */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[1.35, 1.35, 0.15, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
      </mesh>
      <Text position={[0, 4.3, 0]} fontSize={0.25} color="#38bdf8" anchorX="center" fontWeight="bold">
        FLUIDIZED GASIFIER
      </Text>
    </group>
  )
}

function Boiler({ running }: { running: boolean }) {
  const steamRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (steamRef.current && running) {
      steamRef.current.children.forEach((p) => {
        p.position.y += delta * 0.4
        if (p.position.y > 1.5) p.position.y = 0
        const mat = (p as any).material as THREE.MeshStandardMaterial
        mat.opacity = Math.max(0, 0.4 - p.position.y * 0.25)
      })
    }
  })

  return (
    <group position={[3.5, 0, 0]}>
      {/* Boiler shell */}
      <mesh position={[0, 1.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.85, 0.85, 2.5, 20]} />
        <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.3} />
      </mesh>
      {/* End caps */}
      <mesh position={[-1.25, 1.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <sphereGeometry args={[0.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[1.25, 1.8, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <sphereGeometry args={[0.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.3} />
      </mesh>
      {/* Steam dome */}
      <mesh position={[0, 2.75, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 0.5, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Steam particles */}
      <group ref={steamRef} position={[0, 3.1, 0]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[(Math.random() - 0.5) * 0.3, Math.random() * 1.5, (Math.random() - 0.5) * 0.3]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial color="#e2e8f0" transparent opacity={0.3} />
          </mesh>
        ))}
      </group>
      {/* Supports */}
      <mesh position={[-0.6, 0.5, 0]}>
        <boxGeometry args={[0.15, 1, 0.15]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.6, 0.5, 0]}>
        <boxGeometry args={[0.15, 1, 0.15]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
      </mesh>
      <Text position={[0, 3.9, 0]} fontSize={0.25} color="#f59e0b" anchorX="center" fontWeight="bold">
        HRSG STEAM BOILER
      </Text>
    </group>
  )
}

function Turbine({ power, running }: { power: number; running: boolean }) {
  const bladeRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (bladeRef.current && running) {
      bladeRef.current.rotation.z += delta * Math.max(1, power * 0.05)
    }
  })

  return (
    <group position={[7, 0, 0]}>
      {/* Turbine casing */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.9, 0.7, 1.8, 16]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.65} roughness={0.25} />
      </mesh>
      {/* Visible blade */}
      <mesh ref={bladeRef} position={[0, 2.6, 0]}>
        <torusGeometry args={[0.3, 0.03, 8, 3]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Generator */}
      <mesh position={[0, 1.5, 1.2]}>
        <cylinderGeometry args={[0.5, 0.5, 0.8, 14]} />
        <meshStandardMaterial color="#1e3a8a" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Foundation */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[2, 0.2, 1.5]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
      </mesh>
      <Text position={[0, 3.3, 0]} fontSize={0.25} color="#60a5fa" anchorX="center" fontWeight="bold">
        STEAM TURBINE & GEN
      </Text>
    </group>
  )
}

function HeatExchanger({ running }: { running: boolean }) {
  const hotRef = useRef<THREE.Group>(null)
  const coldRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (running) {
      hotRef.current?.children.forEach((p) => {
        p.position.x -= delta * 0.5
        if (p.position.x < -1) p.position.x = 1
      })
      coldRef.current?.children.forEach((p) => {
        p.position.x += delta * 0.5
        if (p.position.x > 1) p.position.x = -1
      })
    }
  })

  return (
    <group position={[10.5, 0, 0]}>
      {/* Shell */}
      <mesh position={[0, 1.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 2.2, 14]} />
        <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.3} />
      </mesh>
      {/* Hot particles */}
      <group ref={hotRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i} position={[i / 3 - 1, 1.3, i % 2 === 0 ? 0.15 : -0.15]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
      {/* Cold particles */}
      <group ref={coldRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={i} position={[i / 3 - 1, 1.3, i % 2 === 0 ? 0.3 : -0.3]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} />
          </mesh>
        ))}
      </group>
      {/* Supports */}
      <mesh position={[-0.5, 0.35, 0]}>
        <boxGeometry args={[0.1, 0.7, 0.8]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.5, 0.35, 0]}>
        <boxGeometry args={[0.1, 0.7, 0.8]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
      </mesh>
      <Text position={[0, 2.4, 0]} fontSize={0.23} color="#34d399" anchorX="center" fontWeight="bold">
        CHP HEAT EXCHANGER
      </Text>
    </group>
  )
}

function ConnectingPipes() {
  return (
    <group>
      {/* Conveyor to gasifier */}
      <mesh position={[-4.5, 0.8, 0]} rotation={[0, 0, Math.PI / 12]}>
        <boxGeometry args={[2, 0.08, 0.08]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Gasifier to boiler (syngas) */}
      <mesh position={[1.25, 3.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 4, 8]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Boiler to turbine (steam) */}
      <mesh position={[5.25, 2.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 3, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Turbine to heat exchanger */}
      <mesh position={[8.75, 1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 3, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

function Ground() {
  return (
    <group position={[1.5, -0.15, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[38, 16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} metalness={0.2} />
      </mesh>
      <gridHelper args={[38, 38, '#0ea5e9', '#334155']} position={[0, 0.01, 0]} />
    </group>
  )
}

function PlantScene({ data, running }: { data: SimulationResult | null; running: boolean }) {
  const temp = data?.parameters?.reactor_temp_c || 850
  const power = data?.turbine?.electrical_power_kw || 0

  return (
    <>
      <color attach="background" args={['#080c16']} />
      <fog attach="fog" args={['#080c16', 18, 42]} />
      <PerspectiveCamera makeDefault position={[1, 6, 15]} fov={46} />
      <OrbitControls enableDamping dampingFactor={0.1} minDistance={6} maxDistance={32} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 16, 12]} intensity={1.1} castShadow />
      <directionalLight position={[-8, 12, -6]} intensity={0.5} />
      <pointLight position={[-1, 3.5, 2]} intensity={1.2} color="#fbbf24" distance={9} />
      <pointLight position={[3.5, 3.5, 2]} intensity={1.0} color="#38bdf8" distance={9} />

      <Ground />
      <Conveyor running={running} />
      <WasteObjects running={running} />
      <AICamera />
      <Gasifier temperature={temp} running={running} />
      <Boiler running={running} />
      <Turbine power={power} running={running} />
      <HeatExchanger running={running} />
      <ConnectingPipes />
    </>
  )
}

// ── Baseline Demo Data for Instant Visual Feedback ────────────
const BASELINE_DATA = [
  { time: 0, temperature: 846, pressure: 15.0, power: 13.1, airflow: 120, heat: 17.1, efficiency: 58.4 },
  { time: 1, temperature: 848, pressure: 15.1, power: 13.3, airflow: 120, heat: 17.2, efficiency: 58.8 },
  { time: 2, temperature: 850, pressure: 15.2, power: 13.5, airflow: 120, heat: 17.4, efficiency: 59.2 },
  { time: 3, temperature: 851, pressure: 15.2, power: 13.5, airflow: 121, heat: 17.4, efficiency: 59.1 },
  { time: 4, temperature: 850, pressure: 15.2, power: 13.5, airflow: 120, heat: 17.4, efficiency: 59.0 },
]

export default function SimulationPage() {
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [scenario, setScenario] = useState('normal')
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [data, setData] = useState<SimulationResult | null>(null)
  const [chartData, setChartData] = useState<any[]>(BASELINE_DATA)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    api.get('/scenarios').then((res) => setScenarios(res.scenarios)).catch(() => {})
  }, [])

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
                time: msg.sim_time_s,
                temperature: msg.parameters?.reactor_temp_c,
                pressure: msg.anomaly?.features?.pressure_drop,
                power: msg.turbine?.electrical_power_kw,
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
      ws.send(JSON.stringify({ action: 'start', scenario_id: scenario }))
      setRunning(true)
    }
    wsRef.current = ws
  }, [scenario])

  const handlePause = () => {
    wsRef.current?.send(JSON.stringify({ action: 'pause' }))
    setRunning(false)
  }

  const handleReset = () => {
    wsRef.current?.send(JSON.stringify({ action: 'reset' }))
    setRunning(false)
    setData(null)
    setChartData(BASELINE_DATA)
  }

  const handleSpeed = (s: number) => {
    setSpeed(s)
    wsRef.current?.send(JSON.stringify({ action: 'speed', value: s }))
  }

  useEffect(() => {
    return () => {
      wsRef.current?.close()
    }
  }, [])

  return (
    <div className="h-full flex flex-col animate-in relative">
      {/* Glass Command Bar */}
      <div className="px-5 py-3 glass-panel border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20 bg-white/95 dark:bg-[#0d121f]/95 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
            <h1 className="text-sm font-black tracking-tight font-mono text-slate-900 dark:text-white uppercase">
              Plant Digital Twin // 3D Live Console
            </h1>
          </div>
          <div className="h-4 w-px bg-slate-300 dark:bg-white/15" />
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="text-xs glass-input px-2.5 py-1.5 font-medium cursor-pointer text-slate-800 dark:text-slate-200"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed toggles */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/10 p-0.5 bg-slate-100 dark:bg-white/5">
            {[1, 2, 5].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeed(s)}
                className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-md transition-all ${
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

          {!running ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all cursor-pointer"
            >
              <Play size={13} fill="currentColor" />
              <span>Start Run</span>
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all cursor-pointer"
            >
              <Pause size={13} fill="currentColor" />
              <span>Pause</span>
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
        {/* 3D Viewport */}
        <div className="flex-1 relative bg-slate-950">
          <Canvas>
            <Suspense fallback={null}>
              <PlantScene data={data} running={running} />
            </Suspense>
          </Canvas>

          {/* Floating Glass Telemetry HUD */}
          {data ? (
            <div className="absolute top-4 left-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5 pointer-events-none z-10 max-w-lg">
              {[
                { label: 'Bed Temp', value: data.parameters?.reactor_temp_c?.toFixed(0), unit: '°C', color: 'text-rose-400' },
                { label: 'Airflow', value: data.parameters?.airflow_m3_h?.toFixed(0), unit: 'm³/h', color: 'text-cyan-400' },
                { label: 'Net Gen', value: data.turbine?.electrical_power_kw?.toFixed(1), unit: 'kWe', color: 'text-emerald-400' },
                { label: 'Steam Flow', value: data.steam_cycle?.steam_flow_kg_h?.toFixed(0), unit: 'kg/h', color: 'text-blue-400' },
                { label: 'Useful Heat', value: data.heat_exchanger?.recovered_heat_kw?.toFixed(1), unit: 'kWth', color: 'text-amber-400' },
                { label: 'CHP Eff.', value: data.overall?.overall_efficiency_pct?.toFixed(1), unit: '%', color: 'text-indigo-400' },
              ].map((m, i) => (
                <div
                  key={i}
                  className="glass-card-subtle px-3 py-2 bg-slate-900/85 border border-white/10 backdrop-blur-md pointer-events-auto"
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{m.label}</div>
                  <div className={`text-base font-mono font-bold ${m.color}`}>
                    {m.value}
                    <span className="text-[10px] text-slate-400 font-normal ml-0.5">{m.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="absolute top-4 left-4 px-3.5 py-2 rounded-lg bg-slate-900/85 backdrop-blur-md border border-white/10 text-xs font-mono text-slate-200 pointer-events-none flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Standby: Ready to stream live physics & telemetry. Click [Start Run]</span>
            </div>
          )}

          {/* Anomaly Alarm Floating Banner */}
          {data && data.anomaly?.state !== 'NORMAL_FLUIDIZATION' && (
            <div className="absolute bottom-4 inset-x-4 p-3 rounded-xl glass-card border border-rose-500/40 bg-rose-500/20 backdrop-blur-lg flex items-center justify-between gap-3 z-10">
              <div className="flex items-center gap-2.5">
                <span className="badge badge-danger font-mono font-bold">
                  {data.anomaly?.state?.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-rose-200 font-medium">
                  {data.anomaly?.recommendation}
                </span>
              </div>
              <button
                onClick={() => {
                  wsRef.current?.send(JSON.stringify({ action: 'correct' }))
                }}
                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs whitespace-nowrap cursor-pointer"
              >
                Auto-Mitigate
              </button>
            </div>
          )}
        </div>

        {/* Right Glass Sidebar: Real-Time Charts & Live Telemetry */}
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
            { key: 'pressure', label: 'Pressure Drop (kPa)', color: '#f59e0b' },
            { key: 'power', label: 'Turbine Power (kWe)', color: '#0284c7' },
            { key: 'heat', label: 'Recovered Heat (kWth)', color: '#06b6d4' },
            { key: 'efficiency', label: 'Overall CHP Efficiency (%)', color: '#10b981' },
          ].map((chart) => (
            <div key={chart.key} className="glass-card p-2.5 border border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-800 dark:text-slate-300 mb-1">
                <span>{chart.label}</span>
                <span style={{ color: chart.color }}>●</span>
              </div>
              <ResponsiveContainer width="100%" height={75}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                  <XAxis dataKey="time" hide />
                  <YAxis width={32} tick={{ fontSize: 9, fill: '#64748b' }} domain={['auto', 'auto']} />
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

          {/* Plant Live Metrics Spec Table */}
          <div className="glass-card p-3 border border-slate-200 dark:border-white/10 space-y-2">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Operating Parameters
            </div>
            <table className="data-table">
              <tbody>
                <tr>
                  <td className="text-slate-600 dark:text-slate-400 font-sans font-medium">Waste Feed:</td>
                  <td className="font-bold">{data?.parameters?.waste_feed_kg_h ?? 100} kg/h</td>
                </tr>
                <tr>
                  <td className="text-slate-600 dark:text-slate-400 font-sans font-medium">Moisture:</td>
                  <td className="font-bold">{data?.parameters?.moisture_pct ?? 15}%</td>
                </tr>
                <tr>
                  <td className="text-slate-600 dark:text-slate-400 font-sans font-medium">Syngas Flow:</td>
                  <td className="text-amber-600 dark:text-amber-400 font-bold">
                    {(data?.gasification?.syngas_flow_nm3_h ?? 240.1).toFixed(1)} Nm³/h
                  </td>
                </tr>
                <tr>
                  <td className="text-slate-600 dark:text-slate-400 font-sans font-medium">Mass Balance:</td>
                  <td>
                    <span className="badge badge-success">
                      {data?.mass_balance?.status ?? 'PASS'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="text-slate-600 dark:text-slate-400 font-sans font-medium">Hot Water Temp:</td>
                  <td className="text-blue-600 dark:text-cyan-400 font-bold">
                    {(data?.heat_exchanger?.hot_water_temp_c ?? 85.0).toFixed(1)}°C
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
