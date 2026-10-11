import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { PlantSceneProps } from './types'
import { CameraController } from './CameraController'
import { PlantInfrastructure } from './PlantInfrastructure'
import { ConveyorFeedLine } from './ConveyorFeedLine'
import { AirBlower } from './AirBlower'
import { GasifierUnit } from './GasifierUnit'
import { CycloneAndStack } from './CycloneAndStack'
import { BoilerUnit } from './BoilerUnit'
import { FeedPump } from './FeedPump'
import { TurbineUnit } from './TurbineUnit'
import { HeatExchangerUnit } from './HeatExchangerUnit'
import { ProcessPipes } from './ProcessPipes'

export function PlantScene({
  data,
  running,
  paused,
  reducedMotion,
  cameraPreset,
  onSelectComponent,
  selectedComponent,
}: PlantSceneProps) {
  const controlsRef = useRef<any>(null)
  const [lowQuality, setLowQuality] = useState(false)
  const frameTimes = useRef<number[]>([])

  // Adaptive Quality Monitor: tracks rolling FPS, activates lowDetail mode if laptop fps drops < 42
  useFrame((_, delta) => {
    if (!running || paused) return
    const fps = 1 / Math.max(0.001, delta)
    frameTimes.current.push(fps)
    if (frameTimes.current.length > 90) {
      frameTimes.current.shift()
      const avgFps = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length
      if (avgFps < 42 && !lowQuality) {
        setLowQuality(true)
      } else if (avgFps > 55 && lowQuality) {
        setLowQuality(false)
      }
    }
  })

  // Telemetry & Physics Data Extraction
  const temp = data?.parameters?.reactor_temp_c ?? 850
  const wasteFeedKgH = data?.parameters?.waste_feed_kg_h ?? 500
  const plasticRatio = data?.parameters?.plastic_ratio ?? 0.25
  const airflowM3H = data?.parameters?.airflow_m3_h ?? 661.0
  const power = data?.turbine?.net_electrical_power_kw ?? (data?.turbine?.electrical_power_kw ?? 178.6)
  const steamFlow = data?.steam_cycle?.steam_flow_kg_h ?? 1547
  const recoveredHeat = data?.heat_exchanger?.recovered_heat_kw ?? 863.1

  // Dynamic Fluidization Physics
  const u0_over_umf_eff = data?.fluidization?.u0_over_umf_eff ?? (data?.u0_over_umf_eff ?? 10.05)
  const u0_over_ut = data?.fluidization?.u0_over_ut ?? (data?.u0_over_ut ?? 0.20)
  const d_eff_m = data?.fluidization?.d_eff_m ?? 0.0004
  const u0_m_s = data?.fluidization?.u0_m_s ?? 0.567
  const umf_eff_m_s = data?.fluidization?.umf_effective_m_s ?? 0.056

  // kW Thermal & Electrical Energy Balances for scaled pipe flow
  const syngasKw = data?.gasification?.thermal_energy_kw ?? 1490.4
  const steamKw = data?.steam_cycle?.boiler_duty_kw ?? 1266.8
  const condenserKw = data?.heat_exchanger?.condenser_heat_kw ?? 1068.9

  return (
    <>
      <color attach="background" args={['#050811']} />
      <fog attach="fog" args={['#050811', 22, 54]} />

      <PerspectiveCamera makeDefault position={[1.0, 7.5, 19.5]} fov={42} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={42}
        maxPolarAngle={Math.PI / 2 - 0.04} // Prevent camera going underneath the ground
      />

      <CameraController preset={cameraPreset} controlsRef={controlsRef} />

      {/* ── Realistic PBR Industrial Lighting ─────────────────────── */}
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[14, 22, 16]}
        intensity={1.25}
        castShadow={!lowQuality}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
      />
      <directionalLight position={[-12, 16, -10]} intensity={0.45} />

      {/* Local Equipment Accent Point Lights */}
      <pointLight position={[-4.5, 3.8, 2.5]} intensity={1.4} color="#f59e0b" distance={14} />
      <pointLight position={[3.0, 3.8, 2.5]} intensity={1.1} color="#38bdf8" distance={12} />
      <pointLight position={[9.4, 3.0, 2.5]} intensity={1.1} color="#60a5fa" distance={12} />
      <pointLight position={[14.4, 2.8, 2.5]} intensity={1.0} color="#34d399" distance={12} />

      {/* ── Industrial Facility Structure & Equipment ─────────────── */}
      <PlantInfrastructure />

      <ConveyorFeedLine
        wasteFeedKgH={wasteFeedKgH}
        plasticRatio={plasticRatio}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
        onSelectComponent={onSelectComponent}
        selected={selectedComponent === 'feed_line'}
      />

      <AirBlower
        airflowM3H={airflowM3H}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
        onSelectComponent={onSelectComponent}
        selected={selectedComponent === 'gasifier'}
      />

      <GasifierUnit
        temperature={temp}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
        u0_over_umf_eff={u0_over_umf_eff}
        u0_over_ut={u0_over_ut}
        d_eff_m={d_eff_m}
        u0_m_s={u0_m_s}
        umf_eff_m_s={umf_eff_m_s}
        lowDetail={lowQuality}
        onSelectComponent={onSelectComponent}
        selected={selectedComponent === 'gasifier'}
      />

      <CycloneAndStack
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
        onSelectComponent={onSelectComponent}
      />

      <BoilerUnit
        steamFlow={steamFlow}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
        onSelectComponent={onSelectComponent}
        selected={selectedComponent === 'boiler'}
      />

      <FeedPump
        onSelectComponent={onSelectComponent}
        selected={selectedComponent === 'boiler'}
      />

      <TurbineUnit
        powerKw={power}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
        onSelectComponent={onSelectComponent}
        selected={selectedComponent === 'turbine'}
      />

      <HeatExchangerUnit
        recoveredHeatKw={recoveredHeat}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
        onSelectComponent={onSelectComponent}
        selected={selectedComponent === 'heat_exchanger'}
      />

      <ProcessPipes
        syngasKw={syngasKw}
        steamKw={steamKw}
        condenserKw={condenserKw}
        running={running}
        paused={paused}
        reducedMotion={reducedMotion}
      />
    </>
  )
}
