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
    
    # Isentropic outlet enthalpy estimation
    # At exhaust pressure, estimate the enthalpy after isentropic expansion
    t_sat_out = saturation_temperature(config.outlet_pressure_bar)
    
    # Simplified: isentropic expansion to just above saturation at outlet pressure
    # The actual enthalpy depends on entropy, but we use a simplified approach
    h_out_isentropic = calculate_steam_enthalpy(
        t_sat_out + 5, config.outlet_pressure_bar
    )
    
    # Enthalpy drop
    delta_h_isentropic = inlet_enthalpy_kj_kg - h_out_isentropic
    
    if delta_h_isentropic <= 0:
        result.valid = True
        result.turbine_power_kw = 0.0
        result.electrical_power_kw = 0.0
        result.errors.append("No enthalpy drop available for expansion")
        return result
    
    # Actual enthalpy drop (with isentropic efficiency)
    delta_h_actual = delta_h_isentropic * config.efficiency_isentropic
    result.enthalpy_drop_kj_kg = delta_h_actual
    
    # Outlet conditions
    result.outlet_enthalpy_kj_kg = inlet_enthalpy_kj_kg - delta_h_actual
    result.exhaust_temperature_c = t_sat_out + 10  # slightly superheated exhaust
    result.exhaust_enthalpy_kj_kg = result.outlet_enthalpy_kj_kg
    
    # Turbine shaft power (kW)
    # W = m_dot × Δh / 3600 (converting kg/h × kJ/kg to kW)
    result.turbine_power_kw = steam_flow_kg_h * delta_h_actual / 3600.0
    
    # Electrical power output
    result.electrical_power_kw = (
        result.turbine_power_kw * 
        config.mechanical_efficiency * 
        config.generator_efficiency
    )
    
    # Specific steam consumption
    if result.electrical_power_kw > 0:
        result.steam_rate_kg_kwh = steam_flow_kg_h / result.electrical_power_kw
    
    return result
