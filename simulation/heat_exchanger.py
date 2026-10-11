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
from typing import Optional

try:
    from iapws import IAPWS97
    IAPWS_AVAILABLE = True
except ImportError:
    IAPWS_AVAILABLE = False


CP_WATER = 4.18  # kJ/(kg·K)


@dataclass
class HeatExchangerConfig:
    """Heat exchanger configuration."""
    cold_water_flow_kg_h: float = 300.0
    cold_water_inlet_temp_c: float = 20.0
    target_hot_water_temp_c: float = 70.0  # ASSUMPTION: District heating delivery temperature (°C)
    condensate_return_temp_c: float = 50.0  # ASSUMPTION: Subcooled liquid condensate return temperature (°C)
    condenser_pressure_bar: float = 0.5     # ASSUMPTION: Condenser operating pressure (bar)
    pinch_point_delta_t_c: float = 5.0      # ASSUMPTION: Minimum heat exchanger pinch temperature (°C)
    effectiveness: float = 0.85             # ASSUMPTION: Condensing heat exchanger thermal effectiveness
    fouling_factor: float = 0.95            # ASSUMPTION: Cleanliness / fouling factor
    auto_water_flow: bool = True            # ASSUMPTION: District water flow is sized to match exhaust steam duty


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
    steam_available_heat_kw: float = 0.0
    condenser_heat_kw: float = 0.0
    cooling_loss_kw: float = 0.0
    unrecovered_heat_kw: float = 0.0
    water_side_limited: bool = False
    required_water_flow_kg_h: float = 0.0
    water_flow_used_kg_h: float = 0.0
    steam_engine: str = "IAPWS-IF97"  # "IAPWS-IF97" or "SIMPLIFIED_FALLBACK"
    valid: bool = True
    errors: list = field(default_factory=list)


def calculate_heat_exchanger(
    steam_flow_kg_h: float,
    steam_inlet_temp_c: float,
    steam_inlet_enthalpy_kj_kg: float,
    config: HeatExchangerConfig = None,
) -> HeatExchangerResult:
    """
    Calculate heat recovery in the exhaust steam heat exchanger / district heating condenser.
    
    Duty formulation:
      Q_steam_avail = m_steam × (h_exhaust - h_condensate)
      where h_condensate is liquid enthalpy at return temperature (ASSUMPTION: 50 °C).
      Duty is recovered by district water, limited by water flow and temperature limits.
      If auto_water_flow is True, district water flow is dynamically sized to absorb available duty.
    """
    if config is None:
        config = HeatExchangerConfig()
    
    result = HeatExchangerResult()
    
    if steam_flow_kg_h <= 0:
        result.recovered_heat_kw = 0.0
        return result
    
    if steam_inlet_temp_c <= config.cold_water_inlet_temp_c:
        result.recovered_heat_kw = 0.0
        result.cold_water_outlet_temp_c = config.cold_water_inlet_temp_c
        return result
    
    # 1. Condensate return state (subcooled liquid at condensate_return_temp_c)
    condensate_temp = config.condensate_return_temp_c
    engine_used = "SIMPLIFIED_FALLBACK"
    h_condensate = CP_WATER * condensate_temp

    if IAPWS_AVAILABLE:
        try:
            p_cond_mpa = max(0.001, config.condenser_pressure_bar * 0.1)
            st_cond = IAPWS97(T=condensate_temp + 273.15, P=p_cond_mpa)
            h_condensate = st_cond.h
            engine_used = "IAPWS-IF97"
        except Exception:
            engine_used = "SIMPLIFIED_FALLBACK"

    result.steam_engine = engine_used

    # 2. Maximum available heat duty from condensing exhaust steam
    # duty = steam flow × (exhaust enthalpy - condensate enthalpy at return state)
    q_available_kj_h = steam_flow_kg_h * (steam_inlet_enthalpy_kj_kg - h_condensate)
    q_available_kw = max(0.0, q_available_kj_h / 3600.0)
    result.steam_available_heat_kw = q_available_kw
    result.condenser_heat_kw = q_available_kw
    
    # 3. District water temperature limits & required water flow
    delta_t_target = max(5.0, config.target_hot_water_temp_c - config.cold_water_inlet_temp_c)
    effective_factor = config.effectiveness * config.fouling_factor
    target_duty_kw = q_available_kw * effective_factor
    
    # Required water flow rate (kg/h) to absorb steam duty with target temperature rise
    required_water_flow = (target_duty_kw * 3600.0) / (CP_WATER * delta_t_target) if delta_t_target > 0 else 0.0
    result.required_water_flow_kg_h = required_water_flow
    
    # 4. Actual water flow used
    if config.auto_water_flow:
        water_flow = max(required_water_flow, 10.0)
        result.water_side_limited = False
        q_max_cold_kw = q_available_kw
    else:
        water_flow = config.cold_water_flow_kg_h
        if water_flow <= 0:
            result.recovered_heat_kw = 0.0
            result.cooling_loss_kw = q_available_kw
            result.unrecovered_heat_kw = q_available_kw
            result.water_side_limited = True
            return result
        max_cold_water_temp = steam_inlet_temp_c - config.pinch_point_delta_t_c
        delta_t_max = max(0.0, max_cold_water_temp - config.cold_water_inlet_temp_c)
        q_max_cold_kw = (water_flow * CP_WATER * delta_t_max) / 3600.0
        result.water_side_limited = q_max_cold_kw < q_available_kw
    
    result.water_flow_used_kg_h = water_flow
    
    # 5. Actual heat transferred
    q_transferable_kw = min(q_available_kw, q_max_cold_kw)
    q_actual = q_transferable_kw * effective_factor
    
    result.recovered_heat_kw = q_actual
    result.heat_transfer_rate_kw = q_actual
    result.cooling_loss_kw = max(0.0, q_available_kw - q_actual)
    result.unrecovered_heat_kw = result.cooling_loss_kw
    
    # 6. Cold water outlet temperature
    if water_flow > 0:
        delta_t_cold = (q_actual * 3600.0) / (water_flow * CP_WATER)
        result.cold_water_outlet_temp_c = config.cold_water_inlet_temp_c + delta_t_cold
        result.hot_water_outlet_temp_c = result.cold_water_outlet_temp_c
    
    # 7. Steam condensate outlet state
    if steam_flow_kg_h > 0:
        h_out = steam_inlet_enthalpy_kj_kg - (q_actual * 3600.0 / steam_flow_kg_h)
        result.steam_condensate_temp_c = max(condensate_temp, h_out / CP_WATER)
    
    # 8. Exchanger efficiency
    if q_available_kw > 0:
        result.exchanger_efficiency = q_actual / q_available_kw
    
    # 9. LMTD for counter-flow
    dt1 = steam_inlet_temp_c - result.cold_water_outlet_temp_c
    dt2 = result.steam_condensate_temp_c - config.cold_water_inlet_temp_c
    if dt1 > 0 and dt2 > 0 and abs(dt1 - dt2) > 0.01:
        import math
        result.log_mean_temp_diff_c = (dt1 - dt2) / math.log(dt1 / dt2)
    elif dt1 > 0:
        result.log_mean_temp_diff_c = dt1
    
    return result
