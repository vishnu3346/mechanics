/**
 * Industrial Color Palette & Material Tokens for 3D Plant Process Simulator
 * =========================================================================
 * Provides WCAG-compliant high-contrast equipment colors, pipe coding,
 * floor materials, and surroundings for both Dark and Light themes.
 *
 * Industrial standards referenced:
 * - ASME A13.1 / DIN 2403 for industrial piping color codes
 * - High-contrast refractory, pressure vessel, and turbomachinery coating standards
 * - WCAG relative luminance contrast >= 3.0:1 for equipment vs background in both themes
 */

export interface ThemePalette {
  theme: 'light' | 'dark'
  background: string
  fog: string
  lighting: {
    ambientColor: string
    ambientIntensity: number
    sunColor: string
    sunIntensity: number
    sunPosition: [number, number, number]
    rimColor: string
    rimIntensity: number
    rimPosition: [number, number, number]
    fillIntensity: number
  }
  equipment: {
    // Gasifier (Refractory shell warm terracotta/orange with steel bands)
    gasifierShell: string
    gasifierBands: string
    gasifierLiner: string
    gasifierLegs: string
    gasifierObservationGlass: string
    gasifierBedGlowCold: string
    gasifierBedGlowNormal: string
    gasifierBedGlowHot: string

    // Boiler (HRSG Teal/Green)
    boilerShell: string
    boilerDishedHeads: string
    boilerBands: string
    boilerSaddle: string
    boilerTubes: string

    // Turbine & Generator (Turbine blue with silver casing, generator dark blue)
    turbineCasing: string
    turbineBlades: string
    turbineShaft: string
    generatorCasing: string
    generatorRibs: string
    generatorExciter: string

    // Heat Exchanger (Light steel with blue accents)
    hexShell: string
    hexDishedHeads: string
    hexBands: string
    hexTubeSheet: string
    hexAccents: string

    // Auxiliaries
    conveyorStructure: string
    conveyorBelt: string
    blowerHousing: string
    blowerMotor: string
    pumpCasing: string
    pumpMotor: string
    cycloneBody: string
    stackBody: string
    stackBandsRed: string
    stackBandsWhite: string
  }
  pipes: {
    syngas: string        // Yellow-orange
    syngasFlange: string
    steam: string         // White/silver
    steamFlange: string
    districtSupply: string // Blue
    districtReturn: string // Cyan
    combustionAir: string  // Light blue
    flueGas: string        // Slate duct
  }
  surroundings: {
    floorSlab: string
    floorRoughness: number
    floorMetalness: number
    expansionJoints: string
    walkwayLane: string
    walkwayBorder: string
    safetyYellow: string
    hazardStripeBlack: string
    plinths: string
    plinthCurb: string
    contactShadow: string
    shadowOpacity: number
    perimeterFence: string
    backWallPanel: string
    backWallBattens: string
    pipeRackBeams: string
    cableTray: string
    controlCabin: string
    controlCabinRoof: string
    waterTank: string
  }
}

export const DARK_PALETTE: ThemePalette = {
  theme: 'dark',
  background: '#1b2333', // mid-dark slate (not near-black)
  fog: '#1b2333',
  lighting: {
    ambientColor: '#cbd5e1',
    ambientIntensity: 0.65,
    sunColor: '#ffffff',
    sunIntensity: 1.25,
    sunPosition: [14, 22, 16],
    rimColor: '#38bdf8', // crisp industrial rim light
    rimIntensity: 0.85,
    rimPosition: [-16, 14, -12],
    fillIntensity: 0.4,
  },
  equipment: {
    gasifierShell: '#d96528', // warm terracotta/orange
    gasifierBands: '#94a3b8', // structural steel bands
    gasifierLiner: '#c2410c',
    gasifierLegs: '#334155',
    gasifierObservationGlass: '#38bdf8',
    gasifierBedGlowCold: '#d97706',
    gasifierBedGlowNormal: '#f59e0b',
    gasifierBedGlowHot: '#ef4444',

    boilerShell: '#10b981', // industrial teal/green
    boilerDishedHeads: '#059669',
    boilerBands: '#6ee7b7',
    boilerSaddle: '#334155',
    boilerTubes: '#94a3b8',

    turbineCasing: '#cbd5e1', // silver casing
    turbineBlades: '#38bdf8', // turbine blue rotor
    turbineShaft: '#f59e0b',
    generatorCasing: '#60a5fa', // dark blue generator housing
    generatorRibs: '#3b82f6',
    generatorExciter: '#10b981',

    hexShell: '#cbd5e1', // light steel
    hexDishedHeads: '#94a3b8',
    hexBands: '#64748b',
    hexTubeSheet: '#64748b',
    hexAccents: '#38bdf8', // blue accents

    conveyorStructure: '#475569',
    conveyorBelt: '#1e293b',
    blowerHousing: '#0284c7',
    blowerMotor: '#2563eb',
    pumpCasing: '#0284c7',
    pumpMotor: '#2563eb',
    cycloneBody: '#475569',
    stackBody: '#64748b',
    stackBandsRed: '#ef4444',
    stackBandsWhite: '#f8fafc',
  },
  pipes: {
    syngas: '#fbbf24', // yellow-orange
    syngasFlange: '#d97706',
    steam: '#f8fafc', // white/silver
    steamFlange: '#cbd5e1',
    districtSupply: '#60a5fa', // district water blue
    districtReturn: '#22d3ee', // return water cyan
    combustionAir: '#7dd3fc', // combustion air light blue
    flueGas: '#64748b',
  },
  surroundings: {
    floorSlab: '#252f44', // realistic concrete slab
    floorRoughness: 0.88,
    floorMetalness: 0.12,
    expansionJoints: '#141a27', // dark expansion joint seams
    walkwayLane: '#1e3a5f',
    walkwayBorder: '#38bdf8',
    safetyYellow: '#eab308',
    hazardStripeBlack: '#0f172a',
    plinths: '#1e293b', // concrete equipment plinths
    plinthCurb: '#eab308',
    contactShadow: '#090d16',
    shadowOpacity: 0.55,
    perimeterFence: '#ca8a04',
    backWallPanel: '#182030',
    backWallBattens: '#334155',
    pipeRackBeams: '#334155',
    cableTray: '#64748b',
    controlCabin: '#1e293b',
    controlCabinRoof: '#0f172a',
    waterTank: '#475569',
  },
}

export const LIGHT_PALETTE: ThemePalette = {
  theme: 'light',
  background: '#dce4ee', // light grey-blue
  fog: '#dce4ee',
  lighting: {
    ambientColor: '#f1f5f9',
    ambientIntensity: 0.95,
    sunColor: '#ffffff',
    sunIntensity: 1.45,
    sunPosition: [14, 22, 16],
    rimColor: '#94a3b8',
    rimIntensity: 0.25,
    rimPosition: [-16, 14, -12],
    fillIntensity: 0.5,
  },
  equipment: {
    gasifierShell: '#9e3f14', // deep saturated terracotta
    gasifierBands: '#334155', // dark steel bands
    gasifierLiner: '#7c2d12',
    gasifierLegs: '#1e293b',
    gasifierObservationGlass: '#0284c7',
    gasifierBedGlowCold: '#b45309',
    gasifierBedGlowNormal: '#ea580c',
    gasifierBedGlowHot: '#dc2626',

    boilerShell: '#065f46', // deep saturated teal/green
    boilerDishedHeads: '#047857',
    boilerBands: '#064e3b',
    boilerSaddle: '#1e293b',
    boilerTubes: '#475569',

    turbineCasing: '#475569', // dark silver casing
    turbineBlades: '#1d4ed8', // deep turbine blue rotor
    turbineShaft: '#b45309',
    generatorCasing: '#1e3a8a', // deep blue generator housing
    generatorRibs: '#172554',
    generatorExciter: '#065f46',

    hexShell: '#334155', // dark steel
    hexDishedHeads: '#475569',
    hexBands: '#1e293b',
    hexTubeSheet: '#475569',
    hexAccents: '#0284c7', // rich blue accents

    conveyorStructure: '#334155',
    conveyorBelt: '#0f172a',
    blowerHousing: '#0369a1',
    blowerMotor: '#1e40af',
    pumpCasing: '#0369a1',
    pumpMotor: '#1e40af',
    cycloneBody: '#334155',
    stackBody: '#475569',
    stackBandsRed: '#b91c1c',
    stackBandsWhite: '#f8fafc',
  },
  pipes: {
    syngas: '#b45309', // deep yellow-orange
    syngasFlange: '#92400e',
    steam: '#475569', // dark silver/steel steam
    steamFlange: '#334155',
    districtSupply: '#1e40af', // deep district water blue
    districtReturn: '#0e7490', // deep return water cyan
    combustionAir: '#0369a1', // deep combustion air blue
    flueGas: '#334155',
  },
  surroundings: {
    floorSlab: '#cbd5e1', // light concrete slab
    floorRoughness: 0.9,
    floorMetalness: 0.08,
    expansionJoints: '#94a3b8', // expansion joint seams
    walkwayLane: '#93c5fd',
    walkwayBorder: '#2563eb',
    safetyYellow: '#ca8a04',
    hazardStripeBlack: '#1e293b',
    plinths: '#94a3b8', // concrete equipment plinths
    plinthCurb: '#ca8a04',
    contactShadow: '#64748b',
    shadowOpacity: 0.42,
    perimeterFence: '#a16207',
    backWallPanel: '#cbd5e1',
    backWallBattens: '#64748b',
    pipeRackBeams: '#475569',
    cableTray: '#475569',
    controlCabin: '#94a3b8',
    controlCabinRoof: '#64748b',
    waterTank: '#64748b',
  },
}

export function getPalette(theme: 'light' | 'dark'): ThemePalette {
  return theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE
}

/**
 * Calculates WCAG relative luminance for an sRGB hex code.
 */
export function getRelativeLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255.0
  const g = parseInt(clean.substring(2, 4), 16) / 255.0
  const b = parseInt(clean.substring(4, 6), 16) / 255.0

  const comp = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

  return 0.2126 * comp(r) + 0.7152 * comp(g) + 0.0722 * comp(b)
}

/**
 * Calculates WCAG-style contrast ratio between two hex colors.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1)
  const l2 = getRelativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Pre-calculated contrast validation table for reporting.
 */
export const CONTRAST_REPORT = [
  { item: 'Gasifier Terracotta Shell', darkHex: DARK_PALETTE.equipment.gasifierShell, darkContrast: getContrastRatio(DARK_PALETTE.equipment.gasifierShell, DARK_PALETTE.background), lightHex: LIGHT_PALETTE.equipment.gasifierShell, lightContrast: getContrastRatio(LIGHT_PALETTE.equipment.gasifierShell, LIGHT_PALETTE.background) },
  { item: 'Gasifier Steel Bands', darkHex: DARK_PALETTE.equipment.gasifierBands, darkContrast: getContrastRatio(DARK_PALETTE.equipment.gasifierBands, DARK_PALETTE.background), lightHex: LIGHT_PALETTE.equipment.gasifierBands, lightContrast: getContrastRatio(LIGHT_PALETTE.equipment.gasifierBands, LIGHT_PALETTE.background) },
  { item: 'Boiler Teal/Green Shell', darkHex: DARK_PALETTE.equipment.boilerShell, darkContrast: getContrastRatio(DARK_PALETTE.equipment.boilerShell, DARK_PALETTE.background), lightHex: LIGHT_PALETTE.equipment.boilerShell, lightContrast: getContrastRatio(LIGHT_PALETTE.equipment.boilerShell, LIGHT_PALETTE.background) },
  { item: 'Turbine Blue Stator', darkHex: DARK_PALETTE.equipment.turbineBlades, darkContrast: getContrastRatio(DARK_PALETTE.equipment.turbineBlades, DARK_PALETTE.background), lightHex: LIGHT_PALETTE.equipment.turbineBlades, lightContrast: getContrastRatio(LIGHT_PALETTE.equipment.turbineBlades, LIGHT_PALETTE.background) },
  { item: 'Turbine Silver Casing', darkHex: DARK_PALETTE.equipment.turbineCasing, darkContrast: getContrastRatio(DARK_PALETTE.equipment.turbineCasing, DARK_PALETTE.background), lightHex: LIGHT_PALETTE.equipment.turbineCasing, lightContrast: getContrastRatio(LIGHT_PALETTE.equipment.turbineCasing, LIGHT_PALETTE.background) },
  { item: 'Generator Dark Blue Casing', darkHex: DARK_PALETTE.equipment.generatorCasing, darkContrast: getContrastRatio(DARK_PALETTE.equipment.generatorCasing, DARK_PALETTE.background), lightHex: LIGHT_PALETTE.equipment.generatorCasing, lightContrast: getContrastRatio(LIGHT_PALETTE.equipment.generatorCasing, LIGHT_PALETTE.background) },
  { item: 'Heat Exchanger Light Steel', darkHex: DARK_PALETTE.equipment.hexShell, darkContrast: getContrastRatio(DARK_PALETTE.equipment.hexShell, DARK_PALETTE.background), lightHex: LIGHT_PALETTE.equipment.hexShell, lightContrast: getContrastRatio(LIGHT_PALETTE.equipment.hexShell, LIGHT_PALETTE.background) },
  { item: 'Syngas Pipe (Yellow-Orange)', darkHex: DARK_PALETTE.pipes.syngas, darkContrast: getContrastRatio(DARK_PALETTE.pipes.syngas, DARK_PALETTE.background), lightHex: LIGHT_PALETTE.pipes.syngas, lightContrast: getContrastRatio(LIGHT_PALETTE.pipes.syngas, LIGHT_PALETTE.background) },
  { item: 'Steam Pipe (White/Silver)', darkHex: DARK_PALETTE.pipes.steam, darkContrast: getContrastRatio(DARK_PALETTE.pipes.steam, DARK_PALETTE.background), lightHex: LIGHT_PALETTE.pipes.steam, lightContrast: getContrastRatio(LIGHT_PALETTE.pipes.steam, LIGHT_PALETTE.background) },
  { item: 'District Water Pipe (Blue)', darkHex: DARK_PALETTE.pipes.districtSupply, darkContrast: getContrastRatio(DARK_PALETTE.pipes.districtSupply, DARK_PALETTE.background), lightHex: LIGHT_PALETTE.pipes.districtSupply, lightContrast: getContrastRatio(LIGHT_PALETTE.pipes.districtSupply, LIGHT_PALETTE.background) },
  { item: 'Return Water Pipe (Cyan)', darkHex: DARK_PALETTE.pipes.districtReturn, darkContrast: getContrastRatio(DARK_PALETTE.pipes.districtReturn, DARK_PALETTE.background), lightHex: LIGHT_PALETTE.pipes.districtReturn, lightContrast: getContrastRatio(LIGHT_PALETTE.pipes.districtReturn, LIGHT_PALETTE.background) },
  { item: 'Combustion Air Pipe (Light Blue)', darkHex: DARK_PALETTE.pipes.combustionAir, darkContrast: getContrastRatio(DARK_PALETTE.pipes.combustionAir, DARK_PALETTE.background), lightHex: LIGHT_PALETTE.pipes.combustionAir, lightContrast: getContrastRatio(LIGHT_PALETTE.pipes.combustionAir, LIGHT_PALETTE.background) },
]
