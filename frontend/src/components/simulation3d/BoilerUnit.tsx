import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { UnitTag, SelectionOutlineRing } from './Labels'
import { getPalette } from './palette'

interface BoilerUnitProps {
  steamFlow: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  theme?: 'light' | 'dark'
  onSelectComponent?: (comp: string) => void
  selected?: boolean
}

export function BoilerUnit({
  steamFlow,
  running,
  paused,
  reducedMotion,
  theme = 'dark',
  onSelectComponent,
  selected,
}: BoilerUnitProps) {
  const steamRef = useRef<THREE.Group>(null)
  const gasGlowRef = useRef<THREE.Mesh>(null)
  const p = getPalette(theme)

  const effectiveSteam = Math.max(200, steamFlow || 1547)

  useFrame((_, delta) => {
    if (!running || paused || reducedMotion) return

    // Steam plume rising from vent / safety valve
    if (steamRef.current) {
      const speed = Math.min(2.5, Math.max(0.4, (effectiveSteam / 1500) * 0.9))
      steamRef.current.children.forEach((plume) => {
        plume.position.y += delta * speed
        if (plume.position.y > 1.4) plume.position.y = 0
        const mat = (plume as any).material as THREE.MeshStandardMaterial
        mat.opacity = Math.max(0, 0.45 - plume.position.y * 0.3)
      })
    }

    // Thermal gas core glow pulsing inside the cutaway (ONLY inside)
    if (gasGlowRef.current) {
      const mat = gasGlowRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.003) * 0.15
    }
  })

  return (
    <group position={[3.0, 0, -0.3]} onClick={(e) => { e.stopPropagation(); onSelectComponent?.('boiler'); }}>
      {/* Selection highlight outline */}
      {selected && <SelectionOutlineRing radius={1.9} color="#10b981" />}

      {/* ── 1. Heavy Structural Saddle Supports ─────────────────── */}
      {[-0.9, 0.9].map((sx, idx) => (
        <group key={`saddle-${idx}`} position={[sx, 0.42, 0]}>
          <mesh>
            <boxGeometry args={[0.24, 0.85, 1.4]} />
            <meshStandardMaterial color={p.equipment.boilerSaddle} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.34, 0.05, 1.55]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* ── 2. Boiler Horizontal Pressure Vessel Shell (Teal/Green) ── */}
      {/* Main Cylindrical Shell */}
      <mesh position={[0, 1.75, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.92, 0.92, 2.7, 28]} />
        <meshStandardMaterial color={p.equipment.boilerShell} metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Front / Rear Dished Heads */}
      <mesh position={[-1.35, 1.75, 0]} rotation={[0, 0, Math.PI / 2]}>
        <sphereGeometry args={[0.92, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={p.equipment.boilerDishedHeads} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[1.35, 1.75, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <sphereGeometry args={[0.92, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={p.equipment.boilerDishedHeads} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Structural Stiffener Rings around Vessel Shell */}
      {[-0.6, 0.6].map((rx, idx) => (
        <mesh key={`ring-${idx}`} position={[rx, 1.75, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.94, 0.025, 8, 28]} />
          <meshStandardMaterial color={p.equipment.boilerBands} metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* ── 3. Cutaway Inspection Panel Revealing Tube Bundles ─── */}
      <mesh position={[0, 1.75, 0.91]}>
        <boxGeometry args={[1.75, 1.05, 0.04]} />
        <meshStandardMaterial color={p.equipment.boilerBands} metalness={0.8} roughness={0.2} />
      </mesh>
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

      {/* Internal Thermal Gas Core Glow (ONLY inside cutaway) */}
      <mesh ref={gasGlowRef} position={[0, 1.75, 0.3]}>
        <boxGeometry args={[1.6, 0.9, 0.8]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.5}
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* Internal Visible Tube Bundle Banks */}
      {[-0.3, 0.0, 0.3].map((ty, row) =>
        [-0.6, -0.3, 0.0, 0.3, 0.6].map((tx, col) => (
          <mesh key={`tube-${row}-${col}`} position={[tx, 1.75 + ty, 0.3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 1.5, 8]} />
            <meshStandardMaterial color={p.equipment.boilerTubes} metalness={0.85} roughness={0.2} />
          </mesh>
        ))
      )}

      {/* ── 4. Steam Drum & ASME Safety Valve ───────────────────── */}
      {/* Top Steam Drum Header */}
      <mesh position={[0, 2.9, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.35, 2.2, 20]} />
        <meshStandardMaterial color={p.equipment.boilerDishedHeads} metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Drum Support Risers */}
      {[-0.65, 0.65].map((dx, idx) => (
        <mesh key={`riser-${idx}`} position={[dx, 2.35, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.55, 12]} />
          <meshStandardMaterial color={p.equipment.boilerBands} metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Safety Valve Assembly */}
      <group position={[-0.55, 3.35, 0]}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.12, 12]} />
          <meshStandardMaterial color="#ef4444" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.16, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Steam Plume from Vent */}
        <group ref={steamRef} position={[-0.15, 0.3, 0]}>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={i} position={[(Math.random() - 0.5) * 0.12, Math.random() * 1.1, (Math.random() - 0.5) * 0.12]}>
              <sphereGeometry args={[0.05 + i * 0.005, 6, 6]} />
              <meshStandardMaterial color="#f8fafc" transparent opacity={0.25} />
            </mesh>
          ))}
        </group>
      </group>

      {/* ── 5. Decluttered Unit Tag (Clean Scene, Details on Click) ── */}
      <UnitTag
        position={[0, 4.3, 0]}
        targetPosition={[0, 3.2, 0]}
        unitNumber={3}
        name="HRSG Boiler"
        headline={`${effectiveSteam.toFixed(0)} kg/h`}
        accentColor="#10b981"
        selected={selected}
        onClick={() => onSelectComponent?.('boiler')}
      />
    </group>
  )
}
