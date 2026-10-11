import type { SimulationResult, Scenario, HealthResponse, SystemInfoResponse, HistoryEntry, Detection } from '../types'

export const mockHealth: HealthResponse = {
  status: 'healthy',
  timestamp: new Date().toISOString(),
  anomaly_model_loaded: true,
  yolo_model_loaded: true,
  vit_model_loaded: true,
  version: '1.0.0',
  disclaimer: 'Engineering simulation prototype. Results are model-based approximations and are not a substitute for validated industrial process simulation, CFD, plant commissioning, or safety analysis.',
}

export const mockSystemInfo: SystemInfoResponse = {
  python_version: '3.11.8 (Vercel Serverless Runtime)',
  platform: 'Linux-x86_64-Cloud (Vercel Edge)',
  cuda_available: false,
  anomaly_model_loaded: true,
  yolo_model_loaded: true,
  vit_model_loaded: true,
  history_count: 5,
  disclaimer: 'Engineering simulation prototype. Production telemetry.',
}

export const mockScenarios: Scenario[] = [
  {
    id: 'normal',
    name: 'Nominal Fluidized Operation (850°C, clean bed)',
    description: 'Nominal fluidized bed at 850 °C with clean sand and standard clinical waste feed.',
  },
  {
    id: 'plastic_surge',
    name: 'High Polymer Surge (Plastic 45%, agglomeration risk)',
    description: 'High plastics and syringe surge elevating bed temperature and risk of defluidization agglomeration.',
  },
  {
    id: 'moisture_spike',
    name: 'Moisture Infiltration Spike (28% water)',
    description: 'Wet clinical waste feed causing thermal quenching and lower syngas LHV.',
  },
  {
    id: 'defluidized',
    name: 'Defluidized Clinker Bed (Agglomerated sand)',
    description: 'Severe sand agglomeration and channelized bubbling leading to imminent bed collapse.',
  },
]

export function generateSimulationResult(scenarioId: string = 'normal', customParams?: any): SimulationResult {
  const isCustom = scenarioId === 'custom'
  const wasteFeed = Number(customParams?.waste_feed_kg_h ?? 500.0)
  const plastic = Number(
    customParams?.plastic_ratio !== undefined
      ? customParams.plastic_ratio
      : (scenarioId === 'plastic_surge' ? 0.45 : 0.20)
  )
  const moisture = Number(
    customParams?.moisture_pct !== undefined
      ? customParams.moisture_pct
      : (scenarioId === 'moisture_spike' ? 28.0 : 15.0)
  )
  const agglomeration = Number(
    customParams?.agglomeration_index !== undefined
      ? customParams.agglomeration_index
      : (scenarioId === 'defluidized' ? 0.85 : (scenarioId === 'plastic_surge' ? 0.40 : 0.0))
  )

  const temp = Number(
    customParams?.reactor_temp_c !== undefined
      ? customParams.reactor_temp_c
      : (scenarioId === 'plastic_surge' ? 915 : (scenarioId === 'moisture_spike' ? 790 : 850))
  )

  const d_p_eff = 0.0003 * (1 + 3.0 * agglomeration)
  const ratio = 10.05 / Math.pow(1 + 3.0 * agglomeration, 1.8)
  const isDefluidized = ratio < 1.0
  const isBorderline = ratio >= 1.0 && ratio < 1.25

  const dpBed = Number((8.58 * (1 - 0.45 * agglomeration)).toFixed(2))
  const netPower = Number((178.6 * (wasteFeed / 500) * (1 - agglomeration * 0.25)).toFixed(1))
  const grossPower = Number((netPower + 11.6).toFixed(1))
  const heatRecovered = Number((863.1 * (wasteFeed / 500) * (1 - agglomeration * 0.1)).toFixed(1))
  const efficiency = Number((39.9 - agglomeration * 12).toFixed(1))

  const result: any = {
    scenario_id: scenarioId,
    timestamp: Date.now() / 1000,
    scenario_name: mockScenarios.find((s) => s.id === scenarioId)?.name ?? (isCustom ? 'Custom Sensitivity Run' : 'Nominal Fluidized Operation'),
    parameters: {
      waste_feed_kg_h: wasteFeed,
      moisture_pct: moisture,
      plastic_ratio: plastic,
      organic_ratio: 0.50,
      airflow_m3_h: Number(customParams?.airflow_m3_h ?? 661.0),
      reactor_temp_c: temp,
      pressure_kpa: 105.0,
      water_flow_kg_h: 1547.0,
      agglomeration_index: agglomeration,
    },
    feedstock: {
      dry_mass_flow_kg_h: wasteFeed * (1 - moisture / 100),
      moisture_flow_kg_h: wasteFeed * (moisture / 100),
      hhv_mj_kg: Number((21.5 + plastic * 12.0 - moisture * 0.18).toFixed(2)),
      lhv_mj_kg: Number((19.8 + plastic * 11.2 - moisture * 0.22).toFixed(2)),
      chemical_energy_kw: Number((wasteFeed * 5.8).toFixed(1)),
      valid: true,
    },
    gasification: {
      gas_mass_flow_kg_h: Number((wasteFeed * 2.3).toFixed(1)),
      gas_composition: {
        CO: Number((21.4 + plastic * 4).toFixed(1)),
        H2: Number((14.2 + plastic * 3).toFixed(1)),
        CH4: Number((4.1 + plastic * 1.5).toFixed(1)),
        CO2: 12.5,
        N2: 47.8,
      },
      syngas_flow_nm3_h: Number((wasteFeed * 2.15).toFixed(1)),
      syngas_lhv_mj_nm3: Number((5.2 + plastic * 2.2 - moisture * 0.05).toFixed(2)),
      thermal_energy_kw: Number((wasteFeed * 4.2).toFixed(1)),
      carbon_conversion: 0.96,
      equivalence_ratio: 0.30,
      gasification_efficiency: 74.5,
      char_ash_kg_h: Number((wasteFeed * 0.06).toFixed(1)),
      reactor_heat_balance_kw: 125.4,
      reactor_thermal_regime: 'AUTOTHERMAL_STABLE',
      reactor_heat_balance_note: 'Stable exothermic partial oxidation balancing sensible bed heat demand.',
      reactor_heat_balance: {
        sensible_evaporation_demand_kw: 48.2,
        moisture_evaporation_demand_kw: 95.1,
        feed_sensible_demand_kw: 110.3,
        air_sensible_demand_kw: 142.5,
        wall_loss_kw: 28.0,
        exothermic_heat_released_kw: 549.5,
        syngas_chemical_kw: 1650.0,
        char_chemical_kw: 45.0,
        net_heat_balance_kw: 125.4,
        regime: 'AUTOTHERMAL_STABLE',
        is_autothermal: true,
        note: 'Stable autothermal balance maintained.',
      },
    },
    fluidization: {
      u0_m_s: 0.85,
      umf_m_s: 0.085,
      umf_wen_yu_m_s: 0.084,
      umf_ergun_m_s: 0.086,
      umf_diff_pct: 2.1,
      ut_m_s: 3.45,
      u0_over_umf: 10.0,
      u0_over_umf_eff: Number(ratio.toFixed(2)),
      u0_over_ut: 0.25,
      geldart_group: 'Group B (Bubbling Fluidization Sand)',
      regime: isDefluidized ? 'Defluidized / Packed Channelling' : 'Vigorous Bubbling Fluidized Bed',
      agglomeration_index: agglomeration,
      d_eff_m: Number(d_p_eff.toFixed(6)),
      defluidization_risk: isDefluidized ? 0.95 : (isBorderline ? 0.45 : 0.05),
      umf_effective_m_s: Number((0.85 / ratio).toFixed(3)),
      dp_bed_kpa: dpBed,
      dp_distributor_kpa: 3.12,
      pressure_drop: dpBed,
      pressure_drop_kpa: dpBed,
      dp_ratio: 0.36,
      gas_density_kg_m3: 0.38,
      gas_viscosity_pa_s: 4.2e-5,
      archimedes: 1820.5,
      defluidization_margin: Number((ratio - 1.0).toFixed(2)),
      bubble_diameter_m: 0.045,
      bubble_velocity_m_s: 0.72,
      physics_state: isDefluidized ? 'DEFLUIDIZATION_RISK' : (isBorderline ? 'ELEVATED_AGGLOMERATION' : 'NORMAL_FLUIDIZATION'),
      physics_risk_level: isDefluidized ? 'CRITICAL' : (isBorderline ? 'ELEVATED' : 'LOW'),
      physics_reason: isDefluidized ? 'Effective particle diameter surge lowered U0/Umf_eff below 1.0.' : 'Superficial velocity exceeds Umf_eff by safe margin.',
    },
    mass_balance: {
      waste_input_kg_h: wasteFeed,
      air_input_kg_h: 661.0 * 1.2,
      total_input_kg_h: wasteFeed + 661.0 * 1.2,
      syngas_output_kg_h: wasteFeed * 2.3,
      char_ash_output_kg_h: wasteFeed * 0.06,
      total_output_kg_h: wasteFeed + 661.0 * 1.2,
      closure_error_pct: 0.04,
      status: 'VERIFIED_CLOSED',
      valid: true,
    },
    steam_cycle: {
      steam_flow_kg_h: 1547.0 * (wasteFeed / 500),
      steam_temp_c: 320.0,
      steam_pressure_bar: 16.0,
      boiler_duty_kw: 1024.5 * (wasteFeed / 500),
      enthalpy_in_kj_kg: 561.4,
      enthalpy_out_kj_kg: 3075.2,
      is_superheated: true,
      steam_engine: 'IAPWS-IF97 High Precision Formulation',
    },
    feed_pump: {
      pump_power_shaft_kw: 2.1,
      pump_power_electrical_kw: 2.5,
      enthalpy_in_kj_kg: 355.2,
      enthalpy_out_kj_kg: 358.1,
      work_specific_kj_kg: 2.9,
      suction_pressure_bar: 0.15,
      discharge_pressure_bar: 16.5,
      condensate_temp_c: 85.0,
      steam_engine: 'IAPWS-IF97 Formulation',
    },
    turbine: {
      turbine_power_kw: grossPower,
      net_electrical_power_kw: netPower,
      electrical_power_kw: grossPower,
      generator_efficiency: 0.94,
      isentropic_efficiency: 0.78,
      exhaust_temp_c: 88.5,
      exhaust_pressure_bar: 0.15,
      enthalpy_drop_kj_kg: 485.0,
      steam_rate_kg_kwh: 8.1,
    },
    heat_exchanger: {
      recovered_heat_kw: heatRecovered,
      hot_water_temp_c: 85.0,
      return_water_temp_c: 55.0,
      water_mass_flow_kg_h: 24700.0,
      lmtd_c: 24.5,
      exchanger_efficiency: 0.88,
      steam_available_heat_kw: 980.0,
    },
    energy_balance: {
      waste_chemical_input_kw: wasteFeed * 5.8,
      parasitic_blower_kw: 14.5,
      parasitic_pump_kw: 2.5,
      gross_generator_output_kw: grossPower,
      net_exported_power_kw: netPower,
      useful_heat_recovered_kw: heatRecovered,
      flue_stack_loss_kw: 145.0,
      convection_wall_loss_kw: 38.0,
      condenser_rejection_kw: 210.0,
      total_energy_input_kw: wasteFeed * 5.8 + 17.0,
      total_energy_accounted_kw: wasteFeed * 5.8 + 17.0,
      energy_closure_error_pct: 0.02,
    },
    whole_plant_closure: {
      closure_error_pct: 0.03,
      status: 'VERIFIED',
    },
    overall: {
      waste_input_kw: wasteFeed * 5.8,
      electrical_output_kw: grossPower,
      net_power_kw: netPower,
      feed_pump_electrical_kw: 2.5,
      heat_recovery_kw: heatRecovered,
      total_useful_kw: netPower + heatRecovered,
      overall_efficiency_pct: efficiency,
      gasification_efficiency_pct: 74.5,
      cold_gas_efficiency_pct: 68.5,
      energy_closure_error_pct: 0.02,
      whole_plant_closure_error_pct: 0.03,
      steam_loop_closure_error_pct: 0.01,
      reactor_heat_balance_kw: 125.4,
      reactor_thermal_regime: 'AUTOTHERMAL_STABLE',
    },
    anomaly: {
      is_anomaly: isDefluidized || agglomeration > 0.4,
      status: isDefluidized ? 'CRITICAL: Bed Defluidization Risk' : 'NORMAL',
      physics_label: isDefluidized ? 'DEFLUIDIZATION_RISK' : 'NORMAL_FLUIDIZATION',
      physics_risk_level: isDefluidized ? 'CRITICAL' : (isBorderline ? 'ELEVATED' : 'LOW'),
      probability: isDefluidized ? 0.94 : (isBorderline ? 0.52 : 0.03),
      confidence: 0.96,
      model_loaded: true,
      features: {
        pressure_drop: dpBed,
        temperature: temp,
        airflow: 661.0,
        plastic_ratio: plastic,
        u0_over_umf_eff: Number(ratio.toFixed(2)),
      },
      contributing_factors: isDefluidized
        ? ['High plastic ratio', 'Low superficial velocity margin', 'Effective particle diameter growth']
        : ['Normal fluidization parameters', 'Clean bed sand'],
      u0_over_umf_eff: Number(ratio.toFixed(2)),
    },
  }

  return result as SimulationResult
}

export const mockHistory: HistoryEntry[] = [
  {
    id: 'SIM-20261011-01',
    timestamp: '2026-10-11T12:00:00Z',
    scenario_name: 'Nominal Fluidized Operation (850°C, clean bed)',
    parameters: {
      waste_feed_kg_h: 500,
      moisture_pct: 15,
      plastic_ratio: 0.2,
      organic_ratio: 0.5,
      airflow_m3_h: 661,
      reactor_temp_c: 850,
      pressure_kpa: 105,
      water_flow_kg_h: 1547,
      agglomeration_index: 0.0,
    },
    overall: {
      waste_input_kw: 2900,
      electrical_output_kw: 190.2,
      net_power_kw: 178.6,
      heat_recovery_kw: 863.1,
      total_useful_kw: 1041.7,
      overall_efficiency_pct: 39.9,
      gasification_efficiency_pct: 74.5,
    },
    anomaly_state: 'NORMAL_FLUIDIZATION',
  },
  {
    id: 'SIM-20261011-02',
    timestamp: '2026-10-11T12:30:00Z',
    scenario_name: 'High Polymer Surge (Plastic 45%, agglomeration risk)',
    parameters: {
      waste_feed_kg_h: 500,
      moisture_pct: 15,
      plastic_ratio: 0.45,
      organic_ratio: 0.35,
      airflow_m3_h: 720,
      reactor_temp_c: 915,
      pressure_kpa: 105,
      water_flow_kg_h: 1547,
      agglomeration_index: 0.4,
    },
    overall: {
      waste_input_kw: 3200,
      electrical_output_kw: 202.4,
      net_power_kw: 189.5,
      heat_recovery_kw: 890.0,
      total_useful_kw: 1079.5,
      overall_efficiency_pct: 37.2,
      gasification_efficiency_pct: 72.0,
    },
    anomaly_state: 'ELEVATED_AGGLOMERATION',
  },
  {
    id: 'SIM-20261011-03',
    timestamp: '2026-10-11T13:15:00Z',
    scenario_name: 'Defluidized Clinker Bed (Agglomerated sand)',
    parameters: {
      waste_feed_kg_h: 500,
      moisture_pct: 15,
      plastic_ratio: 0.48,
      organic_ratio: 0.35,
      airflow_m3_h: 600,
      reactor_temp_c: 825,
      pressure_kpa: 105,
      water_flow_kg_h: 1547,
      agglomeration_index: 0.85,
    },
    overall: {
      waste_input_kw: 2850,
      electrical_output_kw: 142.0,
      net_power_kw: 130.4,
      heat_recovery_kw: 710.0,
      total_useful_kw: 840.4,
      overall_efficiency_pct: 29.5,
      gasification_efficiency_pct: 58.2,
    },
    anomaly_state: 'DEFLUIDIZATION_RISK',
  },
]

export const mockDetections: Detection[] = [
  { id: 1, class: 'Plastic', confidence: 0.94, bbox: { x: 70, y: 80, width: 140, height: 180 }, color: '#3b82f6' },
  { id: 2, class: 'Infectious', confidence: 0.89, bbox: { x: 240, y: 120, width: 130, height: 150 }, color: '#ef4444' },
  { id: 3, class: 'Sharps', confidence: 0.92, bbox: { x: 410, y: 90, width: 160, height: 190 }, color: '#ec4899' },
  { id: 4, class: 'Pathological', confidence: 0.86, bbox: { x: 180, y: 260, width: 150, height: 120 }, color: '#f59e0b' },
  { id: 5, class: 'General', confidence: 0.88, bbox: { x: 380, y: 270, width: 140, height: 110 }, color: '#06b6d4' },
]

export const mockClassCounts: Record<string, number> = {
  Plastic: 1,
  Infectious: 1,
  Sharps: 1,
  Pathological: 1,
  General: 1,
}
