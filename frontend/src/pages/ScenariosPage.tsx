import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { Scenario, SimulationResult } from '../types'
import FluidizationHeadline from '../components/FluidizationHeadline'
import ComparisonTable from '../components/ComparisonTable'
import AssumptionsPanel from '../components/AssumptionsPanel'
import {
  List,
  Play,
  CheckCircle,
  Sliders,
  FileText,
  AlertTriangle,
  RotateCw,
  Flame,
  Zap,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react'

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedId, setSelectedId] = useState<string>('normal')
  const [running, setRunning] = useState<boolean>(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [allScenarioResults, setAllScenarioResults] = useState<SimulationResult[]>([])
  const [loadingComparison, setLoadingComparison] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'detail' | 'comparison' | 'assumptions'>('detail')

  // Load list of scenarios
  const loadScenarios = async () => {
    try {
      const res = await api.get('/scenarios')
      // Filter out custom option for the 8 core benchmark scenarios
      const coreScenarios = (res.scenarios || []).filter((s: Scenario) => s.id !== 'custom')
      setScenarios(coreScenarios)
    } catch (e: any) {
      console.error('Failed to load scenarios:', e)
    }
  }

  // Load all scenarios for the comparison table
  const loadComparisonData = async () => {
    setLoadingComparison(true)
    try {
      // Try dedicated comparison endpoint first
      const compRes = await api.get('/scenarios/comparison').catch(() => null)
      if (compRes && compRes.scenarios) {
        setAllScenarioResults(compRes.scenarios)
      } else {
        // Fallback: fetch standard 8 scenarios in parallel
        const scenarioIds = [
          'normal',
          'high_plastic',
          'high_moisture',
          'early_agglomeration',
          'severe_clumping',
          'high_throughput',
          'low_airflow',
          'defluidized_agglomeration',
        ]
        const promises = scenarioIds.map((id) =>
          api.post(`/scenarios/${id}/run`).then((r) => r.result || r)
        )
        const results = await Promise.all(promises)
        setAllScenarioResults(results)
      }
    } catch (e: any) {
      console.error('Failed to load scenario comparisons:', e)
    } finally {
      setLoadingComparison(false)
    }
  }

  // Execute or view selected scenario
  const selectScenario = async (id: string) => {
    setSelectedId(id)
    setError(null)
    setRunning(true)
    try {
      const res = await api.post(`/scenarios/${id}/run`)
      const simResult: SimulationResult = res.result || res
      setResult(simResult)
    } catch (e: any) {
      setError(e.message || 'Failed to execute scenario')
    } finally {
      setRunning(false)
    }
  }

  const runSelected = async () => {
    await selectScenario(selectedId)
  }

  useEffect(() => {
    loadScenarios()
    selectScenario('normal')
    loadComparisonData()
  }, [])

  const selectedScenario = scenarios.find((s) => s.id === selectedId)
  const selectedParams = result?.parameters || selectedScenario?.parameters

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <List className="text-blue-600 dark:text-cyan-400" size={24} />
              <span>Operational Scenarios & Stress Benchmarks</span>
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-cyan-500/20 text-blue-800 dark:text-cyan-300 border border-blue-300 dark:border-cyan-400/30">
              8 BENCHMARKS
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-normal">
            First-principles fluidization states, steam cycle cogeneration, whole-plant energy cascading, and side-by-side comparison
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={runSelected}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <RotateCw size={13} className={running ? 'animate-spin' : ''} />
            <span>{running ? 'Simulating...' : 'Execute Selected'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/30 rounded-lg text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <span className="font-bold">Scenario Execution Error:</span> {error}
            </div>
          </div>
          <button
            onClick={runSelected}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-xs transition shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Scenario Selector Grid: All 8 Scenarios */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Select Benchmark Scenario (All 8 Documented Cases)
          </span>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Selected: <strong className="text-blue-600 dark:text-cyan-400">{selectedId}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {scenarios.map((sc) => {
            const isSelected = sc.id === selectedId
            const isDefluidized = sc.id === 'defluidized_agglomeration'

            return (
              <button
                key={sc.id}
                onClick={() => selectScenario(sc.id)}
                className={`text-left p-3 rounded-xl transition-all flex flex-col justify-between relative overflow-hidden group cursor-pointer ${
                  isSelected
                    ? 'glass-card border-blue-600 dark:border-cyan-400 shadow-sm bg-blue-50/70 dark:bg-cyan-500/10'
                    : isDefluidized
                    ? 'glass-card border-rose-300 dark:border-rose-500/40 hover:border-rose-400 bg-rose-50/30 dark:bg-rose-500/5'
                    : 'glass-card border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-sans">
                      {sc.name}
                    </span>
                    {isSelected && (
                      <CheckCircle size={14} className="text-blue-600 dark:text-cyan-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-tight">
                    {sc.description}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-[10px] font-mono">
                  <span className={`font-semibold ${isDefluidized ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
                    {sc.id}
                  </span>
                  <span className="text-blue-600 dark:text-cyan-400 font-bold group-hover:underline">
                    {isSelected ? 'Viewing' : 'Select'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Task 1 Headline Block: Fluidization Hydrodynamic State */}
      <FluidizationHeadline fluid={result?.fluidization} loading={running} />

      {/* Navigation Tabs: Detailed Results | Scenario Matrix Comparison | Assumptions Panel */}
      <div className="flex border-b border-slate-200 dark:border-white/10 gap-2">
        <button
          onClick={() => setActiveTab('detail')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'detail'
              ? 'border-blue-600 dark:border-cyan-400 text-blue-700 dark:text-cyan-300 bg-blue-50/50 dark:bg-cyan-500/5'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Activity size={14} />
          <span>Selected Scenario Detail</span>
        </button>

        <button
          onClick={() => setActiveTab('comparison')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'comparison'
              ? 'border-blue-600 dark:border-cyan-400 text-blue-700 dark:text-cyan-300 bg-blue-50/50 dark:bg-cyan-500/5'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers size={14} />
          <span>8-Scenario Comparison Matrix (Task 3)</span>
        </button>

        <button
          onClick={() => setActiveTab('assumptions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold font-mono uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'assumptions'
              ? 'border-blue-600 dark:border-cyan-400 text-blue-700 dark:text-cyan-300 bg-blue-50/50 dark:bg-cyan-500/5'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sliders size={14} />
          <span>Assumptions &amp; Closure Panel (Task 4)</span>
        </button>
      </div>

      {/* Tab 1: Detailed Selected Scenario Results */}
      {activeTab === 'detail' && (
        <div className="space-y-6">
          {running ? (
            <div className="glass-card p-12 text-center text-slate-500 text-xs font-mono animate-pulse">
              Simulating digital twin for scenario: {selectedId}...
            </div>
          ) : result ? (
            <div className="space-y-6 animate-in">
              {/* Primary KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="metric-card">
                  <div className="metric-label">Net Electricity</div>
                  <div className="metric-value text-emerald-600 dark:text-emerald-400">
                    {(result.overall?.net_power_kw ?? result.overall?.electrical_output_kw ?? 0).toFixed(1)}{' '}
                    <span className="metric-unit">kWe</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 font-semibold">
                    Net export power
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">Useful District Heat</div>
                  <div className="metric-value text-amber-600 dark:text-amber-400">
                    {(result.overall?.heat_recovery_kw ?? 0).toFixed(1)}{' '}
                    <span className="metric-unit">kWth</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 font-semibold">
                    70°C hot water recovery
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">Combined CHP Eff.</div>
                  <div className="metric-value text-blue-600 dark:text-cyan-400">
                    {(result.overall?.overall_efficiency_pct ?? 0).toFixed(2)}{' '}
                    <span className="metric-unit">%</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 font-semibold">
                    First-Law useful yield
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">Cold Gas Eff.</div>
                  <div className="metric-value text-slate-900 dark:text-slate-100">
                    {(result.overall?.gasification_efficiency_pct ?? 0).toFixed(2)}{' '}
                    <span className="metric-unit">%</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 font-semibold">
                    Syngas / fuel chemical
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">Equivalence Ratio</div>
                  <div className="metric-value text-slate-900 dark:text-slate-100">
                    {(result.equivalence_ratio ?? result.gasification?.equivalence_ratio ?? 0).toFixed(4)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 font-semibold">
                    Target baseline ~0.30
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">Reactor Thermal State</div>
                  <div className={`metric-value text-sm font-bold ${
                    result.reactor_thermal_regime === 'AUTOTHERMAL' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {result.reactor_thermal_regime ?? 'AUTOTHERMAL'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 font-semibold">
                    {result.reactor_heat_balance_kw !== undefined && result.reactor_heat_balance_kw >= 0
                      ? `+${result.reactor_heat_balance_kw.toFixed(1)} kW surplus`
                      : `${result.reactor_heat_balance_kw?.toFixed(1)} kW deficit`}
                  </div>
                </div>
              </div>

              {/* Two Column Technical Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gasification & Syngas Performance */}
                <div className="glass-card p-5 space-y-3.5 border border-slate-200 dark:border-white/10">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                    <Flame size={15} className="text-amber-500" />
                    Gasification Yield & Syngas Quality
                  </h3>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/70 dark:border-white/5">
                      <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Syngas LHV:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {result.gasification?.syngas_lhv_mj_nm3?.toFixed(3)} MJ/Nm³
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/70 dark:border-white/5">
                      <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Syngas Flow Rate:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {result.gasification?.syngas_flow_nm3_h?.toFixed(2)} Nm³/h ({result.gasification?.gas_mass_flow_kg_h?.toFixed(2)} kg/h)
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/70 dark:border-white/5">
                      <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Thermal Chemical Energy:</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {result.gasification?.thermal_energy_kw?.toFixed(2)} kW
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/70 dark:border-white/5">
                      <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Carbon Conversion (X_C):</span>
                      <span className="font-bold text-blue-600 dark:text-cyan-400">
                        {((result.gasification?.carbon_conversion ?? 0) * 100).toFixed(2)} %
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Char / Ash Residue:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {result.gasification?.char_ash_kg_h?.toFixed(2)} kg/h
                      </span>
                    </div>
                  </div>

                  {/* Gas Composition Table */}
                  {result.gasification?.gas_composition && (
                    <div className="pt-2">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Dry Syngas Species Composition (mol fraction):
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center font-mono text-[11px]">
                        {Object.entries(result.gasification.gas_composition).map(([species, frac]) => (
                          <div key={species} className="p-1.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            <div className="text-[10px] text-slate-500">{species}</div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {(Number(frac) * 100).toFixed(1)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Steam Cycle & Rankine Turbogenerator */}
                <div className="glass-card p-5 space-y-3.5 border border-slate-200 dark:border-white/10">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                    <Zap size={15} className="text-blue-600 dark:text-cyan-400" />
                    Steam Rankine Loop (IAPWS-IF97)
                  </h3>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200/70 dark:border-white/5">
                      <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Steam Mass Flow:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {result.steam_cycle?.steam_flow_kg_h?.toFixed(2)} kg/h
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/70 dark:border-white/5">
                      <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Steam State:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {result.steam_cycle?.steam_temp_c?.toFixed(1)} °C @ {result.steam_cycle?.steam_pressure_bar?.toFixed(1)} bar
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/70 dark:border-white/5">
                      <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Boiler Heat Duty:</span>
                      <span className="font-bold text-blue-600 dark:text-cyan-400">
                        {result.steam_cycle?.boiler_duty_kw?.toFixed(2)} kWth
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/70 dark:border-white/5">
                      <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Gross Turbine Power:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {result.turbine?.electrical_power_kw?.toFixed(2)} kWe
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/70 dark:border-white/5">
                      <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Feed Pump Electric Aux:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        -{result.overall?.feed_pump_electrical_kw?.toFixed(3) ?? '0.544'} kWe
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Net Electrical Output:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {result.overall?.net_power_kw?.toFixed(2)} kWe
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-100/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-400 font-sans">
                    <strong>District Water:</strong> 70°C water supply delivery with{' '}
                    <code className="text-amber-600 dark:text-amber-400 font-mono">
                      {result.heat_exchanger?.recovered_heat_kw?.toFixed(1)} kWth
                    </code>{' '}
                    thermal duty captured across condenser.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-16 text-center text-slate-500 space-y-2 border border-slate-200 dark:border-white/10">
              <FileText size={32} className="mx-auto text-slate-400" />
              <div className="text-xs font-medium">
                Select a scenario above to view comprehensive digital twin physics results.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Comparison Matrix (Task 3) */}
      {activeTab === 'comparison' && (
        <ComparisonTable
          scenarios={allScenarioResults}
          selectedId={selectedId}
          onSelectScenario={(id) => {
            selectScenario(id)
            setActiveTab('detail')
          }}
          loading={loadingComparison}
        />
      )}

      {/* Tab 3: Assumptions Panel (Task 4) */}
      {activeTab === 'assumptions' && <AssumptionsPanel />}
    </div>
  )
}
