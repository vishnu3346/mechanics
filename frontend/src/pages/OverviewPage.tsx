import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import type { HealthResponse, SystemInfoResponse } from '../types'
import {
  ArrowRight,
  Activity,
  Flame,
  Wind,
  Droplets,
  Zap,
  Thermometer,
  ShieldCheck,
  Eye,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play
} from 'lucide-react'

const PIPELINE_PHASES = [
  {
    phase: 'Phase 01: Intake & AI Vision',
    color: 'border-blue-500/40 text-blue-700 dark:text-cyan-400',
    steps: [
      { id: '01', title: 'Medical Waste Input', desc: 'Infectious, plastics, sharps & pathological streams', icon: '🏥', link: '/vision' },
      { id: '02', title: 'AI Vision Inspection', desc: 'YOLO spatial object detection & sorting', icon: '📷', link: '/vision' },
      { id: '03', title: 'Feedstock Preparation', desc: 'Automated shredding & moisture equilibration', icon: '⚙️', link: '/scenarios' },
    ],
  },
  {
    phase: 'Phase 02: Fluidized Bed Gasification',
    color: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
    steps: [
      { id: '04', title: 'Sub-Stoichiometric Bed', desc: 'Thermochemical fluidized bed conversion at 850°C', icon: '🔥', link: '/simulation' },
      { id: '05', title: 'Syngas Generation', desc: 'Combustible gas yield (CO, H₂, CH₄) with high LHV', icon: '💨', link: '/simulation' },
      { id: '06', title: 'ML Anomaly Guard', desc: 'Real-time clinkering & fluidization monitoring', icon: '🧠', link: '/anomaly' },
    ],
  },
  {
    phase: 'Phase 03: Steam Generation & Power',
    color: 'border-cyan-600/40 text-cyan-700 dark:text-cyan-400',
    steps: [
      { id: '07', title: 'HRSG Boiler Drum', desc: 'Superheated steam generation at 16 bar & 320°C', icon: '♨️', link: '/simulation' },
      { id: '08', title: 'Rankine Steam Turbine', desc: 'High-efficiency multi-stage steam expansion', icon: '⚡', link: '/simulation' },
      { id: '09', title: 'Electrical Generation', desc: 'Synchronous generator exporting net electrical power', icon: '🔌', link: '/energy' },
    ],
  },
  {
    phase: 'Phase 04: Cogeneration & Heat Recovery',
    color: 'border-emerald-600/40 text-emerald-700 dark:text-emerald-400',
    steps: [
      { id: '10', title: 'Condenser Heat Exchanger', desc: 'Secondary thermal capture from turbine exhaust', icon: '🔄', link: '/energy' },
      { id: '11', title: 'Hospital Utility Heat', desc: '85°C water for sterilization & autoclaves', icon: '🌡️', link: '/energy' },
      { id: '12', title: 'Combined CHP Recovery', desc: 'Overall cogeneration efficiency exceeding 65%', icon: '🌿', link: '/energy' },
    ],
  },
]

export default function OverviewPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [systemStats, setSystemStats] = useState<SystemInfoResponse | null>(null)

  useEffect(() => {
    api.get('/health').then(setHealth).catch(() => {})
    api.get('/system').then(setSystemStats).catch(() => {})
  }, [])

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Hero Header */}
      <div className="glass-card p-6 lg:p-8 border border-slate-200 dark:border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-cyan-500/10 border border-blue-200 dark:border-cyan-400/20 text-blue-700 dark:text-cyan-300 text-xs font-semibold">
              <Sparkles size={14} className="text-blue-600 dark:text-cyan-400" />
              AI Vision Sorting + Fluidized Bed Cogeneration Twin
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              AI-Driven <span className="text-blue-600 dark:text-cyan-400">Medical Waste-to-Energy</span> System
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              Closed-loop clinical waste gasification coupled with a Rankine cycle turbogenerator,
              real-time computer vision sorting, and machine learning telemetry diagnostics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/simulation"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
            >
              <Play size={13} fill="currentColor" />
              Launch 3D Simulation
            </Link>
            <Link
              to="/anomaly"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg glass-card hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold text-slate-800 dark:text-slate-200 transition border border-slate-200 dark:border-white/15"
            >
              <Activity size={14} className="text-blue-600 dark:text-cyan-400" />
              Fault Diagnostics
            </Link>
          </div>
        </div>
      </div>

      {/* System Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-label">FastAPI Engine</span>
            <div className={`w-2.5 h-2.5 rounded-full ${health ? 'bg-emerald-500 shadow-xs' : 'bg-slate-400'}`} />
          </div>
          <div className="metric-value flex items-baseline gap-2">
            <span>{health ? 'Online' : 'Connecting...'}</span>
            <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 font-mono">100% SLA</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-medium">Uvicorn WebSocket Daemon</p>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-label">Anomaly Model</span>
            <ShieldCheck size={16} className="text-blue-600 dark:text-cyan-400" />
          </div>
          <div className="metric-value text-blue-600 dark:text-cyan-400">
            {health?.anomaly_model_loaded ? 'Active (RF-100)' : 'Fallback Rules'}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-medium">
            {health?.anomaly_model_loaded ? 'Random Forest Loaded' : 'Heuristic Engine'}
          </p>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-label">System Platform</span>
            <Cpu size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="metric-value text-indigo-600 dark:text-indigo-400">
            {systemStats?.cuda_available ? 'GPU Accelerated' : 'CPU Mode'}
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-mono">
            Python {systemStats?.python_version || '3.13'}
          </p>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-label">Operating Scenarios</span>
            <Layers size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="metric-value text-emerald-600 dark:text-emerald-400">8 Benchmarks</div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-medium">Normal, Surge, Wet, Hazard</p>
        </div>
      </div>

      {/* 4-Phase Pipeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Flame size={18} className="text-amber-500" />
              Waste-to-Energy Unit Operations
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Interactive 4-phase transformation from raw clinical streams to clean electricity and thermal energy
            </p>
          </div>
          <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300">
            12 Unit Operations
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PIPELINE_PHASES.map((phaseGroup, idx) => (
            <div
              key={idx}
              className="glass-card p-4 space-y-3 border border-slate-200 dark:border-white/10"
            >
              <div className={`text-[11px] font-mono font-bold uppercase tracking-wider pb-2 border-b border-slate-200 dark:border-white/10 ${phaseGroup.color}`}>
                {phaseGroup.phase}
              </div>

              <div className="space-y-2">
                {phaseGroup.steps.map((st) => (
                  <Link
                    key={st.id}
                    to={st.link}
                    className="block p-3 rounded-lg bg-slate-100/70 dark:bg-white/5 hover:bg-blue-50/80 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/5 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{st.icon}</span>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                          {st.title}
                        </span>
                      </div>
                      <ArrowRight size={13} className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors" />
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-tight">
                      {st.desc}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safety Notice */}
      <div className="glass-card p-4 border border-amber-300/80 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 flex items-start gap-3">
        <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="text-xs font-bold text-amber-900 dark:text-amber-400">
            Engineering Simulation & Digital Twin Notice
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            This platform models chemical kinetics, mass/energy conservation, and gasifier hydrodynamics for research
            and educational evaluation. Physical commissioning of clinical waste gasification requires certified CEMS flue
            gas analysis, refractory temperature monitoring, and redundant hardwired SIL safety interlocks.
          </p>
        </div>
      </div>
    </div>
  )
}
