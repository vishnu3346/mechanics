import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { SimulationResult, Scenario } from '../types'
import SankeyEnergyFlow from '../components/SankeyEnergyFlow'
import AssumptionsPanel from '../components/AssumptionsPanel'
import {
  Zap,
  RotateCw,
  Flame,
  Layers,
  Sparkles,
  Sliders,
  AlertTriangle,
  FileText,
  Activity,
  Gauge,
  Info,
} from 'lucide-react'

export default function EnergyPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('normal')
  const [loading, setLoading] = useState<boolean>(false)
  const [simData, setSimData] = useState<SimulationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Custom sensitivity sliders state
  const [feedRate, setFeedRate] = useState<number>(500)
  const [plasticPct, setPlasticPct] = useState<number>(20)
  const [moisturePct, setMoisturePct] = useState<number>(15)
  const [turbineEff, setTurbineEff] = useState<number>(75)
  const [boilerEff, setBoilerEff] = useState<number>(85)

  const loadScenariosList = async () => {
    try {
      const res = await api.get('/scenarios')
      const valid = (res.scenarios || []).filter((s: Scenario) => s.id !== 'custom')
      setScenarios(valid)
    } catch (e: any) {
      console.error('Failed to load scenarios in energy page:', e)
    }
  }

  const fetchEnergyData = async (scenarioId: string = selectedScenarioId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post(`/scenarios/${scenarioId}/run`)
      const data: SimulationResult = res.result || res
      setSimData(data)
      if (data.parameters) {
        setFeedRate(data.parameters.waste_feed_kg_h)
        setPlasticPct(data.parameters.plastic_ratio)
        setMoisturePct(data.parameters.moisture_pct)
      }
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to fetch thermodynamic balances from server')
    } finally {
      setLoading(false)
    }
  }

  const handleCustomRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/simulation/run', {
        waste_feed_kg_h: feedRate,
        plastic_ratio: plasticPct / 100,
        moisture_pct: moisturePct,
        boiler_efficiency: boilerEff / 100,
        turbine_efficiency: turbineEff / 100,
      })
      const data: SimulationResult = res.result || res
      setSimData(data)
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Failed to compute custom simulation')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadScenariosList()
    fetchEnergyData('normal')
  }, [])

  const handleScenarioChange = (id: string) => {
    setSelectedScenarioId(id)
    fetchEnergyData(id)
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Zap className="text-amber-500" size={24} />
              <span>Thermodynamic Energy Flow & CHP Cogeneration</span>
            </h1>
            <span className="badge badge-info font-mono text-[10px]">
              First &amp; Second Law
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-normal">
            Complete facility energy balance from feedstock reception to turbine electricity, 70°C district hot water, and honest autothermal closure
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Scenario Quick Selector */}
          <select
            value={selectedScenarioId}
            onChange={(e) => handleScenarioChange(e.target.value)}
            disabled={loading}
            className="text-xs glass-input px-3 py-1.5 font-medium cursor-pointer text-slate-800 dark:text-slate-200"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                {s.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchEnergyData(selectedScenarioId)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Calculating...' : 'Recalculate'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/30 rounded-lg text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <span className="font-bold">Thermodynamic Simulation Failed:</span> {error}
            </div>
          </div>
          <button
            onClick={() => fetchEnergyData(selectedScenarioId)}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-xs transition shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state indicator */}
      {loading && !simData && (
        <div className="glass-card p-16 text-center text-slate-500 text-xs font-mono animate-pulse">
          Computing IAPWS-IF97 steam tables and whole-plant energy conservation...
        </div>
      )}

      {/* Main Content when simData is available */}
      {simData && (
        <div className="space-y-6">
          {/* Top Level KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="metric-card">
              <div className="metric-label">Feedstock Input</div>
              <div className="metric-value text-blue-600 dark:text-cyan-400">
                {simData.overall?.waste_input_kw?.toFixed(1)}{' '}
                <span className="metric-unit">kWth</span>
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-1 font-semibold">
                Chemical LHV (100%)
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Net Electricity</div>
              <div className="metric-value text-emerald-600 dark:text-emerald-400">
                {simData.overall?.net_power_kw?.toFixed(1)}{' '}
                <span className="metric-unit">kWe</span>
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-1 font-semibold">
                Gross turbine - pump
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">District Heat</div>
              <div className="metric-value text-amber-600 dark:text-amber-400">
                {simData.overall?.heat_recovery_kw?.toFixed(1)}{' '}
                <span className="metric-unit">kWth</span>
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-1 font-semibold">
                Hot water delivery 70°C
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Total Useful CHP</div>
              <div className="metric-value text-indigo-600 dark:text-indigo-400">
                {simData.overall?.total_useful_kw?.toFixed(1)}{' '}
                <span className="metric-unit">kW</span>
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-1 font-semibold">
                Electricity + Heat
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Cold Gas Eff.</div>
              <div className="metric-value text-slate-900 dark:text-slate-100">
                {simData.overall?.gasification_efficiency_pct?.toFixed(1)}{' '}
                <span className="metric-unit">%</span>
              </div>
              <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-1 font-semibold">
                Syngas / waste LHV
              </div>
            </div>

            <div className="metric-card bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30">
              <div className="metric-label text-emerald-800 dark:text-emerald-400 font-bold">
                Combined CHP Eff.
              </div>
              <div className="metric-value text-emerald-700 dark:text-emerald-400">
                {simData.overall?.overall_efficiency_pct?.toFixed(1)}{' '}
                <span className="metric-unit">%</span>
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono mt-1 font-bold">
                First-Law recovery
              </div>
            </div>
          </div>

          {/* TASK 2: Sankey Energy Flow Diagram */}
          <SankeyEnergyFlow
            closure={simData.whole_plant_closure}
            energyBalance={simData.energy_balance}
            gasification={simData.gasification}
            loading={loading}
          />

          {/* Multi-Stage Thermodynamic Conversion Cascade Details */}
          <div className="glass-card p-6 border border-slate-200 dark:border-white/10 space-y-4">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
              <Layers size={15} className="text-blue-600 dark:text-cyan-400" />
              Four-Stage Thermodynamic Cascade Diagnostics
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Stage 1 */}
              <div className="glass-card-subtle p-4 border border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-cyan-400 font-mono text-xs font-bold">
                      01
                    </span>
                    <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-900 dark:text-slate-100">
                      Waste Intake
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 font-normal">
                    Clinical solids and polymer stream
                  </p>
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Mass Feed:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {simData.parameters?.waste_feed_kg_h?.toFixed(1)} kg/h
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Feedstock LHV:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {simData.feedstock?.lhv_mj_kg?.toFixed(3)} MJ/kg
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Moisture:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {simData.parameters?.moisture_pct?.toFixed(1)} %
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Chemical Input:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                    {simData.whole_plant_closure?.chemical_input_kw?.toFixed(1)} kWth
                  </span>
                </div>
              </div>

              {/* Stage 2 */}
              <div className="glass-card-subtle p-4 border border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 font-mono text-xs font-bold">
                      02
                    </span>
                    <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-900 dark:text-slate-100">
                      Gasification Bed
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 font-normal">
                    Thermochemical sub-stoichiometric bed
                  </p>
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Bed Temp:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {simData.parameters?.reactor_temp_c?.toFixed(1)} °C
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Syngas Flow:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {simData.gasification?.syngas_flow_nm3_h?.toFixed(1)} Nm³/h
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Carbon Conv:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {((simData.gasification?.carbon_conversion ?? 0) * 100).toFixed(1)} %
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Syngas Thermal:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {simData.gasification?.thermal_energy_kw?.toFixed(1)} kWth
                  </span>
                </div>
              </div>

              {/* Stage 3 */}
              <div className="glass-card-subtle p-4 border border-cyan-500/30 bg-cyan-50/60 dark:bg-cyan-500/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 font-mono text-xs font-bold">
                      03
                    </span>
                    <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-900 dark:text-slate-100">
                      HRSG Boiler
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 font-normal">
                    Superheated steam generation
                  </p>
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Steam Flow:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {simData.steam_cycle?.steam_flow_kg_h?.toFixed(1)} kg/h
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Pressure:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {simData.steam_cycle?.steam_pressure_bar?.toFixed(1)} bar
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Steam Temp:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {simData.steam_cycle?.steam_temp_c?.toFixed(1)} °C
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Boiler Duty:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                    {simData.steam_cycle?.boiler_duty_kw?.toFixed(1)} kWth
                  </span>
                </div>
              </div>

              {/* Stage 4 */}
              <div className="glass-card-subtle p-4 border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-mono text-xs font-bold">
                      04
                    </span>
                    <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-900 dark:text-slate-100">
                      Turbine &amp; District
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 font-normal">
                    Turbogenerator + 70°C water
                  </p>
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Gross Turbine:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {simData.turbine?.electrical_power_kw?.toFixed(1)} kWe
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Pump Power:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        -{simData.overall?.feed_pump_electrical_kw?.toFixed(3) ?? '0.544'} kWe
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">District Heat:</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {simData.heat_exchanger?.recovered_heat_kw?.toFixed(1)} kWth
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex justify-between items-center text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Net Electricity:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {simData.overall?.net_power_kw?.toFixed(1)} kWe
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sensitivity Tuning Controls Panel */}
          <div className="glass-card p-6 border border-slate-200 dark:border-white/10 space-y-4">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
              <Sliders size={15} className="text-blue-600 dark:text-cyan-400" />
              Dynamic Feedstock &amp; Cycle Sensitivity Tuning
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Waste Feed Rate:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{feedRate} kg/h</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="1000"
                  step="20"
                  value={feedRate}
                  onChange={(e) => setFeedRate(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Plastic Fraction:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{plasticPct} %</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={plasticPct}
                  onChange={(e) => setPlasticPct(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Moisture Content:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{moisturePct} %</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="45"
                  step="1"
                  value={moisturePct}
                  onChange={(e) => setMoisturePct(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Turbine Isentropic Eff:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{turbineEff} %</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="90"
                  step="1"
                  value={turbineEff}
                  onChange={(e) => setTurbineEff(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleCustomRun}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                {loading ? 'Evaluating Model...' : 'Simulate Custom Inputs'}
              </button>
            </div>
          </div>

          {/* TASK 4: Assumptions Panel */}
          <AssumptionsPanel />
        </div>
      )}
    </div>
  )
}
