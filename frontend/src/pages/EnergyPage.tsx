import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { SimulationResult } from '../types'
import {
  Zap,
  RotateCw,
  Flame,
  Droplets,
  Layers,
  Sparkles,
  Sliders,
} from 'lucide-react'

export default function EnergyPage() {
  const [feedRate, setFeedRate] = useState<number>(100)
  const [plasticPct, setPlasticPct] = useState<number>(20)
  const [moisturePct, setMoisturePct] = useState<number>(15)
  const [turbineEff, setTurbineEff] = useState<number>(80)

  const [loading, setLoading] = useState<boolean>(false)
  const [simData, setSimData] = useState<SimulationResult | null>(null)

  const fetchEnergyData = async () => {
    setLoading(true)
    try {
      const res = await api.post('/simulation/step', {
        waste_feed_kg_h: feedRate,
        plastic_ratio: plasticPct / 100,
        moisture_pct: moisturePct,
        reactor_temp_c: 850,
        airflow_m3_h: 120,
        pressure_kpa: 101.3,
        boiler_eff: 0.82,
        turbine_eff: turbineEff / 100,
      })
      setSimData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEnergyData()
  }, [])

  const gasification = simData?.gasification || {
    syngas_flow_nm3_h: 240.1,
    syngas_lhv_mj_nm3: 4.11,
    syngas_power_kw: 274.2,
  }

  const steam = simData?.steam_cycle || {
    steam_flow_kg_h: 200.0,
    steam_pressure_bar: 10.0,
    steam_temp_c: 350.0,
    heat_absorbed_kw: 185.0,
  }

  const turbine = simData?.turbine || {
    gross_power_kw: 16.5,
    parasitic_load_kw: 3.0,
    electrical_power_kw: 13.5,
  }

  const heatExchanger = simData?.heat_exchanger || {
    heat_recovered_kw: 17.4,
    hot_water_temp_c: 85.0,
  }

  const overall = simData?.overall || {
    waste_input_kw: 522.5,
    electrical_output_kw: 13.5,
    heat_recovery_kw: 17.4,
    total_useful_kw: 30.8,
    electrical_efficiency_pct: 2.6,
    gasification_efficiency_pct: 65.7,
    overall_efficiency_pct: 5.9,
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Zap className="text-amber-500" size={24} />
            <span>Thermodynamic Energy Balance & CHP Cogeneration</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-normal">
            First & Second Law energy cascading: Feedstock Enthalpy → Syngas Chemical Energy → Rankine Power & 85°C Hospital Heat
          </p>
        </div>
        <button
          onClick={fetchEnergyData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 self-start sm:self-auto cursor-pointer"
        >
          <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Computing Enthalpies...' : 'Recalculate Energy Flow'}
        </button>
      </div>

      {/* Top Level KPIs in Frosted Glass Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="metric-card">
          <div className="metric-label">Feedstock Input</div>
          <div className="metric-value text-blue-600 dark:text-cyan-400">
            {overall.waste_input_kw?.toFixed(1)} <span className="metric-unit">kWth</span>
          </div>
          <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-1 font-semibold">Chemical LHV</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Net Electricity</div>
          <div className="metric-value text-emerald-600 dark:text-emerald-400">
            {overall.electrical_output_kw?.toFixed(1)} <span className="metric-unit">kWe</span>
          </div>
          <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-1 font-semibold">Turbogenerator</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Thermal Recovery</div>
          <div className="metric-value text-amber-600 dark:text-amber-400">
            {overall.heat_recovery_kw?.toFixed(1)} <span className="metric-unit">kWth</span>
          </div>
          <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-1 font-semibold">Hospital Hot Water 85°C</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Useful CHP</div>
          <div className="metric-value text-indigo-600 dark:text-indigo-400">
            {overall.total_useful_kw?.toFixed(1)} <span className="metric-unit">kW</span>
          </div>
          <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-1 font-semibold">Power + District Heat</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Cold Gas Eff.</div>
          <div className="metric-value text-slate-900 dark:text-slate-100">
            {overall.gasification_efficiency_pct?.toFixed(1)} <span className="metric-unit">%</span>
          </div>
          <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono mt-1 font-semibold">Syngas / Waste LHV</div>
        </div>

        <div className="metric-card bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30">
          <div className="metric-label text-emerald-800 dark:text-emerald-400 font-bold">Combined CHP Eff.</div>
          <div className="metric-value text-emerald-700 dark:text-emerald-400">
            {overall.overall_efficiency_pct?.toFixed(1)} <span className="metric-unit">%</span>
          </div>
          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono mt-1 font-bold">First Law Recovery</div>
        </div>
      </div>

      {/* Energy Cascade Flow Visualization */}
      <div className="glass-card p-6 border border-slate-200 dark:border-white/10 space-y-4">
        <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
          <Layers size={15} className="text-blue-600 dark:text-cyan-400" />
          Multi-Stage Thermodynamic Conversion Cascade
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Stage 1 */}
          <div className="glass-card-subtle p-4 border border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-cyan-400 font-mono text-xs font-bold">
                  01
                </span>
                <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-900 dark:text-slate-100">Waste Feedstock</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 font-normal">Autoclaved clinical & polymer solids</p>
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Feed Rate:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{feedRate} kg/h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Plastic Fraction:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{plasticPct}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Moisture:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{moisturePct}%</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex justify-between items-center text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Chemical Power:</span>
              <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                {overall.waste_input_kw?.toFixed(1)} kWth
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
                <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-900 dark:text-slate-100">Gasification</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 font-normal">Fluidized thermochemical reaction</p>
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Syngas Flow:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{gasification.syngas_flow_nm3_h?.toFixed(1)} Nm³/h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Syngas LHV:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{gasification.syngas_lhv_mj_nm3?.toFixed(2)} MJ/Nm³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Syngas Power:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{gasification.syngas_power_kw?.toFixed(1)} kW</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex justify-between items-center text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Cold Gas Eff:</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {overall.gasification_efficiency_pct?.toFixed(1)}%
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
                <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-900 dark:text-slate-100">HRSG Boiler</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 font-normal">High pressure superheated steam</p>
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Steam Flow:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{steam.steam_flow_kg_h?.toFixed(1)} kg/h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Steam Pressure:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{steam.steam_pressure_bar?.toFixed(1)} bar</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Steam Temp:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{steam.steam_temp_c?.toFixed(1)} °C</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex justify-between items-center text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Absorbed Duty:</span>
              <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                {steam.heat_absorbed_kw?.toFixed(1)} kWth
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
                <span className="text-xs font-bold font-mono uppercase tracking-wide text-slate-900 dark:text-slate-100">Turbine & CHP</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 font-normal">Rankine generation + 85°C water</p>
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Gross Gen:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{turbine.gross_power_kw?.toFixed(1)} kWe</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Parasitic Load:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">-{turbine.parasitic_load_kw?.toFixed(1)} kWe</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Useful Heat:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{heatExchanger.heat_recovered_kw?.toFixed(1)} kWth</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex justify-between items-center text-xs">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Net Export:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {overall.electrical_output_kw?.toFixed(1)} kWe
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sensitivity Tuning + Technology Benchmark */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tuning */}
        <div className="glass-card p-5 space-y-4 border border-slate-200 dark:border-white/10">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Sliders size={15} className="text-blue-600 dark:text-cyan-400" />
            Thermodynamic Sensitivity Tuning
          </h2>

          <div className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">Feedstock Throughput:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{feedRate} kg/h</span>
              </div>
              <input
                type="range"
                min="20"
                max="500"
                step="10"
                value={feedRate}
                onChange={(e) => setFeedRate(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">Plastic Fraction:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{plasticPct}%</span>
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
                <span className="font-mono font-bold text-slate-900 dark:text-white">{moisturePct}%</span>
              </div>
              <input
                type="range"
                min="2"
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
                <span className="font-mono font-bold text-slate-900 dark:text-white">{turbineEff}%</span>
              </div>
              <input
                type="range"
                min="60"
                max="90"
                step="2"
                value={turbineEff}
                onChange={(e) => setTurbineEff(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
              />
            </div>

            <button
              onClick={fetchEnergyData}
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
            >
              Update Thermodynamic Balances
            </button>
          </div>
        </div>

        {/* Benchmarking Comparison */}
        <div className="glass-card p-5 border border-slate-200 dark:border-white/10 space-y-3">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Sparkles size={15} className="text-amber-500" />
            Benchmarking: Incinerator vs. Gasification CHP
          </h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Performance Metric</th>
                <th>Standard Incinerator</th>
                <th>Fluidized Gasifier + CHP</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-sans text-slate-700 dark:text-slate-300 font-medium">Total Energy Recovery</td>
                <td className="text-rose-600 dark:text-rose-400 font-semibold">20 - 32%</td>
                <td className="text-emerald-600 dark:text-emerald-400 font-bold">58 - 72%</td>
              </tr>
              <tr>
                <td className="font-sans text-slate-700 dark:text-slate-300 font-medium">Net Electrical Efficiency</td>
                <td className="text-slate-600 dark:text-slate-400 font-semibold">8 - 11%</td>
                <td className="text-blue-600 dark:text-cyan-400 font-bold">13 - 17%</td>
              </tr>
              <tr>
                <td className="font-sans text-slate-700 dark:text-slate-300 font-medium">Useful Heat Capture</td>
                <td className="text-slate-600 dark:text-slate-400 font-semibold">Negligible (Stack Loss)</td>
                <td className="text-emerald-600 dark:text-emerald-400 font-bold">Hospital Autoclaves 85°C</td>
              </tr>
              <tr>
                <td className="font-sans text-slate-700 dark:text-slate-300 font-medium">Dioxin / Furans</td>
                <td className="text-amber-600 dark:text-amber-400 font-semibold">Elevated without SCR</td>
                <td className="text-emerald-600 dark:text-emerald-400 font-bold">Sub-stoichiometric reduction</td>
              </tr>
              <tr>
                <td className="font-sans text-slate-700 dark:text-slate-300 font-medium">Fly Ash Mass</td>
                <td className="text-slate-600 dark:text-slate-400 font-semibold">18 - 25% by weight</td>
                <td className="text-blue-600 dark:text-cyan-400 font-bold">8 - 12% Vitrified Ash</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
