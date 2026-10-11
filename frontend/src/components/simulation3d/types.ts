import type { SimulationResult } from '../../types'

export type CameraPreset = 'overview' | 'gasifier' | 'steam_cycle' | 'feed_line'

export interface CameraPresetConfig {
  name: string
  label: string
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  description: string
}

export const CAMERA_PRESETS: Record<CameraPreset, CameraPresetConfig> = {
  overview: {
    name: 'overview',
    label: 'Overview',
    position: [1.0, 7.5, 19.5],
    target: [1.0, 2.2, 0.0],
    fov: 42,
    description: 'Complete plant overview from sorting intake to district CHP export',
  },
  gasifier: {
    name: 'gasifier',
    label: 'Gasifier',
    position: [-4.5, 3.4, 8.8],
    target: [-4.5, 2.2, 0.0],
    fov: 38,
    description: 'Bubbling fluidized bed reactor, refractory cutaway, air distributor & plenum',
  },
  steam_cycle: {
    name: 'steam_cycle',
    label: 'Steam cycle',
    position: [6.5, 4.2, 11.0],
    target: [6.5, 2.0, 0.0],
    fov: 38,
    description: 'HRSG boiler with tube bundle cutaway, Rankine turbine rotor & condenser',
  },
  feed_line: {
    name: 'feed_line',
    label: 'Feed line',
    position: [-10.2, 3.2, 7.8],
    target: [-10.2, 1.4, 0.5],
    fov: 36,
    description: 'Conveyor intake, AI optical scanner, enclosed chute & screw feed auger',
  },
}

export interface PlantSceneProps {
  data: SimulationResult | null
  running: boolean
  paused: boolean
  reducedMotion: boolean
  cameraPreset: CameraPreset
  onSelectComponent: (comp: string) => void
  selectedComponent: string | null
}
