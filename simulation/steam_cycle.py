"""
Steam Cycle Module
==================
Calculates steam generation from available thermal energy.

Model:
  Q_boiler = m_steam × [Cp_water × (T_sat - T_inlet) + h_fg + Cp_steam × (T_super - T_sat)]
  
  Where:
    Cp_water = 4.18 kJ/(kg·K) - specific heat of liquid water
    h_fg ≈ 2257 kJ/kg - latent heat of vaporization at ~100°C
    Cp_steam ≈ 2.01 kJ/(kg·K) - specific heat of superheated steam
    T_sat depends on pressure (simplified correlation)

Pressure-saturation temperature correlation (simplified):
  T_sat ≈ 100 + 20 × ln(P_bar) for P in bar (rough approximation)
  
  More accurate: Antoine equation or steam tables lookup

Assumptions:
  - Boiler efficiency accounts for heat losses
  - Single-pressure steam cycle
  - Simplified enthalpy calculations (no full steam tables)
"""

from dataclasses import dataclass, field
import math


@dataclass
class SteamConfig:
    """Steam generation configuration."""
    water_flow_kg_h: float = 200.0
    inlet_water_temp_c: float = 20.0
    boiler_efficiency: float = 0.85
    target_steam_pressure_bar: float = 10.0
    target_steam_temp_c: float = 350.0
    latent_heat_kj_kg: float = 2257.0  # at atmospheric, varies with pressure
    derive_from_heat: bool = True  # ASSUMPTION: Feedwater flow matches available syngas heat


@dataclass
class SteamResult:
    """Steam generation results."""
    steam_mass_flow_kg_h: float = 0.0
    steam_temperature_c: float = 0.0
    steam_pressure_bar: float = 0.0
    saturation_temp_c: float = 0.0
    enthalpy_inlet_kj_kg: float = 0.0
    enthalpy_outlet_kj_kg: float = 0.0
    boiler_duty_kw: float = 0.0
    thermal_input_required_kw: float = 0.0
    is_superheated: bool = False
    valid: bool = True
    errors: list = field(default_factory=list)


# Physical constants
CP_WATER = 4.18  # kJ/(kg·K)
CP_STEAM = 2.01  # kJ/(kg·K)
H_FG_100C = 2257.0  # kJ/kg latent heat at 100°C


def saturation_temperature(pressure_bar: float) -> float:
    """
    Estimate saturation temperature from pressure.
    Simplified correlation: T_sat ≈ 100 + 28.07 × ln(P_bar)
    Valid approximately for 1-40 bar.
    """
    if pressure_bar <= 0:
        return 100.0
    return 100.0 + 28.07 * math.log(max(0.1, pressure_bar))


def latent_heat_at_pressure(pressure_bar: float) -> float:
    """
    Estimate latent heat of vaporization at given pressure.
    Decreases with increasing pressure.
    h_fg ≈ 2257 - 4.5 × (T_sat - 100) kJ/kg (simplified)
    """
    t_sat = saturation_temperature(pressure_bar)
    h_fg = 2257 - 4.5 * (t_sat - 100)
    return max(500.0, h_fg)  # minimum bound


def calculate_steam_enthalpy(temp_c: float, pressure_bar: float) -> float:
    """
    Estimate specific enthalpy of steam at given conditions.
    Reference: h = 0 at 0°C liquid water
    
    For liquid: h ≈ Cp_water × T
    For saturated steam: h ≈ h_water(T_sat) + h_fg
    For superheated: h ≈ h_sat_steam + Cp_steam × (T - T_sat)
    """
    t_sat = saturation_temperature(pressure_bar)
    h_fg = latent_heat_at_pressure(pressure_bar)
    
    h_liquid_sat = CP_WATER * t_sat
    h_steam_sat = h_liquid_sat + h_fg
    
    if temp_c <= t_sat:
        # Subcooled or saturated liquid
        return CP_WATER * temp_c
    else:
        # Superheated steam
        return h_steam_sat + CP_STEAM * (temp_c - t_sat)


def calculate_steam_generation(
    config: SteamConfig,
    available_thermal_kw: float
) -> SteamResult:
    """
    Calculate steam generation from available thermal energy.
    
    Process:
    1. Calculate saturation temperature at target pressure
    2. Calculate enthalpy of inlet water and outlet steam
    3. Determine maximum steam flow from available energy
    4. Calculate actual steam conditions
    
    Parameters:
      config: Steam cycle configuration
      available_thermal_kw: Available thermal energy from gasification (kW)
    """
    result = SteamResult()
    
    if config.water_flow_kg_h <= 0:
        result.valid = False
        result.errors.append("Water flow must be positive")
        return result
    
    if available_thermal_kw <= 0:
        result.valid = True
        result.steam_mass_flow_kg_h = 0
        return result
    
    # Saturation conditions
    result.saturation_temp_c = saturation_temperature(config.target_steam_pressure_bar)
    result.steam_pressure_bar = config.target_steam_pressure_bar
    
    # Inlet enthalpy
    result.enthalpy_inlet_kj_kg = CP_WATER * config.inlet_water_temp_c
    
    # Target outlet enthalpy
    target_temp = max(config.target_steam_temp_c, result.saturation_temp_c + 10)
    result.enthalpy_outlet_kj_kg = calculate_steam_enthalpy(
        target_temp, config.target_steam_pressure_bar
    )
    result.is_superheated = target_temp > result.saturation_temp_c
    
    # Energy per kg of steam
    delta_h = result.enthalpy_outlet_kj_kg - result.enthalpy_inlet_kj_kg
    
    if delta_h <= 0:
        result.valid = False
        result.errors.append("Enthalpy difference is non-positive")
        return result
    
    # Available boiler energy (accounting for efficiency)
    available_boiler_kw = available_thermal_kw * config.boiler_efficiency
    
    # Maximum steam flow from energy balance
    # Q = m × Δh → m = Q / Δh
    # Convert kW to kJ/h: × 3600
    max_steam_kg_h = (available_boiler_kw * 3600) / delta_h
    
    # Actual steam flow: derived from available heat by default, or clamped by water_flow_kg_h if derive_from_heat is False
    # ASSUMPTION: In a balanced heat recovery boiler, steam output scales with available syngas thermal duty
    if config.derive_from_heat:
        result.steam_mass_flow_kg_h = max_steam_kg_h
    else:
        result.steam_mass_flow_kg_h = min(config.water_flow_kg_h, max_steam_kg_h)
    result.steam_temperature_c = target_temp
    
    # Actual boiler duty
    result.boiler_duty_kw = result.steam_mass_flow_kg_h * delta_h / 3600
    result.thermal_input_required_kw = result.boiler_duty_kw / config.boiler_efficiency
    
    return result
