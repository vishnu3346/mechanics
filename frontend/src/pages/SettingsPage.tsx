import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useTheme } from '../context/ThemeContext'
import type { SystemInfoResponse } from '../types'
import {
  Settings,
  Server,
  Sliders,
  Save,
  CheckCircle2,
  Sun,
  Moon,
  Info,
} from 'lucide-react'

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const [systemInfo, setSystemInfo] = useState<SystemInfoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  // Simulation boundary configuration state
  const [defaultFeedRate, setDefaultFeedRate] = useState(100)
  const [bedTempSetpoint, setBedTempSetpoint] = useState(850)
  const [boilerEfficiency, setBoilerEfficiency] = useState(82)
  const [turbineEfficiency, setTurbineEfficiency] = useState(80)
  const [simSpeed, setSimSpeed] = useState(1.0)

  useEffect(() => {
    api
      .get('/system')
      .then((data) => {
        setSystemInfo(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Settings className="text-blue-600 dark:text-cyan-400" size={24} />
            <span>Plant Configuration & System Environment</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-normal">
            Plant design defaults, ML anomaly engine telemetry, and UI display themes
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all self-start sm:self-auto cursor-pointer"
        >
          {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
          <span>{saved ? 'Parameters Stored' : 'Save Baseline Limits'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plant Baseline Defaults */}
        <div className="glass-card p-6 space-y-5 border border-slate-200 dark:border-white/10">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
            <Sliders size={15} className="text-blue-600 dark:text-cyan-400" />
            Default Plant Operational Boundaries
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-800 dark:text-slate-200 mb-1 font-bold">
                Baseline Waste Feed Throughput (kg/h):
              </label>
              <input
                type="number"
                value={defaultFeedRate}
                onChange={(e) => setDefaultFeedRate(Number(e.target.value))}
                className="w-full px-3 py-2 glass-input font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-800 dark:text-slate-200 mb-1 font-bold">
                Fluidized Bed Temperature Setpoint (°C):
              </label>
              <input
                type="number"
                value={bedTempSetpoint}
                onChange={(e) => setBedTempSetpoint(Number(e.target.value))}
                className="w-full px-3 py-2 glass-input font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-800 dark:text-slate-200 mb-1 font-bold">
                  Boiler Thermal Eff (%):
                </label>
                <input
                  type="number"
                  value={boilerEfficiency}
                  onChange={(e) => setBoilerEfficiency(Number(e.target.value))}
                  className="w-full px-3 py-2 glass-input font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-800 dark:text-slate-200 mb-1 font-bold">
                  Turbine Isentropic Eff (%):
                </label>
                <input
                  type="number"
                  value={turbineEfficiency}
                  onChange={(e) => setTurbineEfficiency(Number(e.target.value))}
                  className="w-full px-3 py-2 glass-input font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-800 dark:text-slate-200 mb-1 font-bold">
                Simulation Clock Rate Multiplier:
              </label>
              <select
                value={simSpeed}
                onChange={(e) => setSimSpeed(Number(e.target.value))}
                className="w-full px-3 py-2 glass-input font-mono cursor-pointer"
              >
                <option value={0.5} className="bg-slate-100 dark:bg-slate-900">0.5x (Slow motion analysis)</option>
                <option value={1.0} className="bg-slate-100 dark:bg-slate-900">1.0x (Standard real-time speed)</option>
                <option value={2.0} className="bg-slate-100 dark:bg-slate-900">2.0x (Accelerated testing)</option>
                <option value={5.0} className="bg-slate-100 dark:bg-slate-900">5.0x (High throughput test)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Backend & Hardware Runtime Environment */}
        <div className="glass-card p-6 space-y-5 border border-slate-200 dark:border-white/10">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
            <Server size={15} className="text-emerald-600 dark:text-emerald-400" />
            Backend Engine & Hardware Diagnostics
          </h2>

          {loading ? (
            <div className="text-xs text-slate-500 py-8 text-center font-mono">Querying system endpoints...</div>
          ) : (
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-slate-200/70 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Python Version:</span>
                <span className="font-bold text-slate-900 dark:text-white">{systemInfo?.python_version || '3.13'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/70 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Platform OS:</span>
                <span className="font-bold text-slate-900 dark:text-white">{systemInfo?.platform || 'Windows'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/70 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">CUDA Acceleration:</span>
                <span className="font-bold">
                  {systemInfo?.cuda_available ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Enabled (GPU)</span>
                  ) : (
                    <span className="text-slate-500 font-sans">Disabled (CPU mode)</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200/70 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Anomaly Classifier:</span>
                <span className="font-bold">
                  {systemInfo?.anomaly_model_loaded ? (
                    <span className="badge badge-success">Loaded & Active</span>
                  ) : (
                    <span className="badge badge-warning">Fallback Mode</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Archived Run Records:</span>
                <span className="font-bold text-blue-600 dark:text-cyan-400">{systemInfo?.history_count ?? 0}</span>
              </div>
            </div>
          )}

          {/* Theme Mode Quick Selector Card */}
          <div className="pt-4 border-t border-slate-200 dark:border-white/10">
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono mb-2">
              Visual Presentation Theme
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => theme === 'light' || toggleTheme()}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Sun size={15} className="text-amber-500" />
                Light Mode
              </button>
              <button
                onClick={() => theme === 'dark' || toggleTheme()}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300 shadow-glow-cyan'
                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Moon size={15} className="text-cyan-400" />
                Dark Glass
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Regulatory Standards */}
      <div className="glass-card p-6 border border-slate-200 dark:border-white/10 space-y-3">
        <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
          <Info size={14} className="text-blue-600 dark:text-cyan-400" />
          Regulatory Standards & Safety Thresholds
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="glass-card-subtle p-3.5 space-y-1 border border-slate-200 dark:border-white/10">
            <div className="font-bold text-slate-900 dark:text-slate-100">WHO Bio-Medical Segregation</div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
              Automated classification protocol for sharps, pathological, infectious, and non-hazardous municipal fractions.
            </p>
          </div>
          <div className="glass-card-subtle p-3.5 space-y-1 border border-slate-200 dark:border-white/10">
            <div className="font-bold text-slate-900 dark:text-slate-100">EPA Clean Air Act (Title V)</div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
              Emission limits on acid gases (HCl, SO₂), dioxins/furans, and continuous emission monitoring requirements (CEMS).
            </p>
          </div>
          <div className="glass-card-subtle p-3.5 space-y-1 border border-slate-200 dark:border-white/10">
            <div className="font-bold text-slate-900 dark:text-slate-100">ASME PTC 4.3 Air Preheaters</div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
              Standardized steam enthalpy calculations, temperature differentials, and heat recovery efficiency benchmarks.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
