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
} from 'lucide-react'
import { LineChart, Line as RLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { PlantScene } from '../components/simulation3d/PlantScene'
import { CAMERA_PRESETS, type CameraPreset } from '../components/simulation3d/types'

// ── Baseline Demo Data for Instant Chart Feedback ─────────────
const BASELINE_DATA = [
  { time: 0, temperature: 850, pressure: 8.58, power: 178.6, airflow: 661, heat: 863.1, efficiency: 39.9 },
  { time: 1, temperature: 851, pressure: 8.58, power: 178.8, airflow: 661, heat: 863.4, efficiency: 39.9 },
  { time: 2, temperature: 849, pressure: 8.57, power: 178.4, airflow: 660, heat: 862.9, efficiency: 39.8 },
  { time: 3, temperature: 850, pressure: 8.58, power: 178.6, airflow: 661, heat: 863.2, efficiency: 39.9 },
  { time: 4, temperature: 852, pressure: 8.59, power: 178.9, airflow: 662, heat: 863.7, efficiency: 39.9 },
]

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
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview')

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
          <Canvas shadows>
            <Suspense fallback={null}>
              <PlantScene
                data={data}
                running={running}
                paused={paused}
                reducedMotion={reducedMotion}
                cameraPreset={cameraPreset}
                onSelectComponent={(comp) => setSelectedComponent(comp)}
                selectedComponent={selectedComponent}
              />
            </Suspense>
          </Canvas>

          {/* ── Camera Preset Buttons with Smooth Transitions ─────────── */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center p-1 rounded-xl bg-slate-900/90 border border-white/20 backdrop-blur-md shadow-xl z-10 gap-1">
            {(['overview', 'gasifier', 'steam_cycle', 'feed_line'] as CameraPreset[]).map((presetKey) => {
              const cfg = CAMERA_PRESETS[presetKey]
              const isActive = cameraPreset === presetKey
              return (
                <button
                  key={presetKey}
                  onClick={() => setCameraPreset(presetKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                  title={cfg.description}
                >
                  <Camera size={12} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span>{cfg.label}</span>
                </button>
              )
            })}
          </div>

          {/* Floating High-Contrast HUD Telemetry */}
          {data ? (
            <div className="absolute top-16 left-4 grid grid-cols-2 sm:grid-cols-3 gap-2 pointer-events-none z-10 max-w-xl">
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
            <div className="absolute top-16 left-4 px-3.5 py-2 rounded-lg bg-slate-900/90 backdrop-blur-md border border-white/15 text-xs font-mono text-slate-200 pointer-events-none flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Standby: Ready to stream live physics & telemetry. Click [Start Run]</span>
            </div>
          )}

          {/* Quick Component Inspector Picker Badge */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
            {['feed_line', 'gasifier', 'boiler', 'turbine', 'heat_exchanger'].map((c) => (
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

          {/* Interactive Click-to-Inspect Overlay Panel */}
          {selectedComponent && (
            <div className="absolute bottom-20 left-4 z-20 w-84 glass-panel bg-slate-900/95 border border-white/20 p-3.5 rounded-xl shadow-xl space-y-2.5 text-xs">
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

              {selectedComponent === 'feed_line' && (
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Waste Feed Rate:</span>
                    <span className="text-white font-bold">{data?.parameters?.waste_feed_kg_h ?? 500} kg/h</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Plastic Fraction:</span>
                    <span className="text-cyan-400 font-bold">{((data?.parameters?.plastic_ratio ?? 0.25) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Moisture Content:</span>
                    <span className="text-white font-bold">{data?.parameters?.moisture_pct ?? 15.0}%</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Feeder Auger:</span>
                    <span className="text-emerald-400 font-bold">Closed Chute / Screw Active</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-slate-400">Optical Scanner:</span>
                    <span className="text-amber-400 font-bold">Schematic (not live YOLO)</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-400">Source JSON Field:</span>
                    <span className="text-slate-300 text-[10px]">parameters.waste_feed_kg_h & plastic_ratio</span>
                  </div>
                </div>
              )}

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

          {/* Primary Physics Fault Banner & Experimental ML Warning */}
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
