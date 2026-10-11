import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ProcessPipesProps {
  syngasKw: number
  steamKw: number
  condenserKw: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
}

export function ProcessPipes({
  syngasKw,
  steamKw,
  condenserKw,
  running,
  paused,
  reducedMotion,
}: ProcessPipesProps) {
  const syngasFlowRef = useRef<THREE.Group>(null)
  const steamFlowRef = useRef<THREE.Group>(null)
  const exhaustFlowRef = useRef<THREE.Group>(null)

  // Flow speeds proportional to real physics kW
  const effectiveSyngas = Math.max(200, syngasKw || 1490.4)
  const effectiveSteam = Math.max(200, steamKw || 1266.8)
  const effectiveCondenser = Math.max(150, condenserKw || 1068.9)

  const syngasSpeed = Math.min(3.2, Math.max(0.4, (effectiveSyngas / 1490) * 1.3))
  const steamSpeed = Math.min(3.2, Math.max(0.4, (effectiveSteam / 1267) * 1.3))
  const exhaustSpeed = Math.min(3.2, Math.max(0.4, (effectiveCondenser / 1069) * 1.3))

  useFrame((_, delta) => {
    if (!running || paused || reducedMotion) return

    // 1. Syngas flow particles (Gasifier -> Cyclone -> Boiler)
    if (syngasFlowRef.current) {
      syngasFlowRef.current.children.forEach((p) => {
        p.position.x += delta * syngasSpeed
        if (p.position.x > 0.6) p.position.x = -4.5
      })
    }

    // 2. High-Pressure Steam flow particles (Boiler Steam Drum -> Turbine HP)
    if (steamFlowRef.current) {
      steamFlowRef.current.children.forEach((p) => {
        p.position.x += delta * steamSpeed
        if (p.position.x > 6.5) p.position.x = 2.0
      })
    }

    // 3. Exhaust Steam flow particles (Turbine -> Condenser HX)
    if (exhaustFlowRef.current) {
      exhaustFlowRef.current.children.forEach((p) => {
        p.position.x += delta * exhaustSpeed
        if (p.position.x > 11.5) p.position.x = 7.25
      })
    }
  })

  return (
    <group>
      {/* ── 1. Syngas Line: Gasifier Top -> Cyclone -> Boiler ───── */}
      {/* Segment 1A: Gasifier Top [-4.5, 4.4, 0] to Cyclone [0.05, 3.35, -0.3] */}
      <mesh position={[-2.2, 3.9, -0.16]} rotation={[0, 0, Math.PI / 2 - Math.PI / 18]}>
        <cylinderGeometry args={[0.13, 0.13, 4.7, 14]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Flange on line 1A */}
      <mesh position={[-2.2, 3.9, -0.16]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.05, 14]} />
        <meshStandardMaterial color="#d97706" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Segment 1B: Cyclone Top [0.5, 4.0, -0.6] to Boiler Inlet [1.65, 2.5, -0.3] */}
      <mesh position={[1.08, 3.25, -0.45]} rotation={[0, 0, Math.PI / 2 - Math.PI / 5]}>
        <cylinderGeometry args={[0.13, 0.13, 1.9, 14]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Syngas Flow Particles */}
      <group ref={syngasFlowRef} position={[0, 3.6, -0.2]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={`syn-p-${i}`} position={[-4.5 + i * 0.75, 0, 0]}>
            <sphereGeometry args={[0.048, 6, 6]} />
            <meshStandardMaterial color="#fde047" emissive="#f59e0b" emissiveIntensity={0.9} />
          </mesh>
        ))}
      </group>

      {/* ── 2. Superheated Steam Line: Boiler Drum -> Turbine HP ── */}
      {/* Horizontal Run at Y = 3.4 */}
      <mesh position={[5.58, 3.4, -0.15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 5.2, 14]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Vertical Drop to Turbine HP inlet */}
      <mesh position={[8.15, 2.75, 0.0]}>
        <cylinderGeometry args={[0.09, 0.09, 1.3, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Drum Outlet Riser */}
      <mesh position={[3.0, 3.15, -0.3]}>
        <cylinderGeometry args={[0.09, 0.09, 0.5, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* HP Steam Flow Particles */}
      <group ref={steamFlowRef}>
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh key={`stm-p-${i}`} position={[3.0 + i * 0.72, 3.4, -0.15]}>
            <sphereGeometry args={[0.045, 6, 6]} />
            <meshStandardMaterial color="#ffffff" emissive="#38bdf8" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>

      {/* ── 3. Low-Pressure Steam Exhaust: Turbine -> Condenser ─── */}
      <mesh position={[10.98, 1.45, -0.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 4.3, 14]} />
        <meshStandardMaterial color="#64748b" metalness={0.75} roughness={0.25} />
      </mesh>

      {/* LP Steam Flow Particles */}
      <group ref={exhaustFlowRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={`exh-p-${i}`} position={[8.85 + i * 0.7, 1.45, -0.1]}>
            <sphereGeometry args={[0.048, 6, 6]} />
            <meshStandardMaterial color="#f43f5e" emissive="#f43f5e" emissiveIntensity={0.6} />
          </mesh>
        ))}
      </group>

      {/* ── 4. Boiler Feed Water (BFW) Return Loop ──────────────── */}
      {/* From Condenser Hotwell [13.1, 0.8, -0.2] across to Feed Pump [5.65, 0.35, 1.2] */}
      <mesh position={[9.38, 0.58, 0.5]} rotation={[0, -Math.PI / 10, Math.PI / 2]}>
        <cylinderGeometry args={[0.065, 0.065, 7.6, 10]} />
        <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* From Feed Pump discharge to Boiler Economizer */}
      <mesh position={[4.33, 0.5, 0.45]} rotation={[0, Math.PI / 8, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 3.1, 10]} />
        <meshStandardMaterial color="#0369a1" metalness={0.75} roughness={0.25} />
      </mesh>

      {/* ── 5. Boiler Flue Gas Duct to Exhaust Stack ────────────── */}
      <mesh position={[5.18, 1.38, -1.75]} rotation={[Math.PI / 4, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 2.8, 14]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ── 6. Structural Pipe Racks & Stanchions ───────────────── */}
      {[
        { x: -2.2, y: 1.95, z: -0.16, h: 3.9 },
        { x: 5.58, y: 1.7, z: -0.15, h: 3.4 },
        { x: 10.98, y: 0.72, z: -0.1, h: 1.45 },
      ].map((st, idx) => (
        <group key={`stanchion-${idx}`} position={[st.x, st.y, st.z]}>
          {/* Vertical I-beam column */}
          <mesh>
            <boxGeometry args={[0.08, st.h, 0.08]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Pipe support saddle / cross-arm */}
          <mesh position={[0, st.h / 2, 0]}>
            <boxGeometry args={[0.34, 0.06, 0.12]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Base plate at ground */}
          <mesh position={[0, -st.h / 2 + 0.02, 0]}>
            <boxGeometry args={[0.22, 0.04, 0.22]} />
            <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
