export interface SimulationResult {
  scenario_id: string;
  timestamp: number;
  scenario_name: string;
  parameters: SimParams;
  feedstock: any;
  gasification: any;
  mass_balance: any;
  anomaly: AnomalyResult;
  steam_cycle: any;
  turbine: any;
  heat_exchanger: any;
  energy_balance: any;
  overall: OverallResult;
  tick?: number;
  sim_time_s?: number;
  speed?: number;
  running?: boolean;
}

export interface SimParams {
  waste_feed_kg_h: number;
  moisture_pct: number;
  plastic_ratio: number;
  organic_ratio: number;
  airflow_m3_h: number;
  reactor_temp_c: number;
  pressure_kpa: number;
  water_flow_kg_h: number;
}

export interface AnomalyResult {
  state: string;
  confidence: number;
  risk_level: string;
  recommendation: string;
  features?: any;
  probabilities?: Record<string, number>;
  contributing_factors?: string[];
  model_loaded: boolean;
}

export interface OverallResult {
  waste_input_kw: number;
  electrical_output_kw: number;
  heat_recovery_kw: number;
  total_useful_kw: number;
  overall_efficiency_pct: number;
  gasification_efficiency_pct: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
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
