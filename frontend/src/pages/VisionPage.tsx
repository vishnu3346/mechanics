import { useState, useRef, useEffect } from 'react'
import { api } from '../services/api'
import type { Detection } from '../types'
import {
  Upload,
  Camera,
  Sparkles,
  RotateCw,
  Eye,
} from 'lucide-react'

const CLASS_COLORS: Record<string, string> = {
  Infectious: '#ef4444',
  Plastic: '#3b82f6',
  Glass: '#a855f7',
  Organic: '#22c55e',
  General: '#06b6d4',
  Pathological: '#f59e0b',
  Sharps: '#ec4899',
}

const SAMPLE_STREAMS = [
  { name: 'Mixed Clinical Waste', count: 6 },
  { name: 'Polymer Surge (Syringes)', count: 8 },
  { name: 'Pathological & Dressings', count: 5 },
]

export default function VisionPage() {
  const [detections, setDetections] = useState<Detection[]>([])
  const [classCounts, setClassCounts] = useState<Record<string, number>>({})
  const [, setMode] = useState<string>('demo')
  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [imgSize, setImgSize] = useState({ w: 640, h: 420 })
  const [scanning, setScanning] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const runDetection = async () => {
    setLoading(true)
    setScanning(true)
    try {
      const res = await api.post('/vision/inference')
      setDetections(res.detections)
      setClassCounts(res.class_counts)
      setMode(res.mode)
      drawCanvas(res.detections)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setTimeout(() => setScanning(false), 800)
    }
  }

  useEffect(() => {
    runDetection()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setLoading(true)
    setScanning(true)
    try {
      const res = await api.postFile('/vision/inference', file)
      setDetections(res.detections)
      setClassCounts(res.class_counts)
      setMode(res.mode)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setTimeout(() => setScanning(false), 800)
    }
  }

  const drawCanvas = (dets: Detection[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = 640
    canvas.height = 420

    // High tech dark background grid
    ctx.fillStyle = '#080c16'
    ctx.fillRect(0, 0, 640, 420)

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
    ctx.lineWidth = 1
    for (let x = 0; x < 640; x += 32) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 420)
      ctx.stroke()
    }
    for (let y = 0; y < 420; y += 32) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(640, y)
      ctx.stroke()
    }

    // Circular targeting reticle in center
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(320, 210, 110, 0, Math.PI * 2)
    ctx.stroke()

    // Bounding boxes
    dets.forEach((d) => {
      const { x, y, width, height } = d.bbox
      const color = d.color || CLASS_COLORS[d.class] || '#06b6d4'

      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.strokeRect(x, y, width, height)

      // Corner accent brackets
      const bracketLen = 8
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, y + bracketLen); ctx.lineTo(x, y); ctx.lineTo(x + bracketLen, y)
      ctx.moveTo(x + width - bracketLen, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + bracketLen)
      ctx.moveTo(x, y + height - bracketLen); ctx.lineTo(x, y + height); ctx.lineTo(x + bracketLen, y + height)
      ctx.moveTo(x + width - bracketLen, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - bracketLen)
      ctx.stroke()

      // Fill glow
      ctx.fillStyle = color
      ctx.globalAlpha = 0.18
      ctx.fillRect(x, y, width, height)
      ctx.globalAlpha = 1.0

      // Class Label pill
      const label = `${d.class} ${(d.confidence * 100).toFixed(0)}%`
      ctx.font = 'bold 11px JetBrains Mono, monospace'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = color
      ctx.fillRect(x, Math.max(0, y - 22), tw + 10, 22)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, x + 5, Math.max(15, y - 7))
    })
  }

  const totalDetections = detections.length
  const avgConfidence =
    totalDetections > 0
      ? Math.round((detections.reduce((acc, d) => acc + d.confidence, 0) / totalDetections) * 100)
      : 0

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Eye className="text-blue-600 dark:text-cyan-400" size={24} />
            <span>AI Waste Vision Sorting & Segmentation</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-normal">
            Real-time YOLOv8 automated multi-class medical waste categorization (Sharps, Infectious, Polymer, Glass)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="badge badge-info font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
            YOLOv8 Active
          </span>
          <span className="badge badge-purple font-mono">
            Confidence: {avgConfidence}%
          </span>
        </div>
      </div>

      {/* Main Vision Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Inspection Viewport */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-card overflow-hidden border border-slate-200 dark:border-white/10 relative">
            {/* Viewport Top Bar */}
            <div className="px-4 py-2.5 bg-slate-100/90 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera size={15} className="text-blue-600 dark:text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-900 dark:text-slate-200">
                  Optical Conveyor Feed // Cam-01
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                <span>FPS: 30.0</span>
                <span>RES: 640x420</span>
              </div>
            </div>

            {/* Viewport Frame */}
            <div className="relative bg-slate-950 flex items-center justify-center min-h-[400px] overflow-hidden">
              {/* Laser Scanning Line */}
              {scanning && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-glow-cyan animate-scanline z-30 pointer-events-none" />
              )}

              {/* HUD Crosshair overlay */}
              <div className="absolute top-4 left-4 z-20 font-mono text-[10px] text-cyan-400 font-semibold pointer-events-none">
                [AI_TRACK: ACTIVE] [EXP: 1/250s]
              </div>
              <div className="absolute top-4 right-4 z-20 font-mono text-[10px] text-cyan-400 font-semibold pointer-events-none">
                ISO: 400 // STACK: AUTO
              </div>

              {imageUrl ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={imageUrl}
                    className="max-h-[420px] object-contain"
                    alt="Uploaded medical waste"
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement
                      setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
                    }}
                  />
                  {/* Bounding box SVG overlay */}
                  <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}>
                    {detections.map((d) => (
                      <g key={d.id}>
                        <rect
                          x={d.bbox.x}
                          y={d.bbox.y}
                          width={d.bbox.width}
                          height={d.bbox.height}
                          fill={d.color}
                          fillOpacity="0.22"
                          stroke={d.color}
                          strokeWidth="2.5"
                        />
                        <rect
                          x={d.bbox.x}
                          y={Math.max(0, d.bbox.y - 24)}
                          width={110}
                          height={24}
                          fill={d.color}
                        />
                        <text
                          x={d.bbox.x + 6}
                          y={Math.max(16, d.bbox.y - 7)}
                          fill="#ffffff"
                          fontSize="12"
                          fontWeight="bold"
                          fontFamily="JetBrains Mono"
                        >
                          {d.class} {(d.confidence * 100).toFixed(0)}%
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              ) : (
                <canvas ref={canvasRef} width={640} height={420} className="w-full h-auto max-h-[420px] object-contain" />
              )}
            </div>

            {/* Viewport Control Bar */}
            <div className="p-3 bg-slate-50/90 dark:bg-white/5 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-semibold text-slate-800 dark:text-slate-100 transition border border-slate-300 dark:border-white/10 shadow-xs cursor-pointer"
                >
                  <Upload size={13} />
                  Upload Specimen
                </button>
                <button
                  onClick={runDetection}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
                  {loading ? 'Analyzing Stream...' : 'Trigger Scan'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Presets:</span>
                {SAMPLE_STREAMS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={runDetection}
                    className="text-[11px] font-mono px-2 py-1 rounded bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-300 font-semibold cursor-pointer"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Classification Statistics & Telemetry */}
        <div className="lg:col-span-4 space-y-4">
          {/* Summary Card */}
          <div className="glass-card p-5 space-y-4 border border-slate-200 dark:border-white/10">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/10">
              <span>Stream Classification</span>
              <span className="text-blue-600 dark:text-cyan-400 font-bold">{totalDetections} Objects</span>
            </h3>

            {/* Class distribution progress bars */}
            <div className="space-y-3">
              {Object.entries(classCounts).map(([cls, count]) => {
                const pct = totalDetections > 0 ? Math.round((count / totalDetections) * 100) : 0
                const color = CLASS_COLORS[cls] || '#64748b'
                return (
                  <div key={cls} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                        <span className="font-bold text-slate-800 dark:text-slate-200">{cls}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-600 dark:text-slate-400">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detections List */}
          <div className="glass-card p-4 space-y-3 border border-slate-200 dark:border-white/10">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono">
              Live Detection Feed
            </h3>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {detections.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-2 rounded-md bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="font-bold text-slate-800 dark:text-slate-200">{d.class}</span>
                  </div>
                  <span className="text-blue-600 dark:text-cyan-400 font-bold">
                    {(d.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
              {detections.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No targets detected in optical frame.
                </div>
              )}
            </div>
          </div>

          {/* Operational Advisory */}
          <div className="glass-card p-3.5 border border-blue-200 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-500/10 text-xs space-y-1">
            <div className="font-bold text-blue-900 dark:text-blue-400 flex items-center gap-1.5">
              <Sparkles size={14} />
              Automated Sorting Actuator
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              Optical bounding coordinates feed pneumatic diverters to separate non-combustible glass/metals prior to
              fluidized bed feeder entry.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
