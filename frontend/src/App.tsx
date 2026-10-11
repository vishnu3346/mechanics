import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import {
  Activity,
  Eye,
  Cpu,
  AlertTriangle,
  Zap,
  List,
  Clock,
  Settings,
  Sun,
  Moon,
  Flame,
  Radio
} from 'lucide-react'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import OverviewPage from './pages/OverviewPage'
import VisionPage from './pages/VisionPage'
import SimulationPage from './pages/SimulationPage'
import AnomalyPage from './pages/AnomalyPage'
import EnergyPage from './pages/EnergyPage'
import ScenariosPage from './pages/ScenariosPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'

const NAV_ITEMS = [
  { path: '/overview', label: 'Overview', icon: Activity, tag: 'Live' },
  { path: '/vision', label: 'AI Vision Sorting', icon: Eye, tag: 'YOLO' },
  { path: '/simulation', label: 'Plant Simulation', icon: Cpu, tag: '3D' },
  { path: '/anomaly', label: 'Fault Diagnostics', icon: AlertTriangle, tag: 'ML' },
  { path: '/energy', label: 'Energy Cascade', icon: Zap, tag: 'CHP' },
  { path: '/scenarios', label: 'Stress Scenarios', icon: List },
  { path: '/history', label: 'Run Telemetry', icon: Clock },
  { path: '/settings', label: 'System Config', icon: Settings },
]

function AppLayout() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-150">
      {/* Sidebar */}
      <nav className="w-64 glass-panel shrink-0 flex flex-col z-20 border-r border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0d121f]/95 shadow-sm">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-sm shrink-0">
              <Flame size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white font-mono">
                  MEDWASTE
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-cyan-500/20 text-blue-700 dark:text-cyan-400 border border-blue-300 dark:border-cyan-400/30">
                  WtE
                </span>
              </div>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                Gasification & CHP Twin
              </p>
            </div>
          </div>

          {/* Quick status pill */}
          <div className="mt-3 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100/90 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                SYSTEM ONLINE
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold">v1.0.0</span>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Operations & Analytics
          </div>
          {NAV_ITEMS.map(({ path, label, icon: Icon, tag }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-cyan-500/15 text-blue-700 dark:text-cyan-300 border border-blue-200 dark:border-cyan-400/30 shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5">
                    <Icon
                      size={16}
                      className={isActive ? 'text-blue-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400'}
                    />
                    <span>{label}</span>
                  </div>
                  {tag && (
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        isActive
                          ? 'bg-blue-100 dark:bg-cyan-500/25 text-blue-700 dark:text-cyan-300 border-blue-300 dark:border-cyan-400/40'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10'
                      }`}
                    >
                      {tag}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Theme Mode Toggle Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-white/10 space-y-2">
          <button
            onClick={toggleTheme}
            id="theme-toggle-btn"
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200/80 dark:hover:bg-white/10 transition-colors text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-xs cursor-pointer"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Moon size={15} className="text-cyan-400" />
              ) : (
                <Sun size={15} className="text-amber-500" />
              )}
              <span>{theme === 'dark' ? 'Dark Aesthetics' : 'Light Aesthetics'}</span>
            </div>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                theme === 'dark'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}
            >
              {theme}
            </span>
          </button>

          <div className="px-2 pt-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
            <Radio size={11} className="text-emerald-500 shrink-0" />
            <span>Fluidized Bed Twin Online</span>
          </div>
        </div>
      </nav>

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#090d16]">
        <Routes>
          <Route path="/" element={<Navigate to="/overview" />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/vision" element={<VisionPage />} />
          <Route path="/simulation" element={<SimulationPage />} />
          <Route path="/anomaly" element={<AnomalyPage />} />
          <Route path="/energy" element={<EnergyPage />} />
          <Route path="/scenarios" element={<ScenariosPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ThemeProvider>
  )
}
