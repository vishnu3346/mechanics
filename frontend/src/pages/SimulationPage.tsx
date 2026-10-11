import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
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
  X,
  Flame,
  Camera,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  Activity,
} from 'lucide-react'
import { LineChart, Line as RLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { PlantScene } from '../components/simulation3d/PlantScene'
import { CAMERA_PRESETS, type CameraPreset } from '../components/simulation3d/types'
import { useTheme } from '../context/ThemeContext'

// ── Baseline Demo Data for Instant Chart Feedback ─────────────
const BASELINE_DATA = [
  { time: 0, temperature: 850, pressure: 8.58, power: 178.6, airflow: 661, heat: 863.1, efficiency: 39.9 },
  { time: 1, temperature: 851, pressure: 8.58, power: 178.8, airflow: 661, heat: 863.4, efficiency: 39.9 },
  { time: 2, temperature: 849, pressure: 8.57, power: 178.4, airflow: 660, heat: 862.9, efficiency: 39.8 },
  { time: 3, temperature: 850, pressure: 8.58, power: 178.6, airflow: 661, heat: 863.2, efficiency: 39.9 },
  { time: 4, temperature: 852, pressure: 8.59, power: 178.9, airflow: 662, heat: 863.7, efficiency: 39.9 },
]

export default function SimulationPage() {
  const { resolvedTheme } = useTheme()
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
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview')

  // Collapsible Overlay Controls (Clean scene by default)
  const [kpiExpanded, setKpiExpanded] = useState(true)
  const [physicsBannerExpanded, setPhysicsBannerExpanded] = useState(true)

  // Accessibility: prefers-reduced-motion
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Keyboard accessibility: ESC closes inspector and deselects component
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedComponent(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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

  // Selecting a unit eases camera to it as well
  const handleSelectUnit = (unitId: string | null) => {
    setSelectedComponent(unitId)
    if (unitId && unitId in CAMERA_PRESETS) {
      setCameraPreset(unitId as CameraPreset)
    } else if (unitId === null) {
      setCameraPreset('overview')
    }
  }

  return (
    <div className="h-full flex flex-col animate-in relative select-none">
      {/* Glass Command Bar */}
      <div className="px-5 py-2.5 glass-panel border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20 bg-white/95 dark:bg-[#0d121f]/95 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${running && !paused ? 'bg-cyan-500 animate-pulse' : 'bg-slate-400'}`} />
            <h1 className="text-sm font-black tracking-tight font-mono text-slate-900 dark:text-white uppercase">
              Plant Process Simulator // 3D Live Console
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

          {/* Agglomeration Slider */}
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
        {/* ── Docked Unit Inspector Side Drawer (Docked to Left of Canvas) ── */}
        {selectedComponent && (
          <div className="w-84 md:w-96 glass-panel border-r border-slate-200 dark:border-white/10 flex flex-col shrink-0 z-20 bg-white/98 dark:bg-[#0d121f]/98 shadow-2xl animate-in slide-in-from-left duration-200 overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-[#0d121f]/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  {CAMERA_PRESETS[selectedComponent as CameraPreset]?.unitNumber ?? '●'}
                </span>
                <div>
                  <h2 className="text-sm font-mono font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {selectedComponent.replace(/_/g, ' ')}
                  </h2>
                  <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    Unit Details & Internal Sub-Assemblies
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedComponent(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
                title="Close Inspector (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Computation Status Badge */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] font-mono">
                <span className="text-slate-500 dark:text-slate-400">Verification:</span>
                {['gasifier', 'boiler', 'turbine', 'heat_exchanger'].includes(selectedComponent) ? (
                  <span className="badge badge-success text-[10px]">COMPUTED (PHYSICS ENGINE)</span>
                ) : selectedComponent === 'feed_line' ? (
                  <span className="text-amber-500 font-bold">HYBRID (FEED RATE LIVE / OPTICAL SCHEMATIC)</span>
                ) : (
                  <span className="text-amber-500 font-bold">SCHEMATIC FACILITY PROP</span>
                )}
              </div>

              {/* Unit Specific Detail Panes */}
              {selectedComponent === 'gasifier' && (
                <div className="space-y-4 text-xs font-mono">
                  {/* Headline Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Bed Temp</span>
                      <span className="text-base font-bold text-rose-500">{data?.parameters?.reactor_temp_c?.toFixed(1) ?? 850.0} °C</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Airflow</span>
                      <span className="text-base font-bold text-cyan-500">{data?.parameters?.airflow_m3_h?.toFixed(1) ?? 661.0} Nm³/h</span>
                    </div>
                  </div>

                  {/* Physics Fluidization Variables */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Fluidization Hydrodynamics</span>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Superficial Velocity U₀:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(data?.fluidization?.u0_m_s ?? 0.567).toFixed(4)} m/s</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Effective U_mf,eff:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(data?.fluidization?.umf_effective_m_s ?? 0.056).toFixed(4)} m/s</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Velocity Ratio U₀/U_mf:</span>
                      <span className="font-bold text-emerald-500">{(data?.fluidization?.u0_over_umf_eff ?? 10.05).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Terminal Ratio U₀/U_t:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(data?.fluidization?.u0_over_ut ?? 0.20).toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Bed Pressure Drop:</span>
                      <span className="font-bold text-amber-500">{(data?.fluidization?.pressure_drop_kpa ?? 8.58).toFixed(2)} kPa</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 dark:text-slate-400">Syngas Chemical Power:</span>
                      <span className="font-bold text-amber-500">{(data?.gasification?.thermal_energy_kw ?? 1490.4).toFixed(1)} kW</span>
                    </div>
                  </div>

                  {/* Internal Sub-Components (Cleanly Revealed Here, Not Floating in 3D) */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Internal Sub-Components</span>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">1. Freeboard (Disengagement Zone)</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        Upper 2.8m expansion zone designed to decouple particulate entrainment from rising syngas before discharge.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">2. Bed Surface Level</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        Dynamic bubbling bed surface expanded from distributor deck (H ≈ 1.50m - 1.85m dynamic).
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">3. Air Distributor Plate (Tuyere Deck)</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        Perforated bubble cap deck designed for ΔP_dist / ΔP_bed ≥ 0.20 to guarantee uniform gas distribution.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">4. Air Plenum (Windbox)</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        Lower pressurized chamber fed by the primary forced-draft centrifugal blower at 101.3 kPa.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-[10px] text-slate-500">
                    Source: <code className="text-cyan-600 dark:text-cyan-400">parameters.*, fluidization.*, gasification.*</code>
                  </div>
                </div>
              )}

              {selectedComponent === 'boiler' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Steam Flow</span>
                      <span className="text-base font-bold text-cyan-500">{(data?.steam_cycle?.steam_flow_kg_h ?? 1547).toFixed(0)} kg/h</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Thermal Duty</span>
                      <span className="text-base font-bold text-amber-500">{(data?.steam_cycle?.boiler_duty_kw ?? 1266.8).toFixed(1)} kW</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Steam Cycle Specs</span>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Steam Pressure:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(data?.steam_cycle?.steam_pressure_bar ?? 10.0).toFixed(1)} bar</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Steam Temperature:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(data?.steam_cycle?.steam_temp_c ?? 350.0).toFixed(1)} °C</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Superheated State:</span>
                      <span className="font-bold text-emerald-500">{data?.steam_cycle?.is_superheated !== false ? 'Superheated (Dry)' : 'Saturated'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 dark:text-slate-400">Formulation:</span>
                      <span className="font-bold text-cyan-600 dark:text-cyan-400">{data?.steam_cycle?.steam_engine ?? 'IAPWS-IF97'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Internal Sub-Components</span>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">1. Evaporator Tube Bundle</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        High-surface-area water-tube matrix extracting sensible and latent heat from flue gas stream.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">2. Superheater Tubes</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        Elevates saturated vapor to 350 °C dry superheated steam to protect turbine blading.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">3. Steam Drum & Safety Valve</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        Upper separator drum with ASME spring-loaded pressure relief valve and exhaust vent.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-[10px] text-slate-500">
                    Source: <code className="text-cyan-600 dark:text-cyan-400">steam_cycle.*</code>
                  </div>
                </div>
              )}

              {selectedComponent === 'turbine' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Net Power</span>
                      <span className="text-base font-bold text-emerald-500">{(data?.turbine?.net_electrical_power_kw ?? 178.6).toFixed(1)} kWe</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Turbine Shaft</span>
                      <span className="text-base font-bold text-blue-500">{(data?.turbine?.turbine_power_kw ?? 198.5).toFixed(1)} kW</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Rankine Cycle Expansion</span>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Gross Electrical Power:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(data?.turbine?.electrical_power_kw ?? 179.1).toFixed(1)} kWe</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Enthalpy Drop Δh:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(data?.turbine?.enthalpy_drop_kj_kg ?? 461.9).toFixed(1)} kJ/kg</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Exhaust Steam Temp:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(data?.turbine?.exhaust_temp_c ?? 107.1).toFixed(1)} °C</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 dark:text-slate-400">Isentropic Efficiency:</span>
                      <span className="font-bold text-emerald-500">{((data?.turbine?.isentropic_efficiency ?? 0.75) * 100).toFixed(0)} %</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Internal Sub-Components</span>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">1. Reaction Turbine Rotor</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        3-stage shrouded reaction blading discs mounted on precision dynamic balanced rotor shaft.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">2. Flexible Shaft Coupling</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        Torsion-damping sleeve coupling absorbing torsional vibrations between turbine and alternator.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">3. Synchronous Generator & Exciter</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        400V 3-phase alternator with cast stator cooling ribs and brushless exciter enclosure.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-[10px] text-slate-500">
                    Source: <code className="text-cyan-600 dark:text-cyan-400">turbine.*</code>
                  </div>
                </div>
              )}

              {selectedComponent === 'heat_exchanger' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">District Heat</span>
                      <span className="text-base font-bold text-emerald-500">{(data?.heat_exchanger?.recovered_heat_kw ?? 863.1).toFixed(1)} kWth</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Delivery Temp</span>
                      <span className="text-base font-bold text-cyan-500">{(data?.heat_exchanger?.hot_water_temp_c ?? 70.0).toFixed(1)} °C</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Thermal Network Balance</span>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Condenser Heat Rejected:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(data?.heat_exchanger?.condenser_heat_kw ?? 1068.9).toFixed(1)} kW</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Unrecovered Cooling Loss:</span>
                      <span className="font-bold text-rose-500">{(data?.heat_exchanger?.cooling_loss_kw ?? 205.8).toFixed(1)} kW</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">District Water Flow:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(data?.heat_exchanger?.water_flow_used_kg_h ?? 14869).toFixed(0)} kg/h</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 dark:text-slate-400">Heat Effectiveness:</span>
                      <span className="font-bold text-emerald-500">85.0 %</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Internal Sub-Components</span>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">1. Shell & Tube Condenser</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        Counter-current condensing vessel condensing exhaust steam to warm district water supply.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">2. District Supply & Return Headers</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        70 °C delivery piping towards municipal network, 50 °C return line back into condensing hotwell.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-[10px] text-slate-500">
                    Source: <code className="text-cyan-600 dark:text-cyan-400">heat_exchanger.*</code>
                  </div>
                </div>
              )}

              {selectedComponent === 'feed_line' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Waste Feed</span>
                      <span className="text-base font-bold text-slate-900 dark:text-white">{data?.parameters?.waste_feed_kg_h ?? 500} kg/h</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Plastic Fraction</span>
                      <span className="text-base font-bold text-cyan-500">{((data?.parameters?.plastic_ratio ?? 0.25) * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Feedstock Properties</span>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Moisture Content:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{(data?.parameters?.moisture_pct ?? 15.0).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-white/5">
                      <span className="text-slate-500 dark:text-slate-400">Biomass / Organic:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{((data?.parameters?.organic_ratio ?? 0.60) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 dark:text-slate-400">Feed Mechanism:</span>
                      <span className="font-bold text-emerald-500">Closed Chute / Water-Cooled Auger</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Internal Sub-Components</span>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">1. Sorting Conveyor Belt</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        Variable-speed rubber belt conveyor with 3-roller troughing idlers carrying sorted medical parcels.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-200">2. Optical Vision Scanner</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold">SCHEMATIC</span>
                      </div>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        Overhead optical inspection hood (schematic visual representation; not live camera stream).
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">3. Gas-Tight Chute & Screw Feeder</span>
                      <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                        Polycarbonate-inspected transition chute and sealed motorized auger preventing gasifier blowback.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-white/10 text-[10px] text-slate-500">
                    Source: <code className="text-cyan-600 dark:text-cyan-400">parameters.waste_feed_kg_h & plastic_ratio</code>
                  </div>
                </div>
              )}

              {/* Static Props / Schematics Inspector (Control Cabin / Buffer Tank) */}
              {(selectedComponent === 'control_cabin' || selectedComponent === 'buffer_tank') && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-1.5">
                    <span className="font-bold block">Schematic Facility Prop</span>
                    <p className="text-[11px] font-sans text-slate-600 dark:text-slate-300">
                      This element provides realistic plant surroundings and architectural context. It is not currently linked to live thermodynamic state channels.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">Element Specification</span>
                    <p className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                      {selectedComponent === 'control_cabin'
                        ? 'Operator Motor Control Center (MCC) container with safety telemetry displays.'
                        : 'Demineralized boiler feedwater surge tank buffering return condensate.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 3D Viewport Area ── */}
        <div className="flex-1 relative bg-slate-950 overflow-hidden">
          <Canvas
            shadows
            onPointerMissed={() => setSelectedComponent(null)}
          >
            <Suspense fallback={null}>
              <PlantScene
                data={data}
                running={running}
                paused={paused}
                reducedMotion={reducedMotion}
                cameraPreset={cameraPreset}
                theme={resolvedTheme}
                onSelectComponent={(comp) => handleSelectUnit(comp)}
                selectedComponent={selectedComponent}
              />
            </Suspense>
          </Canvas>

          {/* ── Unified Single-Row Toolbar (Camera + Unit Selection) ── */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center p-1 rounded-xl bg-slate-900/90 dark:bg-[#0d121f]/95 border border-slate-700/80 dark:border-white/20 backdrop-blur-md shadow-xl z-10 gap-1 max-w-[calc(100%-2rem)] overflow-x-auto no-scrollbar">
            {[
              { id: 'overview', label: 'Overview', icon: Camera },
              { id: 'feed_line', label: 'Feed line', num: 1 },
              { id: 'gasifier', label: 'Gasifier', num: 2 },
              { id: 'boiler', label: 'Boiler', num: 3 },
              { id: 'turbine', label: 'Turbine', num: 4 },
              { id: 'heat_exchanger', label: 'Heat exchanger', num: 5 },
            ].map((item) => {
              const isActive =
                item.id === 'overview'
                  ? selectedComponent === null && cameraPreset === 'overview'
                  : selectedComponent === item.id || cameraPreset === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'overview') {
                      handleSelectUnit(null)
                    } else {
                      handleSelectUnit(item.id)
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title={CAMERA_PRESETS[item.id as CameraPreset]?.description}
                >
                  {item.num !== undefined ? (
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isActive ? 'bg-white text-blue-700' : 'bg-white/20 text-slate-200'
                      }`}
                    >
                      {item.num}
                    </span>
                  ) : (
                    <Camera size={13} className={isActive ? 'text-white' : 'text-slate-400'} />
                  )}
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>

          {/* ── Collapsible Top KPI Cards ── */}
          <div className="absolute top-16 left-4 z-10 max-w-xl pointer-events-none">
            <div className="pointer-events-auto mb-1 flex items-center gap-2">
              <button
                onClick={() => setKpiExpanded(!kpiExpanded)}
                className="px-2 py-1 rounded-md bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/15 text-[11px] font-mono flex items-center gap-1.5 backdrop-blur-md shadow-sm cursor-pointer"
                title={kpiExpanded ? 'Collapse Telemetry Cards' : 'Expand Telemetry Cards'}
              >
                {kpiExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                <span>{kpiExpanded ? 'Hide KPIs' : 'Live KPIs'}</span>
                {!kpiExpanded && data && (
                  <span className="text-cyan-400 font-bold ml-1">
                    {data.parameters?.reactor_temp_c?.toFixed(0)}°C · {(data.turbine?.net_electrical_power_kw ?? 178.6)?.toFixed(0)}kWe
                  </span>
                )}
              </button>
            </div>

            {kpiExpanded && data && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pointer-events-auto animate-in fade-in duration-150">
                {[
                  {
                    label: 'Bed Temp',
                    value: data.parameters?.reactor_temp_c?.toFixed(0),
                    unit: '°C',
                    color: 'text-rose-400',
                    sub: '±1.2°C noise',
                  },
                  {
                    label: 'Airflow',
                    value: data.parameters?.airflow_m3_h?.toFixed(1),
                    unit: 'Nm³/h',
                    color: 'text-cyan-400',
                    sub: 'ER target 0.30',
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
                    sub: 'Rankine cycle',
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
                    className="glass-card-subtle px-3 py-2 bg-slate-900/90 border border-white/15 backdrop-blur-md rounded-lg shadow-sm"
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
            )}
          </div>

          {/* Mitigation feedback toast */}
          {mitigationNotice && (
            <div className="absolute top-28 inset-x-8 z-30 p-2.5 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-mono flex items-center justify-between shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{mitigationNotice}</span>
              </div>
              <button onClick={() => setMitigationNotice(null)} className="text-emerald-400 hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}

          {/* ── Compact & Collapsible Physics-Primary State Banner ── */}
          {data && (
            <div className="absolute bottom-3 inset-x-4 p-2.5 rounded-xl glass-card border border-white/15 bg-slate-900/90 backdrop-blur-lg z-10 shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Primary Physics Diagnostic Badge (Always Visible) */}
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
                      ML Model: {mlState.replace(/_/g, ' ')} ({(mlConfidence * 100).toFixed(0)}% conf)
                    </span>

                    {/* Disagreement Warning Callout */}
                    {isDisagreement && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-semibold">
                        <AlertTriangle size={12} className="text-amber-400" />
                        Physics vs ML Disagreement (Physics Governs)
                      </span>
                    )}

                    <button
                      onClick={() => setPhysicsBannerExpanded(!physicsBannerExpanded)}
                      className="text-[10px] font-mono text-cyan-400 hover:underline cursor-pointer flex items-center gap-0.5 ml-1"
                    >
                      {physicsBannerExpanded ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
                      <span>{physicsBannerExpanded ? 'Hide Details' : 'Details'}</span>
                    </button>
                  </div>

                  {physicsBannerExpanded && (
                    <div className="text-xs text-slate-300 font-sans pt-1">
                      <span className="font-semibold text-white">Physical Rationale: </span>
                      {physicsReason}
                    </div>
                  )}
                </div>

                {/* Auto-Mitigate Action Button */}
                {(physicsState !== 'NORMAL_FLUIDIZATION' || agglomerationIndex > 0) && (
                  <button
                    onClick={handleAutoMitigate}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0"
                    title="Flushes agglomerated bed, normalizes plastic feed to 20%, restores ER=0.30 target airflow, and sets bed temp to 850°C"
                  >
                    <Flame size={14} />
                    <span>Auto-Mitigate</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Sidebar: Telemetry Charts with Sensible Fixed Y-Ranges ── */}
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

          {/* Documented Noise Notice */}
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-mono text-slate-600 dark:text-slate-400 space-y-0.5">
            <div className="flex items-center justify-between text-slate-800 dark:text-slate-200 font-bold">
              <span>Sensor Jitter Model:</span>
              <span className="text-emerald-600 dark:text-emerald-400">Gaussian Random Noise</span>
            </div>
            <div className="text-[9.5px]">
              Temp: σ = 1.2 °C · Airflow: σ = 0.7 Nm³/h (Stochastic Gauss, non-sinusoidal)
            </div>
          </div>

          {[
            {
              key: 'temperature',
              label: 'Bed Temperature (°C)',
              color: '#f43f5e',
              domain: [700, 1000],
            },
            {
              key: 'pressure',
              label: 'Bed Pressure Drop (kPa)',
              color: '#f59e0b',
              domain: [0, 15],
            },
            {
              key: 'power',
              label: 'Turbine Net Power (kWe)',
              color: '#0284c7',
              domain: [100, 250],
            },
            {
              key: 'heat',
              label: 'Recovered District Heat (kWth)',
              color: '#06b6d4',
              domain: [600, 1100],
            },
            {
              key: 'efficiency',
              label: 'Overall Plant CHP Efficiency (%)',
              color: '#10b981',
              domain: [25, 50],
            },
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
                  <YAxis
                    width={34}
                    tick={{ fontSize: 9, fill: '#64748b' }}
                    domain={chart.domain as any}
                  />
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
