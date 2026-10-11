import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { AnomalyResult } from '../types'
import {
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Sliders,
  HelpCircle,
  Zap,
  Activity,
  ArrowRight,
  ShieldAlert,
  Flame,
  Wind,
  Gauge,
} from 'lucide-react'

interface PresetConfig {
  name: string
  desc: string
  bed_temperature: number
  airflow: number
  pressure_drop: number
  plastic_ratio: number
  expected: string
}

const PRESETS: PresetConfig[] = [
  {
    name: 'Normal Fluidization',
    desc: 'Balanced feed and steady fluidized bed conditions',
    bed_temperature: 850,
    airflow: 120,
    pressure_drop: 15.2,
    plastic_ratio: 20,
    expected: 'NORMAL_FLUIDIZATION',
  },
  {
    name: 'Early Agglomeration',
    desc: 'Rising plastic fraction and localized sintering risk',
    bed_temperature: 810,
    airflow: 110,
    pressure_drop: 19.5,
    plastic_ratio: 38,
    expected: 'EARLY_AGGLOMERATION',
  },
  {
    name: 'Severe Clumping & Defluidization',
    desc: 'Heavy polymer buildup causing pressure drop spike and defluidization',
    bed_temperature: 740,
    airflow: 85,
    pressure_drop: 27.0,
    plastic_ratio: 55,
    expected: 'SEVERE_CLUMPING',
  },
  {
    name: 'Air Starvation & Tar Risk',
    desc: 'Low secondary air and insufficient bed temperature',
    bed_temperature: 690,
    airflow: 70,
    pressure_drop: 17.5,
    plastic_ratio: 22,
    expected: 'EARLY_AGGLOMERATION',
  },
  {
    name: 'High Temperature Sintering',
    desc: 'Excessive bed temperature with high plastic content',
    bed_temperature: 990,
    airflow: 140,
    pressure_drop: 23.0,
    plastic_ratio: 45,
    expected: 'EARLY_AGGLOMERATION',
  },
]

export default function AnomalyPage() {
  const [bedTemp, setBedTemp] = useState<number>(850)
  const [airflow, setAirflow] = useState<number>(120)
  const [pressureDrop, setPressureDrop] = useState<number>(15.2)
  const [plasticRatio, setPlasticRatio] = useState<number>(20)

  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<AnomalyResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runPrediction = async (
    t = bedTemp,
    af = airflow,
    pd = pressureDrop,
    pr = plasticRatio
  ) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/anomaly/predict', {
        bed_temperature: t,
        airflow: af,
        pressure_drop: pd,
        plastic_ratio: pr,
      })
      setResult(res)
    } catch (e: any) {
      setError(e.message || 'Failed to evaluate anomaly telemetry')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runPrediction()
  }, [])

  const applyPreset = (p: PresetConfig) => {
    setBedTemp(p.bed_temperature)
    setAirflow(p.airflow)
    setPressureDrop(p.pressure_drop)
    setPlasticRatio(p.plastic_ratio)
    runPrediction(p.bed_temperature, p.airflow, p.pressure_drop, p.plastic_ratio)
  }

  const getRiskBadge = (risk: string = '') => {
    const r = risk.toUpperCase()
    if (r === 'LOW') return <span className="badge badge-success font-mono font-bold">Low Risk</span>
    if (r === 'MEDIUM' || r === 'MODERATE') return <span className="badge badge-warning font-mono font-bold">Medium Risk</span>
    if (r === 'HIGH' || r === 'CRITICAL') return <span className="badge badge-danger font-mono font-bold">Critical Risk</span>
    return <span className="badge badge-info font-mono font-bold">{risk || 'Normal'}</span>
  }

  const isNormal = result?.state === 'NORMAL_FLUIDIZATION'
  const isSevere = result?.state === 'SEVERE_CLUMPING'

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <ShieldAlert className="text-rose-500" size={24} />
            <span>AI Gasifier Anomaly Diagnostics & Safety Guard</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-normal">
            Random Forest classifier monitoring fluidized bed fluidization stability, bed clinkering, and agglomeration risk
          </p>
        </div>

        <button
          onClick={() => runPrediction()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Evaluating...' : 'Run Diagnostics'}
        </button>
      </div>

      {/* Preset scenarios bar */}
      <div className="glass-card p-4 space-y-2 border border-slate-200 dark:border-white/10">
        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
          <Sliders size={14} className="text-blue-600 dark:text-cyan-400" />
          Rapid Fault Injection Presets
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className="text-left p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-blue-400 dark:hover:border-cyan-400/50 hover:bg-blue-50/50 dark:hover:bg-cyan-500/5 transition-all group relative overflow-hidden cursor-pointer"
            >
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-cyan-400 flex items-center justify-between">
                <span>{p.name}</span>
                <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-tight">
                {p.desc}
              </p>
              <div className="mt-2 text-[10px] font-mono text-blue-600 dark:text-cyan-400 font-bold">
                {p.bed_temperature}°C | {p.airflow}m³ | {p.pressure_drop}kPa
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Controls + Diagnostic Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-5 glass-card p-5 space-y-5 border border-slate-200 dark:border-white/10">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
            <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
              <Gauge size={15} className="text-blue-600 dark:text-cyan-400" />
              Sensor Telemetry Controls
            </h2>
            <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">4 CHANNELS</span>
          </div>

          {/* Bed Temperature Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Flame size={13} className="text-rose-500" /> Bed Temperature:
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{bedTemp.toFixed(1)} °C</span>
            </div>
            <input
              type="range"
              min="500"
              max="1200"
              step="5"
              value={bedTemp}
              onChange={(e) => setBedTemp(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold">
              <span>500°C (Cold)</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">850°C (Optimal)</span>
              <span>1200°C (Sintering)</span>
            </div>
          </div>

          {/* Primary Airflow */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Wind size={13} className="text-blue-600 dark:text-cyan-400" /> Primary Airflow:
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{airflow.toFixed(1)} m³/h</span>
            </div>
            <input
              type="range"
              min="40"
              max="240"
              step="2"
              value={airflow}
              onChange={(e) => setAirflow(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold">
              <span>40 m³/h (Starved)</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">120 m³/h (Stoichiometric)</span>
              <span>240 m³/h (Excess)</span>
            </div>
          </div>

          {/* Bed Pressure Drop */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Gauge size={13} className="text-amber-500" /> Bed Differential Pressure (ΔP):
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{pressureDrop.toFixed(1)} kPa</span>
            </div>
            <input
              type="range"
              min="4"
              max="40"
              step="0.5"
              value={pressureDrop}
              onChange={(e) => setPressureDrop(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold">
              <span>&lt; 8 kPa (Channeling)</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">15.2 kPa (Stable)</span>
              <span>&gt; 25 kPa (Clumping)</span>
            </div>
          </div>

          {/* Plastic Ratio */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Zap size={13} className="text-indigo-500" /> Plastic Feed Proportion:
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{plasticRatio.toFixed(1)} %</span>
            </div>
            <input
              type="range"
              min="0"
              max="70"
              step="1"
              value={plasticRatio}
              onChange={(e) => setPlasticRatio(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold">
              <span>0% (Biomass only)</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">20% (Typical)</span>
              <span>&gt; 45% (High Hazard)</span>
            </div>
          </div>

          <button
            onClick={() => runPrediction()}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            Compute Diagnostic State
          </button>
        </div>

        {/* Diagnostic Output Column */}
        <div className="lg:col-span-7 space-y-4">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/30 rounded-lg text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertOctagon size={16} />
              {error}
            </div>
          )}

          {result ? (
            <div className="glass-card p-6 space-y-5 border border-slate-200 dark:border-white/10">
              {/* Classification Hero Banner */}
              <div
                className={`p-5 rounded-xl border backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isNormal
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
                    : isSevere
                    ? 'bg-rose-50 dark:bg-rose-500/20 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-300 shadow-glow-rose'
                    : 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-300'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isNormal
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : isSevere
                        ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 animate-pulse'
                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {isNormal ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider opacity-80 font-mono">
                      Operating Diagnostic
                    </div>
                    <div className="text-xl font-black tracking-tight font-mono">
                      {result.state.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                <div className="text-right sm:border-l sm:border-current/20 sm:pl-4">
                  <div className="text-[10px] uppercase font-bold tracking-wider opacity-80 font-mono">
                    Model Confidence
                  </div>
                  <div className="text-2xl font-mono font-black">
                    {(result.confidence * 100).toFixed(1)}%
                  </div>
                  <div className="mt-1">{getRiskBadge(result.risk_level)}</div>
                </div>
              </div>

              {/* Actionable Engineering Recommendation */}
              <div className="glass-card-subtle p-4 border border-slate-200 dark:border-white/10 space-y-1">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Activity size={14} className="text-blue-600 dark:text-cyan-400" />
                  Corrective Mitigation Directive
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans font-medium">
                  {result.recommendation || 'Bed temperature and fluidization index within nominal tolerances. Maintain automated air trim.'}
                </p>
              </div>

              {/* Posterior Probabilities Bars */}
              {result.probabilities && Object.keys(result.probabilities).length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono">
                    Random Forest Class Probability Distribution
                  </div>
                  <div className="space-y-2">
                    {Object.entries(result.probabilities).map(([stateKey, prob]) => {
                      const pct = Math.round((prob as number) * 100)
                      const isMatch = stateKey === result.state
                      return (
                        <div key={stateKey} className="space-y-1">
                          <div className="flex justify-between text-xs font-mono">
                            <span className={isMatch ? 'text-blue-600 dark:text-cyan-400 font-bold' : 'text-slate-600 dark:text-slate-400 font-semibold'}>
                              {stateKey.replace(/_/g, ' ')}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isMatch ? 'bg-gradient-to-r from-blue-600 to-cyan-400 shadow-glow-cyan' : 'bg-slate-400/40'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Normalized Feature Indicators */}
              {result.features && (
                <div className="pt-3 border-t border-slate-200 dark:border-white/10">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono mb-2">
                    Normalized Telemetry Gradient
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="metric-card py-2 px-3">
                      <div className="metric-label text-[9px]">Temp Gradient</div>
                      <div className="metric-value text-sm text-rose-600 dark:text-rose-400">
                        {Number(result.features.temperature_gradient ?? 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="metric-card py-2 px-3">
                      <div className="metric-label text-[9px]">Airflow Dev</div>
                      <div className="metric-value text-sm text-blue-600 dark:text-cyan-400">
                        {Number(result.features.airflow_deviation ?? 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="metric-card py-2 px-3">
                      <div className="metric-label text-[9px]">ΔP Deviation</div>
                      <div className="metric-value text-sm text-amber-600 dark:text-amber-400">
                        {Number(result.features.pressure_deviation ?? 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card p-12 text-center text-slate-500 text-xs">
              <HelpCircle size={32} className="mx-auto mb-2 text-slate-400" />
              Adjust telemetry values or choose a preset to evaluate anomaly conditions.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
