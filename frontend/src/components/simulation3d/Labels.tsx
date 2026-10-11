import React from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

interface LeaderLineProps {
  start: [number, number, number]
  end: [number, number, number]
  color?: string
}

/**
 * 3D thin leader line connecting unit surface to the floating label
 */
export function LeaderLine({ start, end, color = '#38bdf8' }: LeaderLineProps) {
  const p1 = new THREE.Vector3(...start)
  const p2 = new THREE.Vector3(...end)
  const dir = p2.clone().sub(p1)
  const len = dir.length()
  const mid = p1.clone().add(p2).multiplyScalar(0.5)

  // Orientation of cylinder
  const orientation = new THREE.Matrix4()
  orientation.lookAt(p1, p2, new THREE.Vector3(0, 1, 0))
  const rotation = new THREE.Euler().setFromRotationMatrix(orientation)

  return (
    <group>
      {/* Small anchor dot on the equipment */}
      <mesh position={start}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Thin leader line */}
      <mesh position={mid.toArray()} rotation={rotation}>
        <cylinderGeometry args={[0.012, 0.012, len, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
      {/* Terminal bead */}
      <mesh position={end}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

interface UnitLabelProps {
  position: [number, number, number]
  targetPosition: [number, number, number]
  title: string
  subtitle?: string
  tag?: string
  tagColor?: string
  accentColor?: string
  schematic?: boolean
  onClick?: () => void
  selected?: boolean
}

export function UnitLabel({
  position,
  targetPosition,
  title,
  subtitle,
  tag,
  tagColor = '#38bdf8',
  accentColor = '#0284c7',
  schematic = false,
  onClick,
  selected = false,
}: UnitLabelProps) {
  return (
    <group position={position}>
      {/* 3D Leader Line from targetPosition to label */}
      <LeaderLine start={targetPosition} end={position} color={accentColor} />

      <Html
        center
        distanceFactor={22}
        zIndexRange={[100, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
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
          className={`px-2.5 py-1.5 rounded-lg border backdrop-blur-md transition-all duration-150 select-none whitespace-nowrap shadow-lg flex flex-col items-start gap-0.5 ${
            selected
              ? 'bg-slate-900/95 border-cyan-400 ring-2 ring-cyan-400/40 shadow-cyan-500/20'
              : 'bg-slate-950/85 border-slate-700/80 hover:border-slate-500'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <span className="font-mono text-[11px] font-bold tracking-tight text-slate-100 uppercase">
              {title}
            </span>
            {schematic && (
              <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                SCHEMATIC
              </span>
            )}
            {tag && !schematic && (
              <span
                className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded border"
                style={{
                  backgroundColor: `${tagColor}1a`,
                  color: tagColor,
                  borderColor: `${tagColor}4d`,
                }}
              >
                {tag}
              </span>
            )}
          </div>
          {subtitle && (
            <span className="text-[9.5px] font-mono text-slate-300 pl-3">
              {subtitle}
            </span>
          )}
        </div>
      </Html>
    </group>
  )
}

interface SubLabelProps {
  position: [number, number, number]
  targetPosition: [number, number, number]
  text: string
  value?: string
  color?: string
}

export function SubLabel({
  position,
  targetPosition,
  text,
  value,
  color = '#38bdf8',
}: SubLabelProps) {
  return (
    <group position={position}>
      <LeaderLine start={targetPosition} end={position} color={color} />
      <Html
        center
        distanceFactor={20}
        zIndexRange={[110, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className="px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700/80 backdrop-blur-md shadow-md flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-[9.5px] font-mono font-bold tracking-tight text-slate-200">
            {text}
          </span>
          {value && (
            <span className="text-[9.5px] font-mono font-bold text-cyan-400">
              {value}
            </span>
          )}
        </div>
      </Html>
    </group>
  )
}
