import React, { useState } from 'react'
import type { SimulationResult } from '../types'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Flame,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Layers,
} from 'lucide-react'

interface ComparisonTableProps {
  scenarios: SimulationResult[]
  selectedId?: string
  onSelectScenario?: (id: string) => void
  loading?: boolean
}

type SortField =
  | 'name'
  | 'er'
  | 'u0_over_umf_eff'
  | 'physics_state'
  | 'net_electricity'
  | 'district_heat'
  | 'overall_efficiency'
  | 'heat_balance_sign'

export default function ComparisonTable({
  scenarios,
  selectedId,
  onSelectScenario,
  loading,
}: ComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortAsc, setSortAsc] = useState<boolean>(true)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} className="opacity-40" />
    }
    return sortAsc ? (
      <ArrowUp size={12} className="text-blue-600 dark:text-cyan-400" />
    ) : (
      <ArrowDown size={12} className="text-blue-600 dark:text-cyan-400" />
    )
  }

  // Extract metrics for comparison
  const rows = scenarios.map((s) => {
    const er = s.equivalence_ratio ?? s.gasification?.equivalence_ratio ?? 0.3
    const u0OverUmfEff =
      s.fluidization?.u0_over_umf_eff ??
      (s.fluidization?.umf_effective_m_s && s.fluidization.umf_effective_m_s > 0
        ? s.fluidization.u0_m_s / s.fluidization.umf_effective_m_s
        : 10.05)
    const physicsState =
      s.fluidization?.physics_state ?? s.physics_state ?? 'NORMAL_FLUIDIZATION'
    const netElectricity =
      s.whole_plant_closure?.net_electrical_power_kw ??
      s.overall?.net_power_kw ??
      s.turbine?.electrical_power_kw ??
      0
    const districtHeat =
      s.whole_plant_closure?.district_heat_kw ??
      s.overall?.heat_recovery_kw ??
      s.heat_exchanger?.recovered_heat_kw ??
      0
    const overallEff = s.overall?.overall_efficiency_pct ?? 0
    const heatBalanceKw =
      s.reactor_heat_balance_kw ??
      s.gasification?.reactor_heat_balance_kw ??
      s.overall?.reactor_heat_balance_kw ??
      0
    const heatBalanceSign = heatBalanceKw >= 0 ? '+' : '-'
    const heatBalanceRegime =
      s.reactor_thermal_regime ??
      s.gasification?.reactor_thermal_regime ??
      (heatBalanceKw >= 0 ? 'AUTOTHERMAL' : 'ALLOTHERMAL')

    const isDefluidizedScenario =
      s.scenario_id === 'defluidized_agglomeration' ||
      s.scenario_name.toLowerCase().includes('defluidized')

    return {
      id: s.scenario_id,
      name: s.scenario_name,
      er,
      u0OverUmfEff,
      physicsState,
      netElectricity,
      districtHeat,
      overallEff,
      heatBalanceKw,
      heatBalanceSign,
      heatBalanceRegime,
      isDefluidizedScenario,
      raw: s,
    }
  })

  // Sort rows
  const sortedRows = [...rows].sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'er':
        comparison = a.er - b.er
        break
      case 'u0_over_umf_eff':
        comparison = a.u0OverUmfEff - b.u0OverUmfEff
        break
      case 'physics_state':
        comparison = a.physicsState.localeCompare(b.physicsState)
        break
      case 'net_electricity':
        comparison = a.netElectricity - b.netElectricity
        break
      case 'district_heat':
        comparison = a.districtHeat - b.districtHeat
        break
      case 'overall_efficiency':
        comparison = a.overallEff - b.overallEff
        break
      case 'heat_balance_sign':
        comparison = a.heatBalanceKw - b.heatBalanceKw
        break
    }
    return sortAsc ? comparison : -comparison
  })

  return (
    <div className="glass-card p-5 lg:p-6 space-y-4 border border-slate-200 dark:border-white/10 shadow-sm">
      {/* Table Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm lg:text-base font-extrabold text-slate-900 dark:text-white tracking-tight font-mono flex items-center gap-2">
              <Layers className="text-blue-600 dark:text-cyan-400" size={18} />
              SCENARIO COMPARISON MATRIX (ALL 8 BENCHMARKS SIDE-BY-SIDE)
            </h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-cyan-500/20 text-blue-800 dark:text-cyan-300 border border-blue-300 dark:border-cyan-400/30">
              Sortable
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5">
            Compare equivalence ratios, effective fluidization margins, power outputs, and thermal regimes across all operational states
          </p>
        </div>

        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 flex items-center gap-2">
          <span>Highlight:</span>
          <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30 font-bold">
            defluidized_agglomeration
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs font-mono animate-pulse">
          Simulating and collating all 8 operational scenarios...
        </div>
      ) : rows.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs font-mono">
          No comparison data loaded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
          <table className="data-table w-full text-xs">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[11px]">
                <th
                  onClick={() => handleSort('name')}
                  className="cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Scenario</span>
                    {getSortIcon('name')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('er')}
                  className="cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>ER (Equivalence)</span>
                    {getSortIcon('er')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('u0_over_umf_eff')}
                  className="cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>U₀ / U_mf,eff</span>
                    {getSortIcon('u0_over_umf_eff')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('physics_state')}
                  className="cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Physics State</span>
                    {getSortIcon('physics_state')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('net_electricity')}
                  className="cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Net Electricity (kWe)</span>
                    {getSortIcon('net_electricity')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('district_heat')}
                  className="cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>District Heat (kWth)</span>
                    {getSortIcon('district_heat')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('overall_efficiency')}
                  className="cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Overall CHP Eff. (%)</span>
                    {getSortIcon('overall_efficiency')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('heat_balance_sign')}
                  className="cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Reactor Heat Balance</span>
                    {getSortIcon('heat_balance_sign')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => {
                const isSelected = selectedId === r.id
                const isDefluidized = r.isDefluidizedScenario

                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelectScenario && onSelectScenario(r.id)}
                    className={`transition-colors cursor-pointer ${
                      isDefluidized
                        ? 'bg-rose-500/15 dark:bg-rose-500/20 border-l-4 border-l-rose-500 hover:bg-rose-500/25'
                        : isSelected
                        ? 'bg-blue-500/15 dark:bg-cyan-500/15 border-l-4 border-l-blue-600 dark:border-l-cyan-400'
                        : 'hover:bg-slate-100/70 dark:hover:bg-white/5'
                    }`}
                  >
                    {/* Scenario Name & ID */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-sans">
                          {r.name}
                        </span>
                        {isDefluidized && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-200 dark:bg-rose-500/30 text-rose-900 dark:text-rose-200 border border-rose-400">
                            DEFLUIDIZED STRESS TEST
                          </span>
                        )}
                        {isSelected && !isDefluidized && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-cyan-500/20 text-blue-700 dark:text-cyan-300">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        id: {r.id}
                      </div>
                    </td>

                    {/* ER */}
                    <td className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {r.er.toFixed(4)}
                    </td>

                    {/* U0 / Umf_eff */}
                    <td className="font-mono">
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                          r.u0OverUmfEff < 1.0
                            ? 'bg-rose-100 dark:bg-rose-500/25 text-rose-800 dark:text-rose-300 font-black border border-rose-300 dark:border-rose-500/40'
                            : r.u0OverUmfEff < 2.0
                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-500/40'
                            : 'text-emerald-700 dark:text-emerald-400 font-bold'
                        }`}
                      >
                        {r.u0OverUmfEff.toFixed(3)}
                      </span>
                    </td>

                    {/* Physics State */}
                    <td>
                      <span
                        className={`badge ${
                          r.physicsState === 'NORMAL_FLUIDIZATION'
                            ? 'badge-success'
                            : r.physicsState === 'EARLY_AGGLOMERATION'
                            ? 'badge-warning'
                            : 'badge-danger font-bold'
                        }`}
                      >
                        {r.physicsState.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Net Electricity */}
                    <td className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {r.netElectricity.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">kWe</span>
                    </td>

                    {/* District Heat */}
                    <td className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      {r.districtHeat.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">kWth</span>
                    </td>

                    {/* Overall Efficiency */}
                    <td className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                      {r.overallEff.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">%</span>
                    </td>

                    {/* Reactor Heat Balance Sign */}
                    <td className="font-mono">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-black text-sm px-1.5 py-0.5 rounded ${
                            r.heatBalanceSign === '+'
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {r.heatBalanceSign}
                        </span>
                        <div>
                          <div className={`font-bold text-[11px] ${r.heatBalanceSign === '+' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                            {r.heatBalanceKw > 0 ? `+${r.heatBalanceKw.toFixed(1)}` : r.heatBalanceKw.toFixed(1)} kW
                          </div>
                          <div className="text-[9px] text-slate-500 dark:text-slate-400 font-sans">
                            {r.heatBalanceRegime}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
