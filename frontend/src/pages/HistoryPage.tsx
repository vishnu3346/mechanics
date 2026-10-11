import { useState, useEffect } from 'react'
import { api } from '../services/api'
import type { HistoryEntry } from '../types'
import {
  Clock,
  Search,
  Filter,
  FileSpreadsheet,
  FileJson,
  Eye,
  RefreshCw,
  X
} from 'lucide-react'

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filterState, setFilterState] = useState<string>('ALL')
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null)

  const loadHistory = async () => {
    setLoading(true)
    try {
      const res = await api.get('/history')
      setHistory(res.history || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.scenario_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return false

    if (filterState === 'NORMAL') {
      return (
        item.anomaly_state === 'NORMAL' ||
        item.anomaly_state === 'NORMAL_FLUIDIZATION'
      )
    }
    if (filterState === 'ANOMALY') {
      return (
        item.anomaly_state !== 'NORMAL' &&
        item.anomaly_state !== 'NORMAL_FLUIDIZATION'
      )
    }
    return true
  })

  const exportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(history, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute(
      'download',
      `simulation_history_${new Date().toISOString().slice(0, 10)}.json`
    )
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const exportCSV = () => {
    if (history.length === 0) return
    const headers = [
      'id',
      'timestamp',
      'scenario_name',
      'anomaly_state',
      'electrical_kw',
      'heat_kw',
      'efficiency_pct',
    ]
    const rows = history.map((item) => [
      item.id,
      item.timestamp,
      `"${item.scenario_name}"`,
      item.anomaly_state,
      item.overall?.electrical_output_kw ?? 0,
      item.overall?.heat_recovery_kw ?? 0,
      item.overall?.overall_efficiency_pct ?? 0,
    ])
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `simulation_history_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Clock className="text-blue-600 dark:text-cyan-400" size={24} />
            <span>Simulation Run History & Telemetry Archive</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-normal">
            Archived logs of plant runs, mass/energy balance performance, and anomaly detection results
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={exportCSV}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 glass-card hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg shadow-xs transition disabled:opacity-50 border border-slate-200 dark:border-white/10 cursor-pointer"
          >
            <FileSpreadsheet size={13} className="text-emerald-600 dark:text-emerald-400" />
            Export CSV
          </button>
          <button
            onClick={exportJSON}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 glass-card hover:bg-slate-100 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg shadow-xs transition disabled:opacity-50 border border-slate-200 dark:border-white/10 cursor-pointer"
          >
            <FileJson size={13} className="text-blue-600 dark:text-cyan-400" />
            Export JSON
          </button>
          <button
            onClick={loadHistory}
            className="p-2 glass-card hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg transition border border-slate-200 dark:border-white/10 cursor-pointer"
            title="Refresh history"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 glass-card p-3 border border-slate-200 dark:border-white/10">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search scenario or run ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 text-xs glass-input"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
          <span className="text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1">
            <Filter size={13} /> Filter:
          </span>
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/10 p-0.5 bg-slate-100 dark:bg-white/5">
            {['ALL', 'NORMAL', 'ANOMALY'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterState(f)}
                className={`px-3 py-1 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  filterState === f
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="glass-card overflow-hidden border border-slate-200 dark:border-white/10">
        {loading ? (
          <div className="p-16 text-center text-slate-500 text-xs">Loading telemetry records...</div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-16 text-center text-slate-500 space-y-2">
            <Clock size={32} className="mx-auto text-slate-400" />
            <div className="text-xs">No simulation logs found matching criteria.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Scenario</th>
                  <th>Waste Feed</th>
                  <th>Electricity</th>
                  <th>Useful Heat</th>
                  <th>CHP Eff.</th>
                  <th>Diagnostic</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-500/5 transition-colors">
                    <td className="text-slate-600 dark:text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="font-bold text-slate-900 dark:text-slate-100 font-sans">{item.scenario_name}</td>
                    <td>{item.parameters?.waste_feed_kg_h ?? 100} kg/h</td>
                    <td className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {item.overall?.electrical_output_kw?.toFixed(1) ?? '—'} kWe
                    </td>
                    <td className="text-amber-600 dark:text-amber-400 font-bold">
                      {item.overall?.heat_recovery_kw?.toFixed(1) ?? '—'} kWth
                    </td>
                    <td className="text-blue-600 dark:text-cyan-400 font-bold">
                      {item.overall?.overall_efficiency_pct?.toFixed(1) ?? '—'}%
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          item.anomaly_state === 'NORMAL' || item.anomaly_state === 'NORMAL_FLUIDIZATION'
                            ? 'badge-success'
                            : 'badge-danger'
                        }`}
                      >
                        {item.anomaly_state}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setSelectedEntry(item)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-cyan-400 rounded-md hover:bg-slate-200/50 dark:hover:bg-white/10 transition cursor-pointer"
                        title="View run details"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drill-down modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in">
          <div className="glass-card max-w-lg w-full p-6 space-y-4 border border-slate-200 dark:border-white/20 shadow-2xl relative bg-white dark:bg-[#0d121f]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                  {selectedEntry.scenario_name}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Telemetry ID: {selectedEntry.id}</p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase font-sans mb-1">
                Thermodynamic Balance & Yield
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Feedstock Chemical Input:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedEntry.overall?.waste_input_kw?.toFixed(1)} kWth</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Turbine Electrical Power:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedEntry.overall?.electrical_output_kw?.toFixed(1)} kWe</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Useful Thermal Cogeneration:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{selectedEntry.overall?.heat_recovery_kw?.toFixed(1)} kWth</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-200 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Combined CHP Efficiency:</span>
                <span className="font-bold text-blue-600 dark:text-cyan-400">{selectedEntry.overall?.overall_efficiency_pct?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600 dark:text-slate-400 font-sans font-medium">Diagnostic Condition:</span>
                <span
                  className={`badge ${
                    selectedEntry.anomaly_state === 'NORMAL' || selectedEntry.anomaly_state === 'NORMAL_FLUIDIZATION'
                      ? 'badge-success'
                      : 'badge-danger'
                  }`}
                >
                  {selectedEntry.anomaly_state}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
