import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { UnitLabel } from './Labels'

interface BoilerUnitProps {
  steamFlow: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  onSelectComponent?: (comp: string) => void
  selected?: boolean
}

export function BoilerUnit({
  steamFlow,
  running,
  paused,
  reducedMotion,
  onSelectComponent,
  selected,
}: BoilerUnitProps) {
  const steamRef = useRef<THREE.Group>(null)
  const gasGlowRef = useRef<THREE.Mesh>(null)

  const effectiveSteam = Math.max(200, steamFlow || 1547)

  useFrame((_, delta) => {
    if (!running || paused || reducedMotion) return

    // Steam plume rising from vent / safety valve
    if (steamRef.current) {
      const speed = Math.min(2.5, Math.max(0.4, (effectiveSteam / 1500) * 0.9))
      steamRef.current.children.forEach((p) => {
        p.position.y += delta * speed
        if (p.position.y > 1.4) p.position.y = 0
        const mat = (p as any).material as THREE.MeshStandardMaterial
        mat.opacity = Math.max(0, 0.45 - p.position.y * 0.3)
      })
    }

    // Thermal gas glow pulsing inside the cutaway
    if (gasGlowRef.current) {
      const mat = gasGlowRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.003) * 0.15
    }
  })

  return (
    <group position={[3.0, 0, -0.3]} onClick={(e) => { e.stopPropagation(); onSelectComponent?.('boiler'); }}>
      {/* Selection highlight ring */}
      {selected && (
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.7, 1.9, 36]} />
          <meshBasicMaterial color="#f59e0b" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* ── 1. Heavy Structural Saddle Supports ─────────────────── */}
      {[-0.9, 0.9].map((sx, idx) => (
        <group key={`saddle-${idx}`} position={[sx, 0.42, 0]}>
          <mesh>
            <boxGeometry args={[0.24, 0.85, 1.4]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Base plate with anchor bolts */}
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.34, 0.05, 1.55]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* ── 2. Boiler Horizontal Pressure Vessel Shell ──────────── */}
      {/* Main Cylindrical Shell */}
      <mesh position={[0, 1.75, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.92, 0.92, 2.7, 28]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Front / Rear Dished Heads */}
      <mesh position={[-1.35, 1.75, 0]} rotation={[0, 0, Math.PI / 2]}>
        <sphereGeometry args={[0.92, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[1.35, 1.75, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <sphereGeometry args={[0.92, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.25} />
      </mesh>

      {/* ── 3. Cutaway Inspection Panel Revealing Tube Bundles ─── */}
      {/* Front Cutaway Opening Bezel */}
      <mesh position={[0, 1.75, 0.91]}>
        <boxGeometry args={[1.75, 1.05, 0.04]} />
        <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Transparent Inspection Glass */}
      <mesh position={[0, 1.75, 0.92]}>
        <planeGeometry args={[1.65, 0.95]} />
        <meshStandardMaterial
          color="#38bdf8"
          transparent
          opacity={0.22}
          metalness={0.1}
          roughness={0.1}
        />
      </mesh>

      {/* Internal Thermal Gas Atmosphere Glow */}
      <mesh ref={gasGlowRef} position={[0, 1.75, 0.3]}>
        <boxGeometry args={[1.6, 0.9, 0.8]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.5}
          transparent
          opacity={0.18}
        />
      </mesh>

      {/* Internal Visible Tube Bundle Banks (Evaporator / Superheater) */}
      <group position={[0, 1.75, 0.4]}>
        {/* Serpentine hairpin tubes arranged in staggered rows */}
        {[-0.6, -0.3, 0.0, 0.3, 0.6].map((tx, rowIdx) => (
          <group key={`t-row-${rowIdx}`} position={[tx, 0, 0]}>
            {[-0.32, -0.16, 0.0, 0.16, 0.32].map((ty, tIdx) => (
              <mesh key={`tube-${tIdx}`} position={[0, ty, (tIdx % 2) * 0.06]}>
                <cylinderGeometry args={[0.022, 0.022, 0.18, 8]} />
                <meshStandardMaterial
                  color="#e2e8f0"
                  metalness={0.85}
                  roughness={0.2}
                  emissive="#f59e0b"
                  emissiveIntensity={0.15}
                />
              </mesh>
            ))}
            {/* Top / bottom hairpin return bends */}
            <mesh position={[0, 0.36, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.06, 0.02, 6, 12, Math.PI]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
            </mesh>
            <mesh position={[0, -0.36, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <torusGeometry args={[0.06, 0.02, 6, 12, Math.PI]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
            </mesh>
          </group>
        ))}

        {/* Header Manifold Pipes */}
        <mesh position={[0, 0.42, -0.15]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 1.5, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, -0.42, -0.15]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 1.5, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.25} />
        </mesh>
      </group>

      {/* ── 4. Upper Steam Drum Assembly ────────────────────────── */}
      <group position={[0, 2.9, 0]}>
        {/* Steam Drum Cylindrical Vessel Shell */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.38, 0.38, 1.9, 20]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Drum Dished Heads */}
        <mesh position={[-0.95, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <sphereGeometry args={[0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0.95, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <sphereGeometry args={[0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Downcomer & Riser Tube Bank (Connecting Drum to Boiler Shell) */}
        {[-0.6, -0.2, 0.2, 0.6].map((dx, idx) => (
          <group key={`downcomer-${idx}`} position={[dx, -0.58, 0]}>
            <mesh position={[0, 0, 0.12]}>
              <cylinderGeometry args={[0.045, 0.045, 0.8, 10]} />
              <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, -0.12]}>
              <cylinderGeometry args={[0.045, 0.045, 0.8, 10]} />
              <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        ))}

        {/* Drum Level Gauge Glass on front-right end */}
        <group position={[1.05, 0, 0.25]}>
          {/* Upper/Lower isolating valves */}
          <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[0.06, 0.06, 0.1]} />
            <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.18, 0]}>
            <boxGeometry args={[0.06, 0.06, 0.1]} />
            <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Glass column tube with liquid water line */}
          <mesh>
            <cylinderGeometry args={[0.02, 0.02, 0.34, 10]} />
            <meshStandardMaterial color="#38bdf8" transparent opacity={0.65} />
          </mesh>
          {/* Liquid level indicator ring */}
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.02, 10]} />
            <meshBasicMaterial color="#06b6d4" />
          </mesh>
        </group>

        {/* Spring-Loaded Safety Relief Valve on top of drum */}
        <group position={[-0.45, 0.42, 0]}>
          {/* Valve bonnet body */}
          <mesh>
            <cylinderGeometry args={[0.07, 0.09, 0.22, 12]} />
            <meshStandardMaterial color="#ef4444" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Spring casing */}
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.16, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
          </mesh>
          {/* Manual test easing lever */}
          <mesh position={[0.08, 0.22, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.12, 0.02, 0.02]} />
            <meshStandardMaterial color="#ef4444" metalness={0.6} roughness={0.3} />
          </mesh>
          {/* 90-degree vent discharge elbow */}
          <mesh position={[-0.08, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.045, 0.14, 10]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>

        {/* Steam Plume from Vent */}
        <group ref={steamRef} position={[-0.55, 0.45, 0]}>
          {Array.from({ length: 10 }).map((_, i) => (
            <mesh key={i} position={[(Math.random() - 0.5) * 0.15, Math.random() * 1.2, (Math.random() - 0.5) * 0.15]}>
              <sphereGeometry args={[0.05 + i * 0.005, 6, 6]} />
              <meshStandardMaterial color="#f8fafc" transparent opacity={0.3} />
            </mesh>
          ))}
        </group>
      </group>

      {/* ── 5. Unit Label with Thin Leader Line (Staggered Height) ── */}
      <UnitLabel
        position={[0, 4.5, 0]}
        targetPosition={[0, 3.2, 0]}
        title="HRSG STEAM BOILER"
        subtitle={`${effectiveSteam.toFixed(0)} kg/h · 10 bar · 350 °C Superheated`}
        tag="STEAM GENERATOR"
        tagColor="#f59e0b"
        accentColor="#f59e0b"
        onClick={() => onSelectComponent?.('boiler')}
      />
    </group>
  )
}
