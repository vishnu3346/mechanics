import React, { useState } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

interface LeaderLineProps {
  start: [number, number, number]
  end: [number, number, number]
  color?: string
}

/**
 * 3D thin leader line connecting unit surface to the tag
 */
export function LeaderLine({ start, end, color = '#38bdf8' }: LeaderLineProps) {
  const p1 = new THREE.Vector3(...start)
  const p2 = new THREE.Vector3(...end)
  const dir = p2.clone().sub(p1)
  const len = dir.length()
  const mid = p1.clone().add(p2).multiplyScalar(0.5)

  const orientation = new THREE.Matrix4()
  orientation.lookAt(p1, p2, new THREE.Vector3(0, 1, 0))
  const rotation = new THREE.Euler().setFromRotationMatrix(orientation)

  return (
    <group>
      <mesh position={start}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={mid.toArray()} rotation={rotation}>
        <cylinderGeometry args={[0.008, 0.008, len, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      <mesh position={end}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

/**
 * Animated Selection Highlight Ring at the base of a selected unit
 */
export function SelectionOutlineRing({
  radius = 1.8,
  color = '#38bdf8',
}: {
  radius?: number
  color?: string
}) {
  return (
    <group position={[0, 0.02, 0]}>
      {/* Outer bright accent ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.96, radius * 1.04, 36]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.9} />
      </mesh>
      {/* Inner soft glow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, radius * 0.95, 32]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.12} />
      </mesh>
    </group>
  )
}

interface UnitTagProps {
  position: [number, number, number]
  targetPosition?: [number, number, number]
  unitNumber?: number
  name: string
  headline?: string
  accentColor?: string
  selected?: boolean
  onClick?: () => void
}

/**
 * Minimalist, decluttered 3D Unit Tag
 * - Shows ONLY a small numbered/dot marker and a short name (2-3 words)
 * - NO floating sub-text, NO floating badges
 * - Hover reveals ONLY a compact tooltip with the single headline number
 * - Click selects the unit and opens the docked side inspector
 */
export function UnitTag({
  position,
  targetPosition,
  unitNumber,
  name,
  headline,
  accentColor = '#38bdf8',
  selected = false,
  onClick,
}: UnitTagProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <group position={position}>
      {targetPosition && (
        <LeaderLine start={targetPosition} end={position} color={accentColor} />
      )}

      <Html center distanceFactor={22} zIndexRange={[120, 0]} style={{ pointerEvents: 'none' }}>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={(e) => {
            if (onClick) {
              e.stopPropagation()
              onClick()
            }
          }}
          style={{
            pointerEvents: onClick ? 'auto' : 'none',
            cursor: onClick ? 'pointer' : 'default',
          }}
          className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md transition-all duration-200 select-none shadow-md ${
            selected
              ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900 shadow-blue-500/30 scale-105'
              : 'bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-white/20 hover:border-white/40'
          }`}
        >
          {/* Small numbered marker or dot */}
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 transition-colors ${
              selected
                ? 'bg-white text-blue-700'
                : 'bg-white/15 text-white group-hover:bg-cyan-500 group-hover:text-slate-950'
            }`}
          >
            {unitNumber !== undefined ? unitNumber : '●'}
          </span>

          {/* Short 2-3 word name tag */}
          <span className="font-mono text-[11px] font-bold tracking-tight whitespace-nowrap uppercase">
            {name}
          </span>

          {/* Small Hover Tooltip with headline number */}
          {hovered && headline && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2 py-0.5 rounded-md bg-slate-950/95 border border-white/20 text-cyan-400 text-[10px] font-mono font-semibold shadow-lg whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-100 z-50">
              <span className="text-slate-300 font-normal mr-1">{name}:</span>
              <span className="font-bold text-white">{headline}</span>
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}
