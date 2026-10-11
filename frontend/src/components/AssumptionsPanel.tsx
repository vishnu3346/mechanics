import React from 'react'
import { BookOpen, AlertCircle, Info, ShieldAlert, Cpu } from 'lucide-react'

export default function AssumptionsPanel() {
  const ASSUMPTIONS = [
    {
      category: 'Thermodynamics & Steam Generation',
      name: 'Boiler Thermal Efficiency',
      symbol: 'η_boiler',
      value: '85.0% (0.85)',
      isAssumption: true,
      text: 'The boiler heat capture efficiency is modeled as a fixed engineering assumption (η_boiler = 0.85). In physical heat recovery steam generators (HRSG), actual efficiency varies dynamically with fouling factor, excess air ratio, acid gas dew point limits, and convective pass sootblowing cycles. (METHODOLOGY.md §9.1)',
    },
    {
      category: 'Thermodynamics & Cogeneration',
      name: 'District Heat Exchanger Effectiveness',
      symbol: 'ε_hx',
      value: '80.75% (0.8075)',
      isAssumption: true,
      text: 'The overall thermal recovery effectiveness is taken as ε_hx = 0.85 × 0.95 = 0.8075 (combining plate heat exchanger effectiveness ε=0.85 and district distribution piping thermal efficiency 0.95). Actual network return temperatures and ambient seasonal heat demands will alter heat recovery. (METHODOLOGY.md §9.2)',
    },
    {
      category: 'Thermochemical Gasification Kinetics',
      name: 'Semi-Empirical Carbon Conversion Formula & Constants',
      symbol: 'X_C',
      value: 'X_C = X_C,pot · [f_vol + (1 - f_vol) · (1 - e^(-ER / ER_ref))]',
      isAssumption: true,
      constants: 'f_vol = 0.65 (baseline volatile release), ER_ref = 0.18 (char scale)',
      text: 'The carbon conversion relationship is a semi-empirical engineering formulation rather than a detailed multi-phase particle kinetics solver. It approximates the transition from rapid devolatilization (f_vol = 0.65) to heterogeneous char oxidation (ER_ref = 0.18), but does not capture intra-particle pore diffusion or ash layer mass-transfer resistance. (METHODOLOGY.md §6.1 & §9.3)',
    },
    {
      category: 'Hydrodynamics & Bed Agglomeration',
      name: 'Maximum Agglomeration Cluster Growth Constant',
      symbol: 'k_agg',
      value: 'k_agg = 5.0 (d_p,eff = d_p · (1 + k_agg · a))',
      isAssumption: true,
      constants: 'Base sand d_p = 400 µm, a ∈ [0.0, 1.0]. At a = 1.0, clusters reach 6 × d_p = 2400 µm',
      text: 'Simplified engineering agglomeration growth factor. In fluidized bed gasification of polymer-rich waste, bed sand grains sinter and coalesce due to molten ash/polymer coatings, forming larger clusters. U_mf,eff is recalculated using Ergun and Wen-Yu correlations with d_p,eff. (METHODOLOGY.md §10.1)',
    },
    {
      category: 'Physical Reactor Hydrodynamics',
      name: 'Loss Fractions & Fluidization Geometry Baselines',
      symbol: 'Multiple',
      value: 'Wall loss = 2.0% LHV, ΔP_dist/ΔP_bed = 0.20, ε_mf = 0.45, φ_s = 0.80, H_mf = 0.50 m',
      isAssumption: true,
      text: 'Reactor wall conduction/convection loss is assumed as a baseline 2% of fuel chemical LHV (Q_wall = 0.02 · Q_chem,in). Distributor plate drop ratio is sized as 20% of bed buoyant weight (standard Kunii & Levenspiel design rule). Sand sphericity is 0.80 (angular sand) with voidage 0.45 and slumped bed depth 0.50 m. (METHODOLOGY.md §1 & §7.1)',
    },
  ]

  return (
    <div className="glass-card p-5 lg:p-6 space-y-5 border border-slate-200 dark:border-white/10 shadow-sm">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm lg:text-base font-extrabold text-slate-900 dark:text-white tracking-tight font-mono flex items-center gap-2">
              <BookOpen className="text-blue-600 dark:text-cyan-400" size={18} />
              MODELING ASSUMPTIONS & DESIGN BOUNDARIES PANEL
            </h2>
            <span className="badge badge-info font-mono text-[10px]">
              METHODOLOGY.md Sourced
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5">
            Transparent disclosure of physical design assumptions, empirical kinetics constants, and First-Law closure constraints
          </p>
        </div>
      </div>

      {/* Assumptions List */}
      <div className="space-y-3.5">
        {ASSUMPTIONS.map((item, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {item.category}
                </span>
                <span className="text-slate-400">•</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 font-sans">
                  {item.name}
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold">
                  ({item.symbol})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-blue-700 dark:text-cyan-300 px-2 py-0.5 rounded bg-blue-100 dark:bg-cyan-500/20 border border-blue-300 dark:border-cyan-400/30">
                  {item.value}
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                  [ASSUMPTION]
                </span>
              </div>
            </div>

            {item.constants && (
              <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300 font-semibold">
                Constants: {item.constants}
              </div>
            )}

            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-sans font-medium">
              {item.text}
            </p>
          </div>
        ))}
      </div>

      {/* Special Box: Whole-Plant Closure Residual Disclosure */}
      <div className="p-4 rounded-xl border border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/70 dark:bg-indigo-500/10 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono font-bold text-indigo-900 dark:text-indigo-300 text-xs uppercase tracking-wide">
            <ShieldAlert size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Whole-Plant First-Law Energy Closure Residual: +95.78 kW (3.67%)</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/25 text-indigo-900 dark:text-indigo-200 border border-indigo-400/40">
            NOT AN INDEPENDENT ERROR
          </span>
        </div>

        <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium">
          <strong>Disclosure from METHODOLOGY.md §5.2 &amp; §9.4:</strong> The 3.67% (+95.78 kW) whole-plant energy balance discrepancy in the default scenario is{' '}
          <strong>identical to the net autothermal reaction heat surplus by construction</strong> (Q_net = +95.78 kW from <code className="text-indigo-600 dark:text-indigo-400 font-mono">compute_reactor_heat_balance</code>).
          It is <strong>not</strong> an independent error measure or an artificial leak term.
          Because the stack loss model assumes baseline sensible enthalpy required to reach 850°C (460.2 kW) while the exothermic partial oxidation chemistry yields an enthalpy surplus (+95.78 kW),
          this surplus manifests directly as the First-Law residual. No artificial plug terms are used to hide this physical quantity.
        </p>
      </div>
    </div>
  )
}
