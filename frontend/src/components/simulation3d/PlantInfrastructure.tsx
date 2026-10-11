import React from 'react'
import * as THREE from 'three'

export function PlantInfrastructure() {
  return (
    <group>
      {/* ── 1. Heavy Industrial Epoxy Ground Floor ──────────────── */}
      <mesh position={[1.0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[44, 22]} />
        <meshStandardMaterial color="#070b14" roughness={0.88} metalness={0.15} />
      </mesh>

      {/* Subtle Precision Grid Lines */}
      <gridHelper args={[44, 44, '#0369a1', '#111827']} position={[1.0, 0.005, 0]} />

      {/* ── 2. Floor Safety Markings & Hazard Zones ─────────────── */}
      {/* Conveyor Area Safety Boundary Line */}
      <mesh position={[-10.5, 0.01, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.6, 2.2]} />
        <meshBasicMaterial color="#eab308" wireframe />
      </mesh>

      {/* Gasifier Reactor High-Temperature Hazard Zone (Yellow Octagon Ring) */}
      <mesh position={[-4.5, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.0, 2.15, 8]} />
        <meshBasicMaterial color="#f59e0b" />
      </mesh>

      {/* Turbine & Generator Machinery Exclusion Zone (Yellow Boundary) */}
      <mesh position={[9.4, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.1, 2.25, 24]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>

      {/* Directional Flow Floor Decal Arrows */}
      {[-8.0, -2.5, 4.8, 10.5].map((fx, idx) => (
        <group key={`flow-decal-${idx}`} position={[fx, 0.012, 1.8]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
          <mesh>
            <coneGeometry args={[0.18, 0.35, 3]} />
            <meshBasicMaterial color="#0284c7" transparent opacity={0.65} />
          </mesh>
        </group>
      ))}

      {/* ── 3. Elevated Mezzanine Walkways & Handrails ──────────── */}
      {/* Walkway Platform Deck behind Gasifier & Boiler (Z = -1.5) */}
      <group position={[-1.0, 2.3, -1.5]}>
        {/* Steel Grating Floor Plate */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[9.5, 0.08, 1.2]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Support Steel Columns extending to ground */}
        {[-4.2, -1.4, 1.4, 4.2].map((cx, i) => (
          <mesh key={`col-${i}`} position={[cx, -1.15, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 2.3, 10]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
          </mesh>
        ))}

        {/* Safety Handrails (OSHA Standard Industrial Yellow) */}
        {/* Front Top Rail */}
        <mesh position={[0, 0.95, 0.58]}>
          <boxGeometry args={[9.5, 0.04, 0.04]} />
          <meshStandardMaterial color="#eab308" metalness={0.5} roughness={0.35} />
        </mesh>
        {/* Front Mid Rail */}
        <mesh position={[0, 0.5, 0.58]}>
          <boxGeometry args={[9.5, 0.03, 0.03]} />
          <meshStandardMaterial color="#eab308" metalness={0.5} roughness={0.35} />
        </mesh>
        {/* Kickplate / Toe-board */}
        <mesh position={[0, 0.1, 0.58]}>
          <boxGeometry args={[9.5, 0.16, 0.02]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.6} roughness={0.35} />
        </mesh>

        {/* Vertical Handrail Stanchion Posts */}
        {[-4.5, -3.0, -1.5, 0.0, 1.5, 3.0, 4.5].map((hx, idx) => (
          <mesh key={`stanchion-${idx}`} position={[hx, 0.5, 0.58]}>
            <cylinderGeometry args={[0.025, 0.025, 1.0, 8]} />
            <meshStandardMaterial color="#eab308" metalness={0.5} roughness={0.35} />
          </mesh>
        ))}

        {/* Access Steel Ladder to Mezzanine */}
        <group position={[-4.7, -1.15, 0]}>
          {[-0.2, 0.2].map((lx, li) => (
            <mesh key={`ladder-side-${li}`} position={[lx, 0, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 2.3, 8]} />
              <meshStandardMaterial color="#eab308" metalness={0.6} roughness={0.35} />
            </mesh>
          ))}
          {/* Ladder Rungs */}
          {[-0.9, -0.6, -0.3, 0.0, 0.3, 0.6, 0.9].map((ry, ri) => (
            <mesh key={`rung-${ri}`} position={[0, ry, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.018, 0.018, 0.38, 8]} />
              <meshStandardMaterial color="#eab308" metalness={0.6} roughness={0.35} />
            </mesh>
          ))}
        </group>
      </group>

      {/* ── 4. Architectural Facility Back Wall with Soft Lighting ── */}
      <group position={[1.0, 4.5, -4.8]}>
        {/* Structural Wall Panels */}
        <mesh>
          <planeGeometry args={[42, 9.5]} />
          <meshStandardMaterial color="#090d16" roughness={0.92} metalness={0.1} />
        </mesh>

        {/* Acoustic Paneling Division Battens */}
        {[-16, -12, -8, -4, 0, 4, 8, 12, 16].map((bx, bi) => (
          <mesh key={`batten-${bi}`} position={[bx, 0, 0.01]}>
            <boxGeometry args={[0.05, 9.4, 0.02]} />
            <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}

        {/* Soft Industrial Luminaire Wall Wash Fixtures */}
        {[-10, -4, 2, 8, 14].map((lx, li) => (
          <group key={`light-${li}`} position={[lx, 4.0, 0.2]}>
            <mesh>
              <boxGeometry args={[0.8, 0.12, 0.2]} />
              <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.06, 0]}>
              <boxGeometry args={[0.7, 0.02, 0.15]} />
              <meshBasicMaterial color="#e0f2fe" />
            </mesh>
            {/* Soft Downward Accent Light */}
            <pointLight position={[0, -0.5, 0.3]} intensity={0.4} color="#38bdf8" distance={7} />
          </group>
        ))}
      </group>
    </group>
  )
}
