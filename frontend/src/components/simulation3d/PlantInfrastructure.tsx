import React from 'react'
import * as THREE from 'three'
import { getPalette } from './palette'

interface PlantInfrastructureProps {
  theme?: 'light' | 'dark'
  onSelectComponent?: (comp: string) => void
}

export function PlantInfrastructure({
  theme = 'dark',
  onSelectComponent,
}: PlantInfrastructureProps) {
  const p = getPalette(theme)
  const sur = p.surroundings

  return (
    <group>
      {/* ── 1. Real Industrial Concrete Slab Floor with Expansion Joints ── */}
      {/* Main Concrete Foundation Slab */}
      <mesh position={[1.0, -0.01, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[46, 26]} />
        <meshStandardMaterial
          color={sur.floorSlab}
          roughness={sur.floorRoughness}
          metalness={sur.floorMetalness}
        />
      </mesh>

      {/* Recessed Expansion Joints Grid (4m x 4m concrete slab joints) */}
      <group position={[1.0, 0.002, 0.5]}>
        {/* Longitudinal expansion joint seams (parallel to X) */}
        {[-10, -6, -2, 2, 6, 10].map((z, idx) => (
          <mesh key={`ej-x-${idx}`} position={[0, 0, z]}>
            <boxGeometry args={[45.8, 0.004, 0.03]} />
            <meshBasicMaterial color={sur.expansionJoints} />
          </mesh>
        ))}
        {/* Transverse expansion joint seams (parallel to Z) */}
        {[-20, -16, -12, -8, -4, 0, 4, 8, 12, 16, 20].map((x, idx) => (
          <mesh key={`ej-z-${idx}`} position={[x, 0, 0]}>
            <boxGeometry args={[0.03, 0.004, 25.8]} />
            <meshBasicMaterial color={sur.expansionJoints} />
          </mesh>
        ))}
      </group>

      {/* ── 2. Painted Walkway Lanes & OSHA Safety Yellow Markings ── */}
      {/* Pedestrian Safety Walkway Lane (foreground corridor) */}
      <group position={[1.0, 0.006, 4.8]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[42, 1.8]} />
          <meshStandardMaterial color={sur.walkwayLane} roughness={0.8} />
        </mesh>
        {/* Yellow Safety Boundary Stripes */}
        {[-0.88, 0.88].map((zy, i) => (
          <mesh key={`wb-${i}`} position={[0, 0.002, zy]}>
            <boxGeometry args={[42, 0.004, 0.06]} />
            <meshBasicMaterial color={sur.safetyYellow} />
          </mesh>
        ))}
        {/* Dashed Center Directional Guide */}
        {Array.from({ length: 14 }).map((_, i) => (
          <mesh key={`dash-${i}`} position={[-19.5 + i * 3.0, 0.002, 0]}>
            <boxGeometry args={[1.5, 0.004, 0.05]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>

      {/* Directional Flow Arrows on Walkway */}
      {[-12.0, -4.0, 4.0, 12.0].map((fx, idx) => (
        <group key={`walk-arrow-${idx}`} position={[fx, 0.008, 4.8]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
          <mesh>
            <coneGeometry args={[0.2, 0.4, 3]} />
            <meshBasicMaterial color={sur.safetyYellow} />
          </mesh>
        </group>
      ))}

      {/* ── 3. Equipment Plinths / Bunds (Raised Concrete Containment Pads) ── */}
      {/* Unit 1: Feed Line Plinth */}
      <group position={[-10.5, 0.06, 0.5]}>
        <mesh>
          <boxGeometry args={[6.8, 0.12, 2.4]} />
          <meshStandardMaterial color={sur.plinths} roughness={0.85} metalness={0.15} />
        </mesh>
        {/* Safety Curb Edge */}
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[6.84, 0.02, 2.44]} />
          <meshBasicMaterial color={sur.safetyYellow} wireframe />
        </mesh>
      </group>

      {/* Unit 2: Fluidized Bed Gasifier & Blower Heavy Plinth */}
      <group position={[-4.5, 0.06, -0.1]}>
        <mesh>
          <boxGeometry args={[4.6, 0.12, 3.8]} />
          <meshStandardMaterial color={sur.plinths} roughness={0.85} metalness={0.15} />
        </mesh>
        {/* Gasifier Thermal Hazard Zone Octagon Border */}
        <mesh position={[0, 0.065, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.0, 2.12, 8]} />
          <meshBasicMaterial color={sur.safetyYellow} />
        </mesh>
      </group>

      {/* Auxiliary: Cyclone Separator Circular Plinth */}
      <group position={[-2.2, 0.06, -2.4]}>
        <mesh>
          <cylinderGeometry args={[1.1, 1.15, 0.12, 24]} />
          <meshStandardMaterial color={sur.plinths} roughness={0.85} metalness={0.15} />
        </mesh>
      </group>

      {/* Unit 3: HRSG Boiler & Feed Pump Plinth */}
      <group position={[3.2, 0.06, 0.2]}>
        <mesh>
          <boxGeometry args={[4.8, 0.12, 3.2]} />
          <meshStandardMaterial color={sur.plinths} roughness={0.85} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.065, 0]}>
          <boxGeometry args={[4.84, 0.015, 3.24]} />
          <meshBasicMaterial color={sur.safetyYellow} wireframe />
        </mesh>
      </group>

      {/* Auxiliary: Flue Gas Exhaust Stack Plinth */}
      <group position={[6.0, 0.06, -3.2]}>
        <mesh>
          <cylinderGeometry args={[1.3, 1.35, 0.12, 24]} />
          <meshStandardMaterial color={sur.plinths} roughness={0.85} metalness={0.15} />
        </mesh>
      </group>

      {/* Unit 4: Steam Turbine & Alternator Plinth */}
      <group position={[9.4, 0.06, 0.0]}>
        <mesh>
          <boxGeometry args={[4.4, 0.12, 2.4]} />
          <meshStandardMaterial color={sur.plinths} roughness={0.85} metalness={0.15} />
        </mesh>
        {/* Rotating Machinery Exclusion Zone */}
        <mesh position={[0, 0.065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.0, 2.12, 24]} />
          <meshBasicMaterial color={p.equipment.turbineBlades} />
        </mesh>
      </group>

      {/* Unit 5: Heat Exchanger Plinth */}
      <group position={[14.4, 0.06, 0.0]}>
        <mesh>
          <boxGeometry args={[3.8, 0.12, 2.4]} />
          <meshStandardMaterial color={sur.plinths} roughness={0.85} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.065, 0]}>
          <boxGeometry args={[3.84, 0.015, 2.44]} />
          <meshBasicMaterial color={p.equipment.hexAccents} wireframe />
        </mesh>
      </group>

      {/* ── 4. Soft Contact Shadows (Baked Low-Cost PBR Ambient Shadowing) ── */}
      <group position={[0, 0.003, 0]}>
        {[
          { x: -10.5, z: 0.5, sx: 7.4, sz: 3.0 },
          { x: -4.5, z: -0.1, sx: 5.2, sz: 4.4 },
          { x: 3.2, z: 0.2, sx: 5.4, sz: 3.8 },
          { x: 9.4, z: 0.0, sx: 5.0, sz: 3.0 },
          { x: 14.4, z: 0.0, sx: 4.4, sz: 3.0 },
          { x: -15.0, z: -2.2, sx: 4.2, sz: 3.4 },
          { x: 0.6, z: -3.0, sx: 2.8, sz: 2.8 },
        ].map((sh, idx) => (
          <mesh key={`shadow-${idx}`} position={[sh.x, 0, sh.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[sh.sx, sh.sz]} />
            <meshBasicMaterial
              color={sur.contactShadow}
              transparent
              opacity={sur.shadowOpacity}
            />
          </mesh>
        ))}
      </group>

      {/* ── 5. Perimeter Safety Handrailing / Fence ── */}
      <group position={[1.0, 0, 0]}>
        {/* Rear Boundary Railing (Z = -4.5) */}
        <group position={[0, 0, -4.5]}>
          {/* Top Rail */}
          <mesh position={[0, 1.05, 0]}>
            <boxGeometry args={[42, 0.04, 0.04]} />
            <meshStandardMaterial color={sur.perimeterFence} metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Mid Rail */}
          <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[42, 0.03, 0.03]} />
            <meshStandardMaterial color={sur.perimeterFence} metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Stanchion Posts */}
          {Array.from({ length: 15 }).map((_, i) => (
            <mesh key={`post-r-${i}`} position={[-20 + i * 2.85, 0.55, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 1.1, 8]} />
              <meshStandardMaterial color={sur.perimeterFence} metalness={0.6} roughness={0.3} />
            </mesh>
          ))}
        </group>

        {/* Lateral Side Railings (X = -20 and X = 20) */}
        {[-20, 20].map((lx, li) => (
          <group key={`side-rail-${li}`} position={[lx, 0, 0.5]}>
            <mesh position={[0, 1.05, 0]}>
              <boxGeometry args={[0.04, 0.04, 10]} />
              <meshStandardMaterial color={sur.perimeterFence} metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.55, 0]}>
              <boxGeometry args={[0.03, 0.03, 10]} />
              <meshStandardMaterial color={sur.perimeterFence} metalness={0.6} roughness={0.3} />
            </mesh>
            {[-4, -1.5, 1, 3.5].map((sz, si) => (
              <mesh key={`sp-${si}`} position={[0, 0.55, sz]}>
                <cylinderGeometry args={[0.025, 0.025, 1.1, 8]} />
                <meshStandardMaterial color={sur.perimeterFence} metalness={0.6} roughness={0.3} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* ── 6. Facility Architectural Back Wall & Industrial Luminaires ── */}
      <group position={[1.0, 4.0, -5.2]}>
        {/* Main Wall Panels */}
        <mesh>
          <planeGeometry args={[44, 8.2]} />
          <meshStandardMaterial color={sur.backWallPanel} roughness={0.9} metalness={0.1} />
        </mesh>
        {/* Vertical Acoustic Battens / Columns */}
        {[-20, -16, -12, -8, -4, 0, 4, 8, 12, 16, 20].map((bx, bi) => (
          <mesh key={`wb-${bi}`} position={[bx, 0, 0.02]}>
            <boxGeometry args={[0.08, 8.18, 0.04]} />
            <meshStandardMaterial color={sur.backWallBattens} metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
        {/* Downward Luminaire Fixtures */}
        {[-14, -7, 0, 7, 14].map((lx, li) => (
          <group key={`lum-${li}`} position={[lx, 3.6, 0.2]}>
            <mesh>
              <boxGeometry args={[0.9, 0.12, 0.22]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, -0.06, 0]}>
              <boxGeometry args={[0.8, 0.02, 0.16]} />
              <meshBasicMaterial color="#e0f2fe" />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── 7. Static Props: Control Cabin & Feedwater Storage Tank ── */}
      {/* Operator Control Cabin (MCC Telemetry Room) */}
      <group
        position={[-15.0, 1.35, -2.2]}
        onClick={(e) => {
          e.stopPropagation()
          onSelectComponent?.('control_cabin')
        }}
      >
        {/* Cabin Container Enclosure */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[3.4, 2.5, 2.4]} />
          <meshStandardMaterial color={sur.controlCabin} metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Flat Roof Fascia with Overhang */}
        <mesh position={[0, 1.3, 0]}>
          <boxGeometry args={[3.6, 0.12, 2.6]} />
          <meshStandardMaterial color={sur.controlCabinRoof} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Glass Observation Window (Facing Plant Floor) */}
        <mesh position={[0, 0.2, 1.21]}>
          <planeGeometry args={[2.4, 1.1]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.35} roughness={0.1} />
        </mesh>
        {/* Cabin Entrance Door */}
        <mesh position={[1.3, -0.3, 1.21]}>
          <planeGeometry args={[0.65, 1.8]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Roof HVAC Chiller Unit */}
        <mesh position={[-0.8, 1.55, 0]}>
          <boxGeometry args={[0.9, 0.45, 0.8]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* Static Prop 2: Feedwater Storage / Buffer Surge Tank */}
      <group
        position={[0.6, 1.6, -3.0]}
        onClick={(e) => {
          e.stopPropagation()
          onSelectComponent?.('buffer_tank')
        }}
      >
        {/* Tank Main Cylindrical Shell */}
        <mesh>
          <cylinderGeometry args={[0.85, 0.85, 2.9, 24]} />
          <meshStandardMaterial color={sur.waterTank} metalness={0.75} roughness={0.25} />
        </mesh>
        {/* Dished Top Head */}
        <mesh position={[0, 1.45, 0]}>
          <sphereGeometry args={[0.85, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={sur.waterTank} metalness={0.75} roughness={0.25} />
        </mesh>
        {/* Tank Structural Saddle Skids */}
        {[-0.6, 0.6].map((sx, idx) => (
          <mesh key={`tsk-${idx}`} position={[sx, -1.45, 0]}>
            <boxGeometry args={[0.15, 0.25, 1.6]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
        {/* Level Sight Glass on Front */}
        <mesh position={[0, 0, 0.86]}>
          <cylinderGeometry args={[0.025, 0.025, 2.0, 8]} />
          <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.5} transparent opacity={0.6} />
        </mesh>
      </group>

      {/* ── 8. Elevated Pipe Racks & Cable Trays Connecting Units ── */}
      {/* Pipe Bridge Bento Cross-Beams connecting main process headers */}
      {[-2.2, 5.58, 11.2].map((bx, bi) => (
        <group key={`pr-bent-${bi}`} position={[bx, 1.8, -0.2]}>
          {/* Vertical H-Columns */}
          {[-0.8, 0.8].map((colZ, ci) => (
            <mesh key={`col-${ci}`} position={[0, 0, colZ]}>
              <boxGeometry args={[0.1, 3.6, 0.1]} />
              <meshStandardMaterial color={sur.pipeRackBeams} metalness={0.8} roughness={0.25} />
            </mesh>
          ))}
          {/* Top Cross-Beam Saddle */}
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[0.12, 0.12, 1.9]} />
            <meshStandardMaterial color={sur.pipeRackBeams} metalness={0.8} roughness={0.25} />
          </mesh>
          {/* Mid Cross-Beam */}
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.1, 0.1, 1.9]} />
            <meshStandardMaterial color={sur.pipeRackBeams} metalness={0.8} roughness={0.25} />
          </mesh>
          {/* Cable Tray Segment running longitudinally */}
          <mesh position={[0, 1.9, 0.6]}>
            <boxGeometry args={[1.2, 0.06, 0.32]} />
            <meshStandardMaterial color={sur.cableTray} wireframe />
          </mesh>
        </group>
      ))}
    </group>
  )
}
