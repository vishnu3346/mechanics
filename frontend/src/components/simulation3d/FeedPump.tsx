import React from 'react'
import * as THREE from 'three'
import { UnitLabel } from './Labels'

interface FeedPumpProps {
  onSelectComponent?: (comp: string) => void
  selected?: boolean
}

export function FeedPump({ onSelectComponent, selected }: FeedPumpProps) {
  return (
    <group position={[5.65, 0.35, 1.2]} onClick={(e) => { e.stopPropagation(); onSelectComponent?.('boiler'); }}>
      {/* Selection highlight */}
      {selected && (
        <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.85, 20]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Cast Foundation Skid Base */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[1.5, 0.12, 0.7]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Multi-Stage Centrifugal Barrel Pump Casing */}
      <mesh position={[-0.32, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 0.65, 16]} />
        <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Stage division ring collars */}
      {[-0.5, -0.38, -0.26, -0.14].map((px, i) => (
        <mesh key={i} position={[px, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.23, 0.015, 6, 16]} />
          <meshStandardMaterial color="#0369a1" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Suction Nozzle (facing +Z from condenser) */}
      <mesh position={[-0.45, 0.32, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.22, 12]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Discharge High-Pressure Nozzle (vertical, to boiler economizer) */}
      <mesh position={[-0.18, 0.54, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.22, 12]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Pressure Gauge Dial on Discharge */}
      <group position={[-0.18, 0.72, 0.08]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.03, 16]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.01, 16]} />
          <meshBasicMaterial color="#0284c7" />
        </mesh>
      </group>

      {/* Flexible Shaft Coupling Guard */}
      <mesh position={[0.05, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 0.18, 14]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.35} />
      </mesh>

      {/* Electric Drive Motor */}
      <mesh position={[0.42, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.26, 0.26, 0.55, 16]} />
        <meshStandardMaterial color="#1e40af" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Motor Terminal Box */}
      <mesh position={[0.42, 0.58, 0]}>
        <boxGeometry args={[0.16, 0.14, 0.16]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Unit Label with Leader Line */}
      <UnitLabel
        position={[0, 1.85, 0]}
        targetPosition={[0, 0.6, 0]}
        title="BOILER FEED PUMP"
        subtitle="16 bar Multistage BFW Supply"
        tag="AUX PUMP"
        tagColor="#38bdf8"
        accentColor="#0284c7"
        onClick={() => onSelectComponent?.('boiler')}
      />
    </group>
  )
}
