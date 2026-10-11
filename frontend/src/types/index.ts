export interface SimParams {
  waste_feed_kg_h: number;
  moisture_pct: number;
  plastic_ratio: number;
  organic_ratio: number;
  airflow_m3_h: number;
  reactor_temp_c: number;
  pressure_kpa: number;
  water_flow_kg_h: number;
  agglomeration_index?: number;
}

export interface FeedstockResult {
  dry_mass_flow_kg_h: number;
  moisture_flow_kg_h: number;
  hhv_mj_kg: number;
  lhv_mj_kg: number;
  chemical_energy_kw: number;
  valid: boolean;
}

export interface ReactorHeatBalance {
  sensible_evaporation_demand_kw: number;
  moisture_evaporation_demand_kw: number;
  feed_sensible_demand_kw: number;
  air_sensible_demand_kw: number;
  wall_loss_kw: number;
  exothermic_heat_released_kw: number;
  syngas_chemical_kw: number;
  char_chemical_kw: number;
  net_heat_balance_kw: number;
  regime: string;
  is_autothermal: boolean;
  note: string;
}

export interface GasificationResult {
  gas_mass_flow_kg_h: number;
  gas_composition: Record<string, number>;
  syngas_flow_nm3_h: number;
  syngas_lhv_mj_nm3: number;
  thermal_energy_kw: number;
  carbon_conversion: number;
  equivalence_ratio: number;
  gasification_efficiency: number;
  char_ash_kg_h: number;
  reactor_heat_balance_kw: number;
  reactor_thermal_regime: string;
  reactor_heat_balance_note: string;
  reactor_heat_balance: ReactorHeatBalance;
}

export interface FluidizationResult {
  u0_m_s: number;
  umf_m_s: number;
  umf_wen_yu_m_s: number;
  umf_ergun_m_s: number;
  umf_diff_pct: number;
  ut_m_s: number;
  u0_over_umf: number;
  u0_over_umf_eff: number;
  u0_over_ut: number;
  geldart_group: string;
  regime: string;
  agglomeration_index: number;
  d_eff_m: number;
  defluidization_risk: number;
  umf_effective_m_s: number;
  dp_bed_kpa: number;
  dp_distributor_kpa: number;
  pressure_drop: number;
  pressure_drop_kpa: number;
  dp_total_kpa?: number;
  dp_ratio: number;
  gas_density_kg_m3: number;
  gas_viscosity_pa_s: number;
  archimedes: number;
  defluidization_margin: number;
  bubble_diameter_m: number;
  bubble_velocity_m_s: number;
  physics_state: string;
  physics_risk_level: string;
  physics_reason: string;
}

export interface MassBalanceResult {
  waste_input_kg_h?: number;
  air_input_kg_h?: number;
  total_input_kg_h?: number;
  syngas_output_kg_h?: number;
  char_ash_output_kg_h?: number;
  total_output_kg_h?: number;
  closure_error_pct?: number;
  status?: string;
  valid?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export interface SteamCycleResult {
  steam_flow_kg_h: number;
  steam_temp_c: number;
  steam_pressure_bar: number;
  boiler_duty_kw: number;
  enthalpy_in_kj_kg: number;
  enthalpy_out_kj_kg: number;
  is_superheated: boolean;
  steam_engine: string;
}

export interface FeedPumpResult {
  pump_power_shaft_kw: number;
  pump_power_electrical_kw: number;
  enthalpy_in_kj_kg: number;
  enthalpy_out_kj_kg: number;
  work_specific_kj_kg: number;
  suction_pressure_bar: number;
  discharge_pressure_bar: number;
  condensate_temp_c: number;
  steam_engine: string;
}

export interface TurbineResult {
  turbine_power_kw: number;
  electrical_power_kw: number;
  net_electrical_power_kw: number;
  enthalpy_drop_kj_kg: number;
  exhaust_temp_c: number;
  steam_rate_kg_kwh: number;
  isentropic_efficiency: number;
  steam_engine: string;
}

export interface HeatExchangerResult {
  hot_water_temp_c: number;
  recovered_heat_kw: number;
  exchanger_efficiency: number;
  lmtd_c: number;
  steam_available_heat_kw: number;
  condenser_heat_kw: number;
  unrecovered_heat_kw: number;
  water_side_limited: boolean;
  required_water_flow_kg_h: number;
  water_flow_used_kg_h: number;
  cooling_loss_kw: number;
  steam_engine: string;
}

export interface WholePlantClosureResult {
  chemical_input_kw: number;
  net_electrical_power_kw: number;
  district_heat_kw: number;
  unrecovered_condenser_heat_kw: number;
  reactor_wall_loss_kw: number;
  char_chemical_energy_kw: number;
  boiler_stack_loss_kw: number;
  syngas_sensible_stack_losses_kw: number;
  whole_plant_output_sum_kw: number;
  closure_error_pct: number;
}

export interface EnergyBalanceDetails {
  chemical_input_kw: number;
  gasification_thermal_kw: number;
  boiler_energy_kw: number;
  turbine_power_kw: number;
  turbine_shaft_work_kw: number;
  feed_pump_shaft_power_kw: number;
  feed_pump_electrical_power_kw: number;
  net_electrical_power_kw: number;
  heat_recovery_kw: number;
  condenser_heat_kw: number;
  cooling_loss_kw: number;
  unrecovered_heat_kw: number;
  condensate_subcooling_loss_kw: number;
  documented_losses_kw: number;
  reactor_wall_loss_kw: number;
  char_chemical_energy_kw: number;
  boiler_stack_loss_kw: number;
  syngas_sensible_demand_kw: number;
  electromechanical_losses_kw: number;
  syngas_sensible_stack_losses_kw: number;
  whole_plant_output_sum_kw: number;
  whole_plant_closure_error_pct: number;
  steam_loop_closure_error_pct: number;
  energy_closure_error_pct: number;
  total_losses_kw: number;
  total_useful_kw: number;
  overall_efficiency: number;
  gasification_efficiency: number;
  power_gen_efficiency: number;
}

export interface AnomalyResult {
  state: string;
  confidence: number;
  risk_level: string;
  recommendation: string;
  physics_label?: string;
  physics_reason?: string;
  model_loaded: boolean;
  probabilities?: Record<string, number>;
  features?: Record<string, number>;
  contributing_factors?: string[];
  u0_m_s?: number;
  umf_effective_m_s?: number;
  u0_over_umf_eff?: number;
  ut_m_s?: number;
  u0_over_ut?: number;
}

export interface OverallResult {
  waste_input_kw: number;
  electrical_output_kw: number;
  net_power_kw?: number;
  feed_pump_electrical_kw?: number;
  heat_recovery_kw: number;
  total_useful_kw: number;
  overall_efficiency_pct: number;
  gasification_efficiency_pct: number;
  cold_gas_efficiency_pct?: number;
  energy_closure_error_pct?: number;
  whole_plant_closure_error_pct?: number;
  steam_loop_closure_error_pct?: number;
  reactor_heat_balance_kw?: number;
  reactor_thermal_regime?: string;
}

export interface SimulationResult {
  scenario_id: string;
  timestamp: number;
  scenario_name: string;
  parameters: SimParams;
  feedstock: FeedstockResult;
  gasification: GasificationResult;
  fluidization: FluidizationResult;
  mass_balance: MassBalanceResult;
  anomaly: AnomalyResult;
  steam_cycle: SteamCycleResult;
  feed_pump?: FeedPumpResult;
  turbine: TurbineResult;
  heat_exchanger: HeatExchangerResult;
  energy_balance: EnergyBalanceDetails;
  whole_plant_closure: WholePlantClosureResult;
  overall: OverallResult;
  equivalence_ratio?: number;
  energy_closure_error_pct?: number;
  whole_plant_closure_error_pct?: number;
  steam_loop_closure_error_pct?: number;
  reactor_heat_balance_kw?: number;
  reactor_thermal_regime?: string;
  reactor_heat_balance_note?: string;
  u0_m_s?: number;
  umf_m_s?: number;
  umf_wen_yu_m_s?: number;
  umf_ergun_m_s?: number;
  ut_m_s?: number;
  u0_over_umf?: number;
  u0_over_umf_eff?: number;
  u0_over_ut?: number;
  geldart_group?: string;
  regime?: string;
  agglomeration_index?: number;
  defluidization_risk?: number;
  umf_effective_m_s?: number;
  dp_bed_kpa?: number;
  dp_distributor_kpa?: number;
  pressure_drop?: number;
  dp_ratio?: number;
  physics_state?: string;
  tick?: number;
  sim_time_s?: number;
  speed?: number;
  running?: boolean;
}

export interface ScenarioParams extends Partial<SimParams> {
  name?: string;
  boiler_efficiency?: number;
  turbine_efficiency?: number;
  glass_ratio?: number;
  infectious_ratio?: number;
  carbon?: number;
  hydrogen?: number;
  oxygen?: number;
  nitrogen?: number;
  sulfur?: number;
  chlorine?: number;
  ash?: number;
  agglomeration_index?: number;
  d_p?: number;
  [key: string]: number | string | undefined;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  parameters?: ScenarioParams;
}

export interface Detection {
  id: number;
  class: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  color: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  scenario_name: string;
  parameters: SimParams;
  overall: OverallResult;
  anomaly_state: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  anomaly_model_loaded: boolean;
  yolo_model_loaded: boolean;
  vit_model_loaded: boolean;
  version: string;
  disclaimer: string;
}

export interface SystemInfoResponse {
  python_version: string;
  platform: string;
  cuda_available: boolean;
  anomaly_model_loaded: boolean;
  yolo_model_loaded: boolean;
  vit_model_loaded: boolean;
  history_count: number;
  disclaimer: string;
}
