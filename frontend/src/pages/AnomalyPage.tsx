import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { SimulationResult, Scenario } from '../types'
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Flame,
  Wind,
  Gauge,
  Zap,
  Info,
  AlertOctagon,
  ArrowRight,
} from 'lucide-react'

export default function AnomalyPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('normal')
  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Sensor telemetry inputs
  const [bedTemp, setBedTemp] = useState<number>(850)
  const [airflow, setAirflow] = useState<number>(661)
  const [pressureDrop, setPressureDrop] = useState<number>(8.58)
  const [plasticRatio, setPlasticRatio] = useState<number>(20)

  const loadScenarios = async () => {
    try {
      const res = await api.get('/scenarios')
      const core = (res.scenarios || []).filter((s: Scenario) => s.id !== 'custom')
      setScenarios(core)
    } catch (e: any) {
      console.error(e)
    }
  }

  const evaluateScenario = async (scenarioId: string) => {
    setSelectedScenarioId(scenarioId)
    setLoading(true)
    setError(null)
    try {
      const res = await api.post(`/scenarios/${scenarioId}/run`)
      const data: SimulationResult = res.result || res
      setResult(data)
      if (data.parameters) {
        setBedTemp(data.parameters.reactor_temp_c)
        setAirflow(data.parameters.airflow_m3_h)
        setPlasticRatio(data.parameters.plastic_ratio)
      }
      if (data.fluidization) {
        setPressureDrop(data.fluidization.pressure_drop ?? data.fluidization.pressure_drop_kpa)
      }
    } catch (e: any) {
      setError(e.message || 'Failed to evaluate scenario')
    } finally {
      setLoading(false)
    }
  }

  const evaluateCustom = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/simulation/run', {
        reactor_temp_c: bedTemp,
        airflow_m3_h: airflow,
        plastic_ratio: plasticRatio / 100,
      })
      const data: SimulationResult = res.result || res
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Failed to evaluate telemetry inputs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadScenarios()
    evaluateScenario('normal')
  }, [])

  // Physics state (Primary Result)
  const physicsState =
    result?.fluidization?.physics_state ??
    result?.physics_state ??
    result?.anomaly?.physics_label ??
    'NORMAL_FLUIDIZATION'
  const physicsReason =
    result?.fluidization?.physics_reason ??
    result?.anomaly?.physics_reason ??
    'System operating within nominal stability parameters.'
  const physicsRisk =
    result?.fluidization?.physics_risk_level ??
    result?.anomaly?.risk_level ??
    'LOW'

  // ML state (Secondary Result - Experimental)
  const mlState = result?.anomaly?.state ?? 'NORMAL_FLUIDIZATION'
  const mlConfidence = result?.anomaly?.confidence ?? 0.0
  const mlLoaded = result?.anomaly?.model_loaded ?? false

  // Check for disagreement
  const isDisagreement = physicsState !== mlState

  // Color mapping
  const getPhysicsBadgeColor = (st: string) => {
    if (st === 'NORMAL_FLUIDIZATION') {
      return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
    }
    if (st === 'EARLY_AGGLOMERATION') {
      return 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
    }
    return 'bg-rose-100 dark:bg-rose-500/25 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/50 shadow-glow-rose'
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <ShieldAlert className="text-rose-500" size={24} />
              <span>Physics-First Diagnostics &amp; ML Safety Guard</span>
            </h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-cyan-500/20 text-blue-800 dark:text-cyan-300 border border-blue-300 dark:border-cyan-400/30">
              PHYSICS-FIRST
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-normal">
            Deterministic fluid mechanics classifier as primary ground-truth; machine learning telemetry prediction as secondary experimental model
          </p>
        </div>

        <button
          onClick={() => evaluateScenario(selectedScenarioId)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Evaluating Model...' : 'Refresh Evaluation'}
        </button>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/30 rounded-lg text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertOctagon size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <span className="font-bold">Evaluation Error:</span> {error}
            </div>
          </div>
          <button
            onClick={() => evaluateScenario(selectedScenarioId)}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-xs transition shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Scenario Benchmark Selector Strip */}
      <div className="glass-card p-4 space-y-2 border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <span>Evaluate Operational Benchmark Scenarios</span>
          <span>Selected: <strong className="text-blue-600 dark:text-cyan-400">{selectedScenarioId}</strong></span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {scenarios.map((sc) => {
            const isSelected = sc.id === selectedScenarioId
            const isDefluidized = sc.id === 'defluidized_agglomeration'

            return (
              <button
                key={sc.id}
                onClick={() => evaluateScenario(sc.id)}
                className={`p-2.5 rounded-lg text-left transition-all border text-xs cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 dark:border-cyan-400 bg-blue-50 dark:bg-cyan-500/15 shadow-xs'
                    : isDefluidized
                    ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50/40 dark:bg-rose-500/5 hover:border-rose-400'
                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-100/60 dark:hover:bg-white/5'
                }`}
              >
                <div className="font-bold text-[11px] text-slate-900 dark:text-slate-100 truncate">
                  {sc.name}
                </div>
                <div className={`text-[10px] font-mono mt-0.5 truncate ${isDefluidized ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500'}`}>
                  {sc.id}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* VISIBLE WARNING BANNER WHEN PHYSICS AND ML DISAGREE */}
      {isDisagreement && (
        <div className="p-4 rounded-xl border-2 border-rose-500 dark:border-rose-500/60 bg-rose-50 dark:bg-rose-500/15 shadow-glow-rose space-y-2 animate-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono font-black text-rose-900 dark:text-rose-200 text-sm uppercase tracking-wide">
              <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 animate-bounce" />
              <span>CRITICAL OBSERVABILITY WARNING: PHYSICS VS. ML PREDICTION DISAGREEMENT</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-500/30 text-rose-900 dark:text-rose-100 border border-rose-400">
              DISAGREEMENT DETECTED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-3 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-rose-300 dark:border-rose-500/30">
              <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                Primary Ground Truth (Physics)
              </div>
              <div className="text-sm font-black font-mono text-slate-900 dark:text-white mt-0.5">
                {physicsState.replace(/_/g, ' ')}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 font-sans">
                {physicsReason}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-rose-300 dark:border-rose-500/30">
              <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                Secondary Prediction (Experimental ML)
              </div>
              <div className="text-sm font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                {mlState.replace(/_/g, ' ')} ({(mlConfidence * 100).toFixed(1)}% Conf)
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 font-sans">
                Surface sensor telemetry alone cannot observe microscopic sand sintering or internal particle cluster growth (d_p,eff),
                leading the telemetry-only classifier to disagree with internal hydrodynamics.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Diagnostic Split: Primary Physics vs Secondary ML */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PRIMARY RESULT: First-Principles Physics State (Col 7) */}
        <div className="lg:col-span-7 glass-card p-6 space-y-5 border border-slate-200 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-cyan-500/20 text-blue-700 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                  PRIMARY GROUND-TRUTH RESULT
                </span>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                  First-Principles Physics Fluidization State
                </h2>
              </div>
            </div>

            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10">
              RISK: {physicsRisk}
            </span>
          </div>

          {/* Primary State Banner */}
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${getPhysicsBadgeColor(physicsState)}`}>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider font-mono opacity-80">
                Governing State Classification
              </div>
              <div className="text-xl font-black font-mono tracking-tight mt-0.5">
                {physicsState.replace(/_/g, ' ')}
              </div>
            </div>

            <div className="text-right font-mono">
              <div className="text-[10px] opacity-80 font-bold uppercase">Physics Criterion</div>
              <div className="text-sm font-black">
                U₀ / U_mf,eff = {result?.fluidization?.u0_over_umf_eff?.toFixed(3) ?? '—'}
              </div>
            </div>
          </div>

          {/* Physics Rationale */}
          <div className="space-y-1 text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono uppercase tracking-wider text-[10px]">
              Physical Rationale &amp; Hydrodynamic Margins:
            </span>
            <p className="p-3 rounded-lg bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium text-[11px]">
              {physicsReason}
            </p>
          </div>

          {/* Supporting Physics Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            <div className="metric-card p-2.5">
              <div className="metric-label text-[9px]">U₀ Superficial</div>
              <div className="metric-value text-sm font-mono mt-0.5">
                {result?.fluidization?.u0_m_s?.toFixed(4) ?? '0.5674'} <span className="metric-unit">m/s</span>
              </div>
            </div>

            <div className="metric-card p-2.5">
              <div className="metric-label text-[9px]">U_mf Effective</div>
              <div className="metric-value text-sm font-mono mt-0.5 text-blue-600 dark:text-cyan-400">
                {result?.fluidization?.umf_effective_m_s?.toFixed(4) ?? '0.0564'} <span className="metric-unit">m/s</span>
              </div>
            </div>

            <div className="metric-card p-2.5">
              <div className="metric-label text-[9px]">U₀ / U_t Ratio</div>
              <div className="metric-value text-sm font-mono mt-0.5">
                {result?.fluidization?.u0_over_ut?.toFixed(4) ?? '0.2020'}
              </div>
            </div>

            <div className="metric-card p-2.5">
              <div className="metric-label text-[9px]">ΔP_bed Drop</div>
              <div className="metric-value text-sm font-mono mt-0.5 text-emerald-600 dark:text-emerald-400">
                {result?.fluidization?.dp_bed_kpa?.toFixed(3) ?? '7.146'} <span className="metric-unit">kPa</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECONDARY RESULT: ML Telemetry Model (Col 5) */}
        <div className="lg:col-span-5 glass-card p-6 space-y-5 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    SECONDARY // EXPERIMENTAL
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                    EXPERIMENTAL
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                  Machine Learning Telemetry Model
                </h3>
              </div>

              <span className={`badge ${mlLoaded ? 'badge-info' : 'badge-warning'}`}>
                {mlLoaded ? 'RF-100 Active' : 'Fallback'}
              </span>
            </div>

            {/* ML Prediction Pill */}
            <div className="p-4 rounded-xl bg-slate-100/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-500">
                  Predicted Class
                </div>
                <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                  {mlState.replace(/_/g, ' ')}
                </div>
              </div>

              <div className="text-right font-mono">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Confidence</div>
                <div className="text-xl font-black text-blue-600 dark:text-cyan-400">
                  {(mlConfidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Posterior Probabilities */}
            {result?.anomaly?.probabilities && (
              <div className="space-y-2 text-xs">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  Class Posterior Probability Distribution:
                </div>
                <div className="space-y-1.5">
                  {Object.entries(result.anomaly.probabilities).map(([stKey, prob]) => {
                    const pct = Math.round(Number(prob) * 100)
                    const isMatch = stKey === mlState
                    return (
                      <div key={stKey} className="space-y-0.5">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className={isMatch ? 'text-blue-600 dark:text-cyan-400 font-bold' : 'text-slate-600 dark:text-slate-400'}>
                            {stKey.replace(/_/g, ' ')}
                          </span>
                          <span className="font-bold">{pct}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isMatch ? 'bg-blue-600 dark:bg-cyan-400' : 'bg-slate-400/40'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Phase 3b Notice & Telemetry Accuracy Callout */}
          <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300 text-[10px] uppercase font-mono">
              <Info size={13} />
              Phase 3b Roadblock &amp; Future Scope
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium">
              Phase 3b will revise the ML inputs with synthetic sensor embeddings and multi-sensor fusion.
              Keep this interface minimal and driven strictly by API fields.
            </p>
          </div>
        </div>
      </div>

      {/* Prominent Observability & Accuracy Callout: 45.9% Production Telemetry Accuracy */}
      <div className="glass-card p-5 border border-slate-200 dark:border-white/10 space-y-3 bg-slate-50/70 dark:bg-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-blue-600 dark:text-cyan-400" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-900 dark:text-white">
              Production Telemetry Model Accuracy: 45.94% (METHODOLOGY.md §10.4)
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-cyan-500/20 text-blue-800 dark:text-cyan-300 border border-blue-300 dark:border-cyan-400/30">
            Leakage vs. Observability Audit
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans text-slate-700 dark:text-slate-300 leading-relaxed">
          <div className="space-y-1">
            <strong className="text-slate-900 dark:text-white font-mono text-[11px]">
              1. Leakage Check Finding:
            </strong>
            <p className="text-[11px] font-medium">
              In initial tests, the ML model appeared to achieve 98.44% accuracy only because the input feature set included
              the exact dimensionless physics ratio (<code className="font-mono text-blue-600 dark:text-cyan-400">U₀/U_mf,eff</code>) used to define the label.
              The decision trees simply reconstructed the threshold split <code className="font-mono text-blue-600 dark:text-cyan-400">U₀/U_mf,eff &lt; 1.0</code> with 63.15% feature importance.
            </p>
          </div>

          <div className="space-y-1">
            <strong className="text-slate-900 dark:text-white font-mono text-[11px]">
              2. Production Model B Accuracy (45.94%):
            </strong>
            <p className="text-[11px] font-medium">
              When evaluated on unseen operating groups using observable plant telemetry alone (surface sensors: T_bed, V_air, ΔP, w_plastic),
              accuracy drops by <strong>52.50% down to 45.94%</strong>.
              This drop occurs because microscopic sand sintering and cluster agglomeration diameter (<code className="font-mono text-blue-600 dark:text-cyan-400">d_p,eff</code>)
              are <strong>latent internal bed physical states</strong> that cannot be uniquely reconstructed from macroscopic surface sensors alone without in-bed measurement.
            </p>
          </div>
        </div>
      </div>

      {/* Telemetry Sensor Controls for Interactive Custom Evaluation */}
      <div className="glass-card p-5 space-y-4 border border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Gauge size={15} className="text-blue-600 dark:text-cyan-400" />
            Sensor Telemetry Controls (Evaluate Custom Plant Conditions)
          </h3>
          <span className="text-[10px] font-mono text-slate-500">API Driven</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <Flame size={12} className="text-rose-500" /> Bed Temp:
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{bedTemp.toFixed(1)} °C</span>
            </div>
            <input
              type="range"
              min="500"
              max="1100"
              step="5"
              value={bedTemp}
              onChange={(e) => setBedTemp(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <Wind size={12} className="text-blue-500" /> Primary Airflow:
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{airflow.toFixed(1)} Nm³/h</span>
            </div>
            <input
              type="range"
              min="100"
              max="1200"
              step="10"
              value={airflow}
              onChange={(e) => setAirflow(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <Gauge size={12} className="text-amber-500" /> Bed ΔP:
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{pressureDrop.toFixed(2)} kPa</span>
            </div>
            <input
              type="range"
              min="3"
              max="25"
              step="0.2"
              value={pressureDrop}
              onChange={(e) => setPressureDrop(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <Zap size={12} className="text-indigo-500" /> Plastic Fraction:
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{plasticRatio.toFixed(1)} %</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={plasticRatio}
              onChange={(e) => setPlasticRatio(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={evaluateCustom}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            {loading ? 'Evaluating...' : 'Evaluate Custom Telemetry'}
          </button>
        </div>
      </div>
    </div>
  )
}
