"""
Heat Exchanger Module
=====================
Models cascading heat recovery from low-pressure exhaust steam.

Heat exchange model:
  Q = m_steam × (h_in - h_out)     [steam side]
  Q = m_water × Cp × (T_out - T_in)  [water side]

With effectiveness:
  ε = Q_actual / Q_max
  Q_max = C_min × (T_hot_in - T_cold_in)

Assumptions:
  - Counter-flow heat exchanger
  - No phase change on water side (liquid heating only)
  - Steam condenses and exits as subcooled liquid
  - Fouling factor included as efficiency reduction
"""

from dataclasses import dataclass, field


CP_WATER = 4.18  # kJ/(kg·K)


@dataclass
class HeatExchangerConfig:
    """Heat exchanger configuration."""
    cold_water_flow_kg_h: float = 300.0
    cold_water_inlet_temp_c: float = 20.0
    effectiveness: float = 0.80
    fouling_factor: float = 0.95  # 1.0 = no fouling


@dataclass
class HeatExchangerResult:
    """Heat exchanger calculation results."""
    hot_water_outlet_temp_c: float = 0.0
    cold_water_outlet_temp_c: float = 0.0
    recovered_heat_kw: float = 0.0
    exchanger_efficiency: float = 0.0
    steam_condensate_temp_c: float = 0.0
    heat_transfer_rate_kw: float = 0.0
    log_mean_temp_diff_c: float = 0.0
    valid: bool = True
    errors: list = field(default_factory=list)


def calculate_heat_exchanger(
    steam_flow_kg_h: float,
    steam_inlet_temp_c: float,
    steam_inlet_enthalpy_kj_kg: float,
    config: HeatExchangerConfig = None,
) -> HeatExchangerResult:
    """
    Calculate heat recovery in the heat exchanger.
    
    Process:
    1. Calculate maximum available heat from steam
    2. Apply effectiveness to get actual heat transfer
    3. Calculate cold water outlet temperature
    4. Calculate steam-side outlet conditions
    
    Parameters:
      steam_flow_kg_h: Exhaust steam mass flow (kg/h)
      steam_inlet_temp_c: Steam inlet temperature (°C)
      steam_inlet_enthalpy_kj_kg: Steam inlet enthalpy (kJ/kg)
      config: Heat exchanger configuration
    """
    if config is None:
        config = HeatExchangerConfig()
    
    result = HeatExchangerResult()
    
    if steam_flow_kg_h <= 0 or config.cold_water_flow_kg_h <= 0:
        result.recovered_heat_kw = 0.0
        return result
    
    if steam_inlet_temp_c <= config.cold_water_inlet_temp_c:
        result.recovered_heat_kw = 0.0
        result.cold_water_outlet_temp_c = config.cold_water_inlet_temp_c
        return result
    
    # Maximum heat from steam condensation and cooling
    # Assume steam condenses to liquid at ~50°C
    condensate_target_temp = 50.0
    h_condensate = CP_WATER * condensate_target_temp
    
    # Available heat from steam
    q_available_kj_h = steam_flow_kg_h * (steam_inlet_enthalpy_kj_kg - h_condensate)
    q_available_kw = max(0, q_available_kj_h / 3600.0)
    
    # Maximum heat absorbable by cold water (to stay below steam inlet temp)
    max_cold_water_temp = steam_inlet_temp_c - 5.0  # pinch point
    q_max_cold_kj_h = config.cold_water_flow_kg_h * CP_WATER * (max_cold_water_temp - config.cold_water_inlet_temp_c)
    q_max_cold_kw = max(0, q_max_cold_kj_h / 3600.0)
    
    # Actual heat transfer
    q_max = min(q_available_kw, q_max_cold_kw)
    q_actual = q_max * config.effectiveness * config.fouling_factor
    
    result.recovered_heat_kw = q_actual
    result.heat_transfer_rate_kw = q_actual
    
    # Cold water outlet temperature
    if config.cold_water_flow_kg_h > 0:
        delta_t_cold = (q_actual * 3600) / (config.cold_water_flow_kg_h * CP_WATER)
        result.cold_water_outlet_temp_c = config.cold_water_inlet_temp_c + delta_t_cold
        result.hot_water_outlet_temp_c = result.cold_water_outlet_temp_c
    
    # Steam condensate temperature
    if steam_flow_kg_h > 0 and steam_inlet_enthalpy_kj_kg > 0:
        h_out = steam_inlet_enthalpy_kj_kg - (q_actual * 3600 / steam_flow_kg_h)
        result.steam_condensate_temp_c = max(condensate_target_temp, h_out / CP_WATER)
    
    # Exchanger efficiency
    if q_available_kw > 0:
        result.exchanger_efficiency = q_actual / q_available_kw
    
    # Log mean temperature difference (LMTD) for counter-flow
    dt1 = steam_inlet_temp_c - result.cold_water_outlet_temp_c
    dt2 = result.steam_condensate_temp_c - config.cold_water_inlet_temp_c
    if dt1 > 0 and dt2 > 0 and abs(dt1 - dt2) > 0.01:
        import math
        result.log_mean_temp_diff_c = (dt1 - dt2) / math.log(dt1 / dt2)
    elif dt1 > 0:
        result.log_mean_temp_diff_c = dt1
    
    return result
