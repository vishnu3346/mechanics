import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { UnitTag, SelectionOutlineRing } from './Labels'

interface ParcelData {
  id: number
  progress: number // 0 to 1 along full feed trajectory
  speed: number
  isPlastic: boolean
  color: string
  shape: 'box' | 'cylinder' | 'sphere'
  size: [number, number, number]
  lateralOffset: number
  rotationOffset: number
  className: string
  confidence: number
}

interface ConveyorFeedLineProps {
  wasteFeedKgH: number
  plasticRatio: number
  running: boolean
  paused: boolean
  reducedMotion: boolean
  theme?: 'light' | 'dark'
  onSelectComponent?: (comp: string) => void
  selected?: boolean
}

// Color palettes
const PLASTIC_PALETTE = [
  { color: '#06b6d4', name: 'PLASTIC #02 HDPE' },
  { color: '#3b82f6', name: 'PLASTIC #05 PP' },
  { color: '#f59e0b', name: 'PLASTIC #01 PET' },
  { color: '#ec4899', name: 'POLYMER TUBING' },
]

const ORGANIC_PALETTE = [
  { color: '#84cc16', name: 'BIOMED CELLULOSE' },
  { color: '#d97706', name: 'KRAFT PAPER/BOARD' },
  { color: '#94a3b8', name: 'CLINICAL GAUZE' },
  { color: '#78350f', name: 'ORGANIC RESIDUE' },
]

export function ConveyorFeedLine({
  wasteFeedKgH,
  plasticRatio,
  running,
  paused,
  reducedMotion,
  onSelectComponent,
  selected,
}: ConveyorFeedLineProps) {
  const parcelsRef = useRef<ParcelData[]>([])
  const nextId = useRef(1)
  const spawnTimer = useRef(0)
  const scannerActiveRef = useRef(false)
  const activeDetectedParcelRef = useRef<ParcelData | null>(null)

  // Belt texture offset ref
  const beltMeshRef = useRef<THREE.Mesh>(null)
  const augerScrewRef = useRef<THREE.Group>(null)
  const scanConeMeshRef = useRef<THREE.Mesh>(null)
  const scanLaserRef = useRef<THREE.Mesh>(null)

  // Force re-render for UI tags if scanner state changes
  const [, setScanTick] = useState(0)

  // Trajectory Waypoints
  // Belt start: x = -13.2, y = 0.88, z = 0.5
  // Belt end / chute top: x = -7.8, y = 0.88, z = 0.5
  // Chute bottom / hopper entry: x = -6.5, y = 0.88, z = 0.15
  // Screw feeder into gasifier: x = -5.5, y = 1.30, z = 0.00
  const BELT_START_X = -13.2
  const BELT_END_X = -7.8
  const BELT_LENGTH = BELT_END_X - BELT_START_X // 5.4 units

  const effectiveKgH = Math.max(50, wasteFeedKgH || 500)
  const effectivePlastic = Math.max(0.05, Math.min(0.95, plasticRatio || 0.25))

  // Spawn interval proportional to kg/h: higher rate = shorter interval
  const spawnIntervalSeconds = Math.max(0.5, Math.min(2.4, (500 / effectiveKgH) * 1.1))

  useFrame((_, delta) => {
    if (!running || paused) return
    const activeDelta = reducedMotion ? delta * 0.5 : delta

    // 1. Texture / belt scrolling
    if (beltMeshRef.current) {
      const mat = beltMeshRef.current.material as THREE.MeshStandardMaterial
      if (mat.map) mat.map.offset.x += activeDelta * 0.4
    }

    // 2. Rotate screw feeder auger
    if (augerScrewRef.current) {
      augerScrewRef.current.rotation.x += activeDelta * 4.0
    }

    // 3. Spawning parcels
    spawnTimer.current += activeDelta
    if (spawnTimer.current >= spawnIntervalSeconds) {
      spawnTimer.current = 0

      const isPlastic = Math.random() < effectivePlastic
      const sample = isPlastic
        ? PLASTIC_PALETTE[Math.floor(Math.random() * PLASTIC_PALETTE.length)]
        : ORGANIC_PALETTE[Math.floor(Math.random() * ORGANIC_PALETTE.length)]

      const shapes: Array<'box' | 'cylinder' | 'sphere'> = ['box', 'cylinder', 'sphere']
      const shape = shapes[Math.floor(Math.random() * shapes.length)]

      parcelsRef.current.push({
        id: nextId.current++,
        progress: 0,
        speed: 0.12, // Progress units per second
        isPlastic,
        color: sample.color,
        shape,
        size: [
          0.22 + Math.random() * 0.1,
          0.16 + Math.random() * 0.08,
          0.2 + Math.random() * 0.1,
        ],
        lateralOffset: (Math.random() - 0.5) * 0.45,
        rotationOffset: Math.random() * Math.PI,
        className: sample.name,
        confidence: Math.round(88 + Math.random() * 11),
      })
    }

    // 4. Update parcel positions & scan detection
    let detectedParcel: ParcelData | null = null
    const updated: ParcelData[] = []

    for (const p of parcelsRef.current) {
      p.progress += activeDelta * p.speed

      if (p.progress < 1.0) {
        updated.push(p)

        // Evaluate scanner trigger: on belt, progress corresponds to X
        // Scanner is at x = -10.5
        // Progress on belt spans 0 to 0.65
        const beltFraction = p.progress / 0.65
        const currentX = BELT_START_X + beltFraction * BELT_LENGTH
        if (currentX >= -10.9 && currentX <= -10.1) {
          detectedParcel = p
        }
      }
    }
    parcelsRef.current = updated

    // 5. Update scanner visual pulse
    const hasDetected = detectedParcel !== null
    if (hasDetected !== scannerActiveRef.current) {
      scannerActiveRef.current = hasDetected
      activeDetectedParcelRef.current = detectedParcel
      setScanTick((t) => t + 1)
    }

    if (scanConeMeshRef.current) {
      const mat = scanConeMeshRef.current.material as THREE.MeshStandardMaterial
      if (hasDetected) {
        mat.opacity = 0.38 + Math.sin(Date.now() * 0.015) * 0.12
        mat.emissiveIntensity = 0.9
      } else {
        mat.opacity = 0.12
        mat.emissiveIntensity = 0.2
      }
    }
  })

  // Helper to compute parcel 3D position & scale from progress [0, 1]
  const computeParcelTransform = (p: ParcelData) => {
    let x = 0
    let y = 0
    let z = 0
    let scale = 1.0

    if (p.progress <= 0.65) {
      // Phase 1: On Conveyor Belt (-13.2 to -7.8)
      const t = p.progress / 0.65
      x = BELT_START_X + t * BELT_LENGTH
      y = 0.90 + p.size[1] / 2
      z = 0.5 + p.lateralOffset
      scale = 1.0
    } else if (p.progress <= 0.82) {
      // Phase 2: In Enclosed Chute down into Hopper (-7.8 -> -6.5)
      const t = (p.progress - 0.65) / 0.17
      x = THREE.MathUtils.lerp(-7.8, -6.5, t)
      y = THREE.MathUtils.lerp(0.90 + p.size[1] / 2, 0.88, t)
      z = THREE.MathUtils.lerp(0.5 + p.lateralOffset, 0.15, t)
      scale = 1.0 - t * 0.15
    } else {
      // Phase 3: In Screw Feeder entering Gasifier (-6.5 -> -5.5)
      const t = (p.progress - 0.82) / 0.18
      x = THREE.MathUtils.lerp(-6.5, -5.5, t)
      y = THREE.MathUtils.lerp(0.88, 1.30, t)
      z = THREE.MathUtils.lerp(0.15, 0.00, t)
      scale = Math.max(0.001, (1.0 - t) * 0.85) // Shrinks into hopper/gasifier!
    }

    return { x, y, z, scale }
  }

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelectComponent?.('feed_line'); }}>
      {/* Selection Highlight Outline */}
      {selected && (
        <group position={[-10.5, 0, 0.5]}>
          <SelectionOutlineRing radius={2.2} color="#0284c7" />
        </group>
      )}

      {/* ── 1. Conveyor Belt Assembly (Continuous) ──────────────── */}
      <group position={[-10.5, 0.82, 0.5]}>
        {/* Continuous Rubber Belt Top Strand */}
        <mesh ref={beltMeshRef} position={[0, 0, 0]}>
          <boxGeometry args={[5.6, 0.06, 0.9]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.2} />
        </mesh>

        {/* Lower Return Belt Strand */}
        <mesh position={[0, -0.45, 0]}>
          <boxGeometry args={[5.4, 0.04, 0.86]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} metalness={0.15} />
        </mesh>

        {/* Head Pulley (Drive Drum at -7.8) */}
        <mesh position={[2.7, -0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.24, 0.24, 0.92, 16]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Tail Pulley (Return Drum at -13.2) */}
        <mesh position={[-2.7, -0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.24, 0.24, 0.92, 16]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Idler Rollers along top carrying strand */}
        {[-2.0, -1.0, 0.0, 1.0, 2.0].map((rx, idx) => (
          <mesh key={idx} position={[rx, -0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.94, 12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
          </mesh>
        ))}

        {/* Side Guide Skirts (prevent parcel roll-off) */}
        <mesh position={[0, 0.12, 0.48]}>
          <boxGeometry args={[5.6, 0.22, 0.04]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.12, -0.48]}>
          <boxGeometry args={[5.6, 0.22, 0.04]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
        </mesh>

        {/* Electric Gearmotor Drive Unit on Head Pulley */}
        <group position={[2.7, -0.22, 0.65]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.35, 14]} />
            <meshStandardMaterial color="#0284c7" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.22]}>
            <boxGeometry args={[0.22, 0.25, 0.15]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>

        {/* Structural Steel Support Truss Legs */}
        {[-2.4, -0.8, 0.8, 2.4].map((lx, i) => (
          <group key={i} position={[lx, -0.45, 0]}>
            <mesh position={[0, 0, 0.48]}>
              <boxGeometry args={[0.08, 0.74, 0.08]} />
              <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, -0.48]}>
              <boxGeometry args={[0.08, 0.74, 0.08]} />
              <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
            </mesh>
            {/* Cross brace */}
            <mesh position={[0, -0.25, 0]}>
              <boxGeometry args={[0.06, 0.06, 0.96]} />
              <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
            </mesh>
            {/* Base anchor plate */}
            <mesh position={[0, -0.37, 0]}>
              <boxGeometry args={[0.22, 0.04, 1.08]} />
              <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── 2. AI Camera Scanner Gantry ────────────────────────── */}
      <group position={[-10.5, 2.4, 0.5]}>
        {/* Support Arch Straddling the Belt */}
        <mesh position={[0, -0.8, 0.65]}>
          <boxGeometry args={[0.08, 1.8, 0.08]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.8, -0.65]}>
          <boxGeometry args={[0.08, 1.8, 0.08]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.12, 0.08, 1.38]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Optical Sensor Housing Body */}
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[0.42, 0.22, 0.32]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.15} />
        </mesh>
        {/* Dual Lens Ring */}
        <mesh position={[0, -0.17, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.09, 0.06, 16]} />
          <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Status indicator LED */}
        <mesh position={[0.15, -0.02, 0.17]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial
            color={scannerActiveRef.current ? '#22c55e' : '#38bdf8'}
            emissive={scannerActiveRef.current ? '#22c55e' : '#0284c7'}
            emissiveIntensity={1.2}
          />
        </mesh>

        {/* Scan Beam Cone (Volumetric light downwards) */}
        <mesh ref={scanConeMeshRef} position={[0, -0.85, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.65, 1.45, 16, 1, true]} />
          <meshStandardMaterial
            color="#06b6d4"
            emissive="#06b6d4"
            emissiveIntensity={0.3}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Laser Projector Line along belt */}
        <mesh ref={scanLaserRef} position={[0, -1.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 0.85]} />
          <meshBasicMaterial color="#00f2fe" transparent opacity={0.65} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ── 3. Active Moving Parcels & Scanner Detection HUD ────── */}
      {parcelsRef.current.map((p) => {
        const { x, y, z, scale } = computeParcelTransform(p)
        const isScanningNow = activeDetectedParcelRef.current?.id === p.id

        return (
          <group key={p.id} position={[x, y, z]} scale={[scale, scale, scale]}>
            {/* Parcel Geometry */}
            {p.shape === 'box' && (
              <mesh rotation={[0, p.rotationOffset, 0]}>
                <boxGeometry args={p.size} />
                <meshStandardMaterial color={p.color} roughness={0.35} metalness={0.3} />
              </mesh>
            )}
            {p.shape === 'cylinder' && (
              <mesh rotation={[0, p.rotationOffset, Math.PI / 2]}>
                <cylinderGeometry args={[p.size[1] / 2, p.size[1] / 2, p.size[0], 12]} />
                <meshStandardMaterial color={p.color} roughness={0.35} metalness={0.3} />
              </mesh>
            )}
            {p.shape === 'sphere' && (
              <mesh>
                <sphereGeometry args={[p.size[1] / 1.7, 12, 12]} />
                <meshStandardMaterial color={p.color} roughness={0.35} metalness={0.3} />
              </mesh>
            )}

            {/* Glowing YOLO Bounding Box & Class Tag When Under Scanner */}
            {isScanningNow && (
              <group position={[0, 0, 0]}>
                {/* 3D Wireframe Bounding Box Under Active Scanner */}
                <mesh>
                  <boxGeometry args={[p.size[0] * 1.35, p.size[1] * 1.35, p.size[2] * 1.35]} />
                  <meshBasicMaterial color="#38bdf8" wireframe />
                </mesh>
              </group>
            )}
          </group>
        )
      })}

      {/* ── 4. Enclosed Chute (Seamlessly Closes Belt to Hopper Gap) ── */}
      <group position={[-7.15, 0.88, 0.32]} rotation={[0, -Math.PI / 12, -Math.PI / 16]}>
        {/* Chute Shell Housing */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.45, 0.38, 0.52]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Transparent Polycarbonate Front Inspection Window */}
        <mesh position={[0, 0.05, 0.27]}>
          <boxGeometry args={[1.2, 0.24, 0.02]} />
          <meshStandardMaterial
            color="#38bdf8"
            transparent
            opacity={0.35}
            metalness={0.1}
            roughness={0.1}
          />
        </mesh>
      </group>

      {/* ── 5. Feed Hopper & Motorized Screw Feeder (Auger) ──────── */}
      <group position={[-6.2, 0.95, 0.15]}>
        {/* Inverted Conical Feed Hopper Vessel */}
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.55, 0.28, 0.7, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.25} />
        </mesh>
        {/* Hopper Top Flange / Collar */}
        <mesh position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.58, 0.58, 0.06, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
        </mesh>

        {/* Screw Feeder Barrel (Inclined Pipe entering Gasifier Vessel) */}
        <group position={[0.45, -0.05, -0.08]} rotation={[0, -Math.PI / 10, -Math.PI / 7]}>
          <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 1.25, 16]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.25} />
          </mesh>

          {/* Internal Rotating Auger Flighting / Screw */}
          <group ref={augerScrewRef}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.04, 0.04, 1.28, 10]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
            </mesh>
            {[-0.4, -0.2, 0, 0.2, 0.4].map((sx, idx) => (
              <mesh key={idx} position={[sx, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.14, 0.02, 6, 16]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.85} roughness={0.2} />
              </mesh>
            ))}
          </group>

          {/* Auger Drive Motor at outer end */}
          <mesh position={[-0.72, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.14, 0.14, 0.28, 14]} />
            <meshStandardMaterial color="#0284c7" metalness={0.65} roughness={0.3} />
          </mesh>

          {/* Connection Flange to Gasifier Port */}
          <mesh position={[0.62, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.24, 0.24, 0.08, 16]} />
            <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* ── 6. Decluttered Unit Tag (Clean Scene, Details on Click) ── */}
      <UnitTag
        position={[-10.5, 3.2, 0.5]}
        targetPosition={[-10.5, 1.2, 0.5]}
        unitNumber={1}
        name="Feed Line"
        headline={`${wasteFeedKgH.toFixed(0)} kg/h`}
        accentColor="#0284c7"
        selected={selected}
        onClick={() => onSelectComponent?.('feed_line')}
      />
    </group>
  )
}
