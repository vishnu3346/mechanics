import React from 'react'
import type { FluidizationResult } from '../types'
import { Activity, Gauge, Wind, AlertTriangle, ShieldCheck, Info } from 'lucide-react'

interface FluidizationHeadlineProps {
  fluid: FluidizationResult | undefined
  loading?: boolean
}

export default function FluidizationHeadline({ fluid, loading }: FluidizationHeadlineProps) {
  if (loading) {
    return (
      <div className="glass-card p-6 border border-slate-200 dark:border-white/10 animate-pulse">
        <div className="h-6 w-64 bg-slate-200 dark:bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-200 dark:bg-white/5 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!fluid) {
    return (
      <div className="glass-card p-6 border border-slate-200 dark:border-white/10 text-center text-slate-500 text-xs">
        No fluidization hydrodynamic data available for this scenario.
      </div>
    )
  }

  // Derive regime and style based on documented physics thresholds
  // Bubbling: U0/Umf_eff >= 2.0 and U0/Ut < 0.50
  // Slugging / Early Agglomeration: 1.0 <= U0/Umf_eff < 2.0 or 0.50 <= U0/Ut < 0.75
  // Fixed / Defluidized: U0/Umf_eff < 1.0
  // Terminal blowout / Entrained: U0/Ut >= 0.75
  const u0OverUmfEff = fluid.u0_over_umf_eff ?? (fluid.umf_effective_m_s > 0 ? fluid.u0_m_s / fluid.umf_effective_m_s : 0)
  const u0OverUt = fluid.u0_over_ut ?? (fluid.ut_m_s > 0 ? fluid.u0_m_s / fluid.ut_m_s : 0)

  let regimeLabel = 'Bubbling Fluidization'
  let regimeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
  let regimeBadgeText = 'STABLE BUBBLING'
  let regimeIcon = ShieldCheck

  if (u0OverUmfEff < 1.0) {
    regimeLabel = 'Fixed / Slumped Bed (Defluidized)'
    regimeColor = 'bg-rose-100 text-rose-800 dark:bg-rose-500/25 dark:text-rose-300 border-rose-300 dark:border-rose-500/50 shadow-glow-rose'
    regimeBadgeText = 'COMPLETE DEFLUIDIZATION'
    regimeIcon = AlertTriangle
  } else if (u0OverUt >= 0.75) {
    regimeLabel = 'Entrained / Blowout Hazard'
    regimeColor = 'bg-rose-100 text-rose-800 dark:bg-rose-500/25 dark:text-rose-300 border-rose-300 dark:border-rose-500/50'
    regimeBadgeText = 'BLOWOUT / ENTRAINED'
    regimeIcon = AlertTriangle
  } else if (u0OverUmfEff < 2.0 || u0OverUt >= 0.50) {
    regimeLabel = 'Slugging / Transitional Margin'
    regimeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
    regimeBadgeText = 'INCIPIENT AGGLOMERATION'
    regimeIcon = AlertTriangle
  }

  const RegimeIconComponent = regimeIcon

  return (
    <div className="glass-card p-5 lg:p-6 space-y-5 border border-slate-200 dark:border-white/10 shadow-sm">
      {/* Top Bar: Headline Title & Regime Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-cyan-500/20 text-blue-700 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Activity size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm lg:text-base font-extrabold text-slate-900 dark:text-white tracking-tight font-mono">
                FLUIDIZATION HYDRODYNAMICS HEADLINE
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-white/10 font-bold">
                Geldart Group {fluid.geldart_group}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              First-principles Ergun (1952), Wen-Yu (1966), and Haider-Levenspiel (1989) stability metrics
            </p>
          </div>
        </div>

        {/* Dynamic Status Pill */}
        <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border font-mono font-bold text-xs ${regimeColor}`}>
          <RegimeIconComponent size={15} className="shrink-0" />
          <span>{regimeBadgeText}: {regimeLabel}</span>
        </div>
      </div>

      {/* Headline Metric Blocks (7 core parameters) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* 1. U0 */}
        <div className="metric-card p-3">
          <div className="metric-label text-[10px] flex items-center justify-between">
            <span>U₀ Superficial</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">m/s</span>
          </div>
          <div className="metric-value text-base lg:text-lg text-slate-900 dark:text-white font-mono mt-0.5">
            {fluid.u0_m_s.toFixed(4)} <span className="text-xs font-normal text-slate-500">m/s</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-sans">
            Operating gas velocity
          </p>
        </div>

        {/* 2. Umf Wen-Yu */}
        <div className="metric-card p-3">
          <div className="metric-label text-[10px] flex items-center justify-between">
            <span>U_mf (Wen-Yu)</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">m/s</span>
          </div>
          <div className="metric-value text-base lg:text-lg text-blue-600 dark:text-cyan-400 font-mono mt-0.5">
            {fluid.umf_wen_yu_m_s.toFixed(4)} <span className="text-xs font-normal text-slate-500">m/s</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-sans">
            Wen & Yu (1966)
          </p>
        </div>

        {/* 3. Umf Ergun */}
        <div className="metric-card p-3">
          <div className="metric-label text-[10px] flex items-center justify-between">
            <span>U_mf (Ergun)</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">m/s</span>
          </div>
          <div className="metric-value text-base lg:text-lg text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
            {fluid.umf_ergun_m_s.toFixed(4)} <span className="text-xs font-normal text-slate-500">m/s</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-sans">
            Ergun (1952) quadratic
          </p>
        </div>

        {/* 4. U0 / Umf_eff */}
        <div className={`metric-card p-3 ${
          u0OverUmfEff < 1.0
            ? 'border-rose-400 dark:border-rose-500/60 bg-rose-50/50 dark:bg-rose-500/10'
            : u0OverUmfEff < 2.0
            ? 'border-amber-400 dark:border-amber-500/60 bg-amber-50/50 dark:bg-amber-500/10'
            : 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-500/10'
        }`}>
          <div className="metric-label text-[10px] flex items-center justify-between">
            <span className="font-bold">U₀ / U_mf,eff</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">ratio</span>
          </div>
          <div className={`metric-value text-base lg:text-lg font-mono mt-0.5 ${
            u0OverUmfEff < 1.0
              ? 'text-rose-600 dark:text-rose-400 font-black'
              : u0OverUmfEff < 2.0
              ? 'text-amber-600 dark:text-amber-400 font-bold'
              : 'text-emerald-600 dark:text-emerald-400 font-bold'
          }`}>
            {u0OverUmfEff.toFixed(3)}
          </div>
          <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 font-sans font-medium">
            {u0OverUmfEff < 1.0 ? 'Defluidized (< 1.0)' : u0OverUmfEff < 2.0 ? 'Early clumping (< 2.0)' : 'Stable bubbling (≥ 2.0)'}
          </p>
        </div>

        {/* 5. Ut */}
        <div className="metric-card p-3">
          <div className="metric-label text-[10px] flex items-center justify-between">
            <span>U_t Terminal</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">m/s</span>
          </div>
          <div className="metric-value text-base lg:text-lg text-slate-900 dark:text-white font-mono mt-0.5">
            {fluid.ut_m_s.toFixed(4)} <span className="text-xs font-normal text-slate-500">m/s</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-sans">
            Haider-Levenspiel drag
          </p>
        </div>

        {/* 6. U0 / Ut */}
        <div className={`metric-card p-3 ${
          u0OverUt >= 0.75
            ? 'border-rose-400 dark:border-rose-500/60 bg-rose-50/50 dark:bg-rose-500/10'
            : u0OverUt >= 0.50
            ? 'border-amber-400 dark:border-amber-500/60 bg-amber-50/50 dark:bg-amber-500/10'
            : 'border-slate-200 dark:border-white/10'
        }`}>
          <div className="metric-label text-[10px] flex items-center justify-between">
            <span className="font-bold">U₀ / U_t</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">ratio</span>
          </div>
          <div className={`metric-value text-base lg:text-lg font-mono mt-0.5 ${
            u0OverUt >= 0.75 ? 'text-rose-600 dark:text-rose-400 font-bold' : u0OverUt >= 0.50 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-900 dark:text-white'
          }`}>
            {u0OverUt.toFixed(4)}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-sans">
            {u0OverUt < 0.50 ? 'Low carryover (< 0.50)' : 'Transitioning to slugging'}
          </p>
        </div>

        {/* 7. dP_bed */}
        <div className="metric-card p-3">
          <div className="metric-label text-[10px] flex items-center justify-between">
            <span>ΔP_bed Plateau</span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">kPa</span>
          </div>
          <div className="metric-value text-base lg:text-lg text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
            {fluid.dp_bed_kpa.toFixed(3)} <span className="text-xs font-normal text-slate-500">kPa</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-sans">
            Buoyant weight plateau
          </p>
        </div>
      </div>

      {/* Threshold Legend Bar */}
      <div className="p-3.5 rounded-lg bg-slate-100/90 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] tracking-wider text-slate-700 dark:text-slate-300 font-mono">
          <Info size={13} className="text-blue-600 dark:text-cyan-400" />
          Documented Hydrodynamic Regime Thresholds (METHODOLOGY.md §2.6 & §10.2)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[11px] font-mono">
          <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300">
            <div className="font-bold">● Bubbling Fluidization (Stable)</div>
            <div className="text-[10px] text-emerald-800 dark:text-emerald-400 mt-0.5">
              U₀/U_mf,eff ≥ 2.0 &amp; U₀/U_t &lt; 0.50
            </div>
            <div className="text-[9px] text-slate-600 dark:text-slate-400 mt-0.5 font-sans">
              Solid bed expansion, buoyant plateau ~7.15 kPa.
            </div>
          </div>

          <div className="p-2 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-300">
            <div className="font-bold">● Slugging / Incipient Agglomeration</div>
            <div className="text-[10px] text-amber-800 dark:text-amber-400 mt-0.5">
              1.0 ≤ U₀/U_mf,eff &lt; 2.0 or 0.50 ≤ U₀/U_t &lt; 0.75
            </div>
            <div className="text-[9px] text-slate-600 dark:text-slate-400 mt-0.5 font-sans">
              Cluster growth, degraded solids mixing.
            </div>
          </div>

          <div className="p-2 rounded bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 text-rose-900 dark:text-rose-300">
            <div className="font-bold">● Fixed / Defluidized Bed Collapse</div>
            <div className="text-[10px] text-rose-800 dark:text-rose-400 mt-0.5">
              U₀/U_mf,eff &lt; 1.0
            </div>
            <div className="text-[9px] text-slate-600 dark:text-slate-400 mt-0.5 font-sans">
              Superficial velocity below minimum; packed bed slump.
            </div>
          </div>

          <div className="p-2 rounded bg-purple-50 dark:bg-purple-500/10 border border-purple-300 dark:border-purple-500/30 text-purple-900 dark:text-purple-300">
            <div className="font-bold">● Entrained / Terminal Blowout</div>
            <div className="text-[10px] text-purple-800 dark:text-purple-400 mt-0.5">
              U₀/U_t ≥ 0.75 (or U₀ ≥ U_t)
            </div>
            <div className="text-[9px] text-slate-600 dark:text-slate-400 mt-0.5 font-sans">
              Approaches terminal velocity; massive solids carryover.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
