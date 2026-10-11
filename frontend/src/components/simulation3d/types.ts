import type { SimulationResult } from '../../types'

export type CameraPreset =
  | 'overview'
  | 'feed_line'
  | 'gasifier'
  | 'boiler'
  | 'turbine'
  | 'heat_exchanger'

export interface CameraPresetConfig {
  name: CameraPreset
  label: string
  unitNumber?: number
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
    description: 'Full plant overview from feed intake to district heat export',
  },
  feed_line: {
    name: 'feed_line',
    label: 'Feed line',
    unitNumber: 1,
    position: [-10.2, 3.2, 7.8],
    target: [-10.2, 1.4, 0.5],
    fov: 36,
    description: 'Waste sorting conveyor, optical scanner & sealed screw feeder',
  },
  gasifier: {
    name: 'gasifier',
    label: 'Gasifier',
    unitNumber: 2,
    position: [-4.5, 3.6, 8.8],
    target: [-4.5, 2.2, 0.0],
    fov: 38,
    description: 'Fluidized bed gasifier, terracotta refractory, distributor & plenum',
  },
  boiler: {
    name: 'boiler',
    label: 'Boiler',
    unitNumber: 3,
    position: [3.0, 3.6, 8.4],
    target: [3.0, 1.8, -0.3],
    fov: 38,
    description: 'HRSG steam boiler, teal pressure vessel, tube bundles & drum',
  },
  turbine: {
    name: 'turbine',
    label: 'Turbine',
    unitNumber: 4,
    position: [9.4, 3.4, 8.2],
    target: [9.4, 1.8, 0.0],
    fov: 38,
    description: 'Steam turbine rotor, flexible shaft coupling & synchronous generator',
  },
  heat_exchanger: {
    name: 'heat_exchanger',
    label: 'Heat exchanger',
    unitNumber: 5,
    position: [14.4, 3.4, 8.2],
    target: [14.4, 1.8, 0.0],
    fov: 38,
    description: 'District heating condenser, supply (70 °C) & return water headers',
  },
}

export interface PlantSceneProps {
  data: SimulationResult | null
  running: boolean
  paused: boolean
  reducedMotion: boolean
  cameraPreset: CameraPreset
  theme: 'light' | 'dark'
  onSelectComponent: (comp: string | null) => void
  selectedComponent: string | null
}
