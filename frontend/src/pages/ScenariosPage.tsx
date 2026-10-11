import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { Scenario, SimulationResult } from '../types'
import {
  List,
  Play,
  CheckCircle,
  Sliders,
  FileText,
  AlertTriangle,
} from 'lucide-react'

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedId, setSelectedId] = useState<string>('normal')
  const [running, setRunning] = useState<boolean>(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadScenarios = async () => {
    try {
      const res = await api.get('/scenarios')
      setScenarios(res.scenarios)
      if (res.scenarios.length > 0 && !selectedId) {
        setSelectedId(res.scenarios[0].id)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const selectScenario = async (id: string) => {
    setSelectedId(id)
    setError(null)
    setRunning(true)
    try {
      const res = await api.post(`/scenarios/${id}/run`)
      setResult(res.result || res)
    } catch (e: any) {
      setError(e.message || 'Failed to execute scenario')
    } finally {
      setRunning(false)
    }
  }

  const runSelected = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await api.post(`/scenarios/${selectedId}/run`)
      setResult(res.result || res)
    } catch (e: any) {
      setError(e.message || 'Failed to execute scenario')
    } finally {
      setRunning(false)
    }
  }

  const defaultParams = {
    waste_feed_kg_h: 100,
    moisture_pct: 15,
    plastic_ratio: 0.2,
    airflow_m3_h: 120,
    reactor_temp_c: 850,
    pressure_kpa: 101.3,
    boiler_efficiency: 0.85,
    turbine_efficiency: 0.80,
  }

  const selectedScenario = scenarios.find((s) => s.id === selectedId)
  const selectedParams = selectedScenario?.parameters || defaultParams

  useEffect(() => {
    loadScenarios()
    selectScenario('normal')
  }, [])

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <List className="text-blue-600 dark:text-cyan-400" size={24} />
            <span>Operational Scenarios & Stress Tests</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-normal">
            Standard clinical blends, off-spec surges, bed agglomeration hazards, and extreme throughput benchmarks
          </p>
        </div>

        <button
          onClick={runSelected}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 self-start sm:self-auto cursor-pointer"
        >
          <Play size={13} className={running ? 'animate-spin' : ''} fill="currentColor" />
          {running ? 'Running Simulation...' : 'Execute Selected Scenario'}
        </button>
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {scenarios.map((sc) => {
          const isSelected = sc.id === selectedId
          return (
            <button
              key={sc.id}
              onClick={() => selectScenario(sc.id)}
              className={`text-left p-3.5 rounded-xl transition-all flex flex-col justify-between relative overflow-hidden group cursor-pointer ${
                isSelected
                  ? 'glass-card border-blue-600 dark:border-cyan-400 shadow-sm bg-blue-50/70 dark:bg-cyan-500/10'
                  : 'glass-card border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">{sc.name}</span>
                  {isSelected && <CheckCircle size={14} className="text-blue-600 dark:text-cyan-400" />}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2 leading-tight">
                  {sc.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold">
                <span className="uppercase">{sc.id}</span>
                <span className="text-blue-600 dark:text-cyan-400 font-bold group-hover:underline">Select</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Main Execution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Scenario Parameters Panel */}
        <div className="lg:col-span-5 glass-card p-5 space-y-4 border border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
              <Sliders size={15} className="text-blue-600 dark:text-cyan-400" />
              Boundary Parameters
            </h2>
            <span className="badge badge-info font-mono">{selectedId}</span>
          </div>

          {selectedParams ? (
            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-200/70 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Waste Feed Rate:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedParams.waste_feed_kg_h ?? 100} kg/h</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/70 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Moisture Content:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedParams.moisture_pct ?? 15} %</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/70 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Plastic Content:</span>
                <span className="font-bold text-blue-600 dark:text-cyan-400">
                  {((selectedParams.plastic_ratio ?? 0.2) * 100).toFixed(0)} %
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/70 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Primary Airflow:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedParams.airflow_m3_h ?? 120} m³/h</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/70 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Bed Temperature:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{selectedParams.reactor_temp_c ?? 850} °C</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/70 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Freeboard Pressure:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedParams.pressure_kpa ?? 101.3} kPa</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/70 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Boiler Efficiency:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {((selectedParams.boiler_efficiency ?? 0.85) * 100).toFixed(0)} %
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Turbine Isentropic Eff:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {((selectedParams.turbine_efficiency ?? 0.80) * 100).toFixed(0)} %
                </span>
              </div>

              <button
                onClick={runSelected}
                disabled={running}
                className="w-full mt-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                {running ? 'Simulating...' : `Execute: ${selectedId}`}
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs">
              Loading boundary conditions...
            </div>
          )}
        </div>

        {/* Simulation Execution Result Panel */}
        <div className="lg:col-span-7">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle size={15} />
              {error}
            </div>
          )}

          {result ? (
            <div className="glass-card p-6 space-y-4 border border-slate-200 dark:border-white/10 animate-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono">{result.scenario_name}</h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    Completed at {new Date(result.timestamp * 1000).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <span
                    className={`badge ${
                      result.anomaly?.state === 'NORMAL_FLUIDIZATION' ? 'badge-success' : 'badge-danger'
                    }`}
                  >
                    {(result.anomaly?.state || 'NORMAL_FLUIDIZATION').replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="metric-card py-2.5 px-3">
                  <div className="metric-label text-[9px]">Electrical Export</div>
                  <div className="metric-value text-emerald-600 dark:text-emerald-400 text-base">
                    {(result.overall?.electrical_output_kw ?? 13.5).toFixed(1)} <span className="metric-unit">kWe</span>
                  </div>
                </div>
                <div className="metric-card py-2.5 px-3">
                  <div className="metric-label text-[9px]">Useful Heat</div>
                  <div className="metric-value text-amber-600 dark:text-amber-400 text-base">
                    {(result.overall?.heat_recovery_kw ?? 17.4).toFixed(1)} <span className="metric-unit">kWth</span>
                  </div>
                </div>
                <div className="metric-card py-2.5 px-3">
                  <div className="metric-label text-[9px]">Total CHP Eff.</div>
                  <div className="metric-value text-blue-600 dark:text-cyan-400 text-base">
                    {(result.overall?.overall_efficiency_pct ?? 5.9).toFixed(1)} <span className="metric-unit">%</span>
                  </div>
                </div>
                <div className="metric-card py-2.5 px-3">
                  <div className="metric-label text-[9px]">Cold Gas Eff.</div>
                  <div className="metric-value text-slate-900 dark:text-slate-100 text-base">
                    {(result.overall?.gasification_efficiency_pct ?? 65.7).toFixed(1)} <span className="metric-unit">%</span>
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="glass-card-subtle p-3.5 text-xs space-y-1.5 font-mono border border-slate-200 dark:border-white/10">
                  <div className="font-bold font-sans uppercase text-[10px] tracking-wider text-slate-900 dark:text-slate-100 mb-1">
                    Syngas Composition
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Lower Heating Value:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{(result.gasification?.syngas_lhv_mj_nm3 ?? 4.11).toFixed(2)} MJ/Nm³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Syngas Flow Rate:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{(result.gasification?.syngas_flow_nm3_h ?? 240.1).toFixed(1)} Nm³/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Thermal Power:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{(result.gasification?.thermal_energy_kw ?? result.gasification?.syngas_power_kw ?? 274.2).toFixed(1)} kW</span>
                  </div>
                </div>

                <div className="glass-card-subtle p-3.5 text-xs space-y-1.5 font-mono border border-slate-200 dark:border-white/10">
                  <div className="font-bold font-sans uppercase text-[10px] tracking-wider text-slate-900 dark:text-slate-100 mb-1">
                    Steam Rankine Loop
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Steam Production:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{(result.steam_cycle?.steam_flow_kg_h ?? 200.0).toFixed(1)} kg/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Gross Power:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{(result.turbine?.gross_power_kw ?? result.turbine?.turbine_power_kw ?? 16.5).toFixed(1)} kWe</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Net Power:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{(result.turbine?.electrical_power_kw ?? 13.5).toFixed(1)} kWe</span>
                  </div>
                </div>
              </div>

              {/* Automated Guidance */}
              <div className="glass-card-subtle p-3.5 text-xs border border-slate-200 dark:border-white/10">
                <div className="font-bold uppercase text-[10px] tracking-wider text-slate-900 dark:text-slate-100 mb-1">
                  Diagnostics & Mitigation Action
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium">
                  {result.anomaly?.recommendation || 'System operating within nominal stability parameters.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-card p-16 text-center text-slate-500 space-y-2 border border-slate-200 dark:border-white/10">
              <FileText size={32} className="mx-auto text-slate-400" />
              <div className="text-xs font-medium">
                Select a scenario above and click <strong>Execute Selected Scenario</strong> to observe full digital twin results.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
