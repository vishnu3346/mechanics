"""
Steam Turbine Module
====================
Calculates power generation from steam expansion.

Model:
  W_turbine = m_steam × (h_in - h_out) × η_isentropic

  Where:
    h_in = inlet steam enthalpy (kJ/kg)
    h_out = outlet steam enthalpy (kJ/kg)  
    η_isentropic = isentropic efficiency (typically 0.70-0.85)

The outlet enthalpy is estimated from:
  h_out_ideal = h_in - (h_in - h_out_isentropic)
  h_out_actual = h_in - η × (h_in - h_out_isentropic)

Simplified isentropic outlet estimation:
  For expansion from P_in to P_out:
  h_out_s ≈ h_sat_steam(P_out) + Cp_steam × superheat_remaining

Assumptions:
  - Single-stage expansion (simplified)
  - No extraction or bleeding
  - Exhaust to condenser or heat exchanger
"""

from dataclasses import dataclass, field
from simulation.steam_cycle import calculate_steam_enthalpy, saturation_temperature, CP_STEAM

try:
    from iapws import IAPWS97
    IAPWS_AVAILABLE = True
except ImportError:
    IAPWS_AVAILABLE = False


@dataclass
class TurbineConfig:
    """Steam turbine configuration."""
    efficiency_isentropic: float = 0.75
    outlet_pressure_bar: float = 0.5  # condenser/exhaust pressure
    mechanical_efficiency: float = 0.95
    generator_efficiency: float = 0.95


@dataclass
class TurbineResult:
    """Steam turbine calculation results."""
    turbine_power_kw: float = 0.0
    electrical_power_kw: float = 0.0
    inlet_enthalpy_kj_kg: float = 0.0
    outlet_enthalpy_kj_kg: float = 0.0
    enthalpy_drop_kj_kg: float = 0.0
    exhaust_temperature_c: float = 0.0
    exhaust_enthalpy_kj_kg: float = 0.0
    steam_rate_kg_kwh: float = 0.0  # specific steam consumption
    isentropic_efficiency: float = 0.0
    exhaust_vapor_quality: float = 1.0
    inlet_entropy_kj_kg_k: float = 0.0
    steam_engine: str = "IAPWS-IF97"  # "IAPWS-IF97" or "SIMPLIFIED_FALLBACK"
    valid: bool = True
    errors: list = field(default_factory=list)


def calculate_turbine(
    steam_flow_kg_h: float,
    inlet_enthalpy_kj_kg: float,
    inlet_temp_c: float,
    inlet_pressure_bar: float,
    config: TurbineConfig = None,
) -> TurbineResult:
    """
    Calculate turbine power output.
    
    Process:
    1. Calculate isentropic outlet enthalpy
    2. Apply isentropic efficiency
    3. Calculate actual power output
    4. Account for mechanical and generator losses
    
    Parameters:
      steam_flow_kg_h: Steam mass flow rate (kg/h)
      inlet_enthalpy_kj_kg: Steam inlet enthalpy (kJ/kg)
      inlet_temp_c: Steam inlet temperature (°C)
      inlet_pressure_bar: Steam inlet pressure (bar)
      config: Turbine configuration
    """
    if config is None:
        config = TurbineConfig()
    
    result = TurbineResult()
    result.isentropic_efficiency = config.efficiency_isentropic
    
    if steam_flow_kg_h <= 0:
        result.turbine_power_kw = 0.0
        result.electrical_power_kw = 0.0
        return result
    
    result.inlet_enthalpy_kj_kg = inlet_enthalpy_kj_kg
    
    t_sat_out = saturation_temperature(config.outlet_pressure_bar)
    engine_used = "SIMPLIFIED_FALLBACK"
    h_out_isentropic = calculate_steam_enthalpy(t_sat_out + 5, config.outlet_pressure_bar)
    s_in = 0.0
    x_exhaust = 1.0
    t_exhaust_c = t_sat_out + 10.0

    if IAPWS_AVAILABLE:
        try:
            p_in_mpa = max(0.001, inlet_pressure_bar * 0.1)
            p_out_mpa = max(0.001, config.outlet_pressure_bar * 0.1)
            
            # Inlet entropy from temperature and pressure
            st_in = IAPWS97(T=inlet_temp_c + 273.15, P=p_in_mpa)
            s_in = st_in.s
            
            # Isentropic expansion to condenser pressure (s_out = s_in)
            st_out_s = IAPWS97(P=p_out_mpa, s=s_in)
            h_out_isentropic = st_out_s.h
            
            delta_h_isen = inlet_enthalpy_kj_kg - h_out_isentropic
            if delta_h_isen > 0:
                delta_h_act = delta_h_isen * config.efficiency_isentropic
                h_ex_act = inlet_enthalpy_kj_kg - delta_h_act
                st_out_act = IAPWS97(P=p_out_mpa, h=h_ex_act)
                t_exhaust_c = st_out_act.T - 273.15
                x_exhaust = st_out_act.x if st_out_act.x is not None else 1.0
                engine_used = "IAPWS-IF97"
        except Exception:
            engine_used = "SIMPLIFIED_FALLBACK"

    result.steam_engine = engine_used
    result.inlet_entropy_kj_kg_k = s_in

    # Enthalpy drop
    delta_h_isentropic = inlet_enthalpy_kj_kg - h_out_isentropic
    if delta_h_isentropic <= 0:
        result.valid = True
        result.turbine_power_kw = 0.0
        result.electrical_power_kw = 0.0
        result.errors.append("No enthalpy drop available for expansion")
        return result

    delta_h_actual = delta_h_isentropic * config.efficiency_isentropic
    result.enthalpy_drop_kj_kg = delta_h_actual
    result.outlet_enthalpy_kj_kg = inlet_enthalpy_kj_kg - delta_h_actual
    result.exhaust_enthalpy_kj_kg = result.outlet_enthalpy_kj_kg
    result.exhaust_temperature_c = t_exhaust_c
    result.exhaust_vapor_quality = x_exhaust

    # Turbine shaft power (kW): W = m_dot × Δh / 3600
    result.turbine_power_kw = steam_flow_kg_h * delta_h_actual / 3600.0

    # Electrical power output (accounting for mechanical and generator efficiency)
    result.electrical_power_kw = (
        result.turbine_power_kw * 
        config.mechanical_efficiency * 
        config.generator_efficiency
    )

    # Specific steam consumption (kg/kWh)
    if result.electrical_power_kw > 0:
        result.steam_rate_kg_kwh = steam_flow_kg_h / result.electrical_power_kw
    
    return result
