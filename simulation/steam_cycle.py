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
  - State calculations utilize IAPWS-IF97 standard formulations when iapws library is available
  - Simplified empirical correlations retained strictly as a documented fallback if iapws import fails
"""

from dataclasses import dataclass, field
from typing import Optional
import math

try:
    from iapws import IAPWS97
    IAPWS_AVAILABLE = True
except ImportError:
    IAPWS_AVAILABLE = False


@dataclass
class PumpConfig:
    """Boiler feed pump configuration."""
    pump_efficiency_isentropic: float = 0.80  # ASSUMPTION: Centrifugal boiler feed pump isentropic efficiency
    motor_efficiency: float = 0.95            # ASSUMPTION: Electric drive motor efficiency
    inlet_pressure_bar: float = 0.5           # Condenser pressure
    outlet_pressure_bar: float = 10.0         # Boiler operating pressure


@dataclass
class PumpResult:
    """Boiler feed pump calculation results."""
    inlet_pressure_bar: float = 0.5
    outlet_pressure_bar: float = 10.0
    condensate_temp_c: float = 50.0
    enthalpy_inlet_kj_kg: float = 0.0
    enthalpy_outlet_kj_kg: float = 0.0
    work_specific_kj_kg: float = 0.0
    pump_power_shaft_kw: float = 0.0
    pump_power_electrical_kw: float = 0.0
    steam_engine: str = "IAPWS-IF97"
    valid: bool = True
    errors: list = field(default_factory=list)


@dataclass
class SteamConfig:
    """Steam generation configuration."""
    water_flow_kg_h: float = 200.0
    inlet_water_temp_c: float = 50.0  # ASSUMPTION: Closed Rankine loop feedwater returns at condensate temperature
    boiler_efficiency: float = 0.85
    target_steam_pressure_bar: float = 10.0
    target_steam_temp_c: float = 350.0
    latent_heat_kj_kg: float = 2257.0  # at atmospheric, varies with pressure
    derive_from_heat: bool = True  # ASSUMPTION: Feedwater flow matches available syngas heat
    feedwater_enthalpy_kj_kg: Optional[float] = None  # Enthalpy after feed pump (if provided)


@dataclass
class SteamResult:
    """Steam generation results."""
    steam_mass_flow_kg_h: float = 0.0
    steam_temperature_c: float = 0.0
    steam_pressure_bar: float = 0.0
    saturation_temp_c: float = 0.0
    enthalpy_inlet_kj_kg: float = 0.0
    enthalpy_outlet_kj_kg: float = 0.0
    entropy_outlet_kj_kg_k: float = 0.0
    boiler_duty_kw: float = 0.0
    thermal_input_required_kw: float = 0.0
    is_superheated: bool = False
    steam_engine: str = "IAPWS-IF97"  # "IAPWS-IF97" or "SIMPLIFIED_FALLBACK"
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


def calculate_feed_pump(
    steam_flow_kg_h: float,
    condensate_temp_c: float = 50.0,
    config: Optional[PumpConfig] = None,
) -> PumpResult:
    """
    Calculate feed pump work and discharge feedwater enthalpy from condenser pressure to boiler pressure.
    Isentropic pump work: w_pump,s = v_cond × (P_boiler - P_condenser)
    Actual pump work: w_pump,act = w_pump,s / eta_pump
    Discharge enthalpy: h_feedwater = h_condensate + w_pump,act
    """
    if config is None:
        config = PumpConfig()
    result = PumpResult(
        inlet_pressure_bar=config.inlet_pressure_bar,
        outlet_pressure_bar=config.outlet_pressure_bar,
        condensate_temp_c=condensate_temp_c,
    )
    if steam_flow_kg_h <= 0:
        return result

    p_in_bar = config.inlet_pressure_bar
    p_out_bar = config.outlet_pressure_bar
    dp_kpa = max(0.0, (p_out_bar - p_in_bar) * 100.0)

    engine_used = "SIMPLIFIED_FALLBACK"
    h_in = CP_WATER * condensate_temp_c
    v_liquid = 0.001012  # m³/kg at ~50 °C

    if IAPWS_AVAILABLE:
        try:
            p_in_mpa = p_in_bar * 0.1
            st_in = IAPWS97(T=condensate_temp_c + 273.15, P=p_in_mpa)
            h_in = st_in.h
            v_liquid = st_in.v
            engine_used = "IAPWS-IF97"
        except Exception:
            engine_used = "SIMPLIFIED_FALLBACK"

    w_pump_s = v_liquid * dp_kpa  # kJ/kg
    eta_p = max(0.1, config.pump_efficiency_isentropic)
    w_pump_act = w_pump_s / eta_p
    h_out = h_in + w_pump_act

    result.enthalpy_inlet_kj_kg = h_in
    result.enthalpy_outlet_kj_kg = h_out
    result.work_specific_kj_kg = w_pump_act
    result.pump_power_shaft_kw = steam_flow_kg_h * w_pump_act / 3600.0
    result.pump_power_electrical_kw = result.pump_power_shaft_kw / max(0.1, config.motor_efficiency)
    result.steam_engine = engine_used
    return result


def calculate_steam_generation(
    config: SteamConfig,
    available_thermal_kw: float
) -> SteamResult:
    """
    Calculate steam generation from available thermal energy.
    Uses IAPWS-IF97 standard formulations when available with documented fallback.
    
    Process:
    1. Calculate saturation conditions and steam outlet enthalpy at target pressure/temperature
    2. Calculate feedwater inlet enthalpy (after feed pump or from inlet temperature)
    3. Determine steam mass flow rate from available boiler duty: m = Q / Δh
    4. Calculate actual boiler heat duty transferred to steam
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

    target_press_bar = config.target_steam_pressure_bar
    target_temp_c = config.target_steam_temp_c
    
    # 1. Saturation conditions and outlet enthalpy
    t_sat = saturation_temperature(target_press_bar)
    h_outlet = calculate_steam_enthalpy(target_temp_c, target_press_bar)
    s_outlet = 0.0
    engine_used = "SIMPLIFIED_FALLBACK"

    if IAPWS_AVAILABLE:
        try:
            p_mpa = target_press_bar * 0.1
            sat_st = IAPWS97(P=p_mpa, x=1.0)
            t_sat = sat_st.T - 273.15
            
            st_target = IAPWS97(T=target_temp_c + 273.15, P=p_mpa)
            h_outlet = st_target.h
            s_outlet = st_target.s
            engine_used = "IAPWS-IF97"
        except Exception:
            engine_used = "SIMPLIFIED_FALLBACK"

    result.saturation_temp_c = t_sat
    result.steam_pressure_bar = target_press_bar
    result.steam_temperature_c = target_temp_c
    result.enthalpy_outlet_kj_kg = h_outlet
    result.entropy_outlet_kj_kg_k = s_outlet
    result.is_superheated = target_temp_c > t_sat

    # 2. Feedwater inlet enthalpy
    if config.feedwater_enthalpy_kj_kg is not None:
        h_inlet = config.feedwater_enthalpy_kj_kg
    else:
        if IAPWS_AVAILABLE and engine_used == "IAPWS-IF97":
            try:
                fw_st = IAPWS97(T=config.inlet_water_temp_c + 273.15, P=target_press_bar * 0.1)
                h_inlet = fw_st.h
            except Exception:
                h_inlet = CP_WATER * config.inlet_water_temp_c
        else:
            h_inlet = CP_WATER * config.inlet_water_temp_c

    result.enthalpy_inlet_kj_kg = h_inlet
    result.steam_engine = engine_used

    # 3. Energy per kg of steam
    delta_h = h_outlet - h_inlet
    if delta_h <= 0:
        result.valid = False
        result.errors.append("Enthalpy difference is non-positive")
        return result

    available_boiler_kw = available_thermal_kw * config.boiler_efficiency
    max_steam_kg_h = (available_boiler_kw * 3600.0) / delta_h

    if config.derive_from_heat:
        result.steam_mass_flow_kg_h = max_steam_kg_h
    else:
        result.steam_mass_flow_kg_h = min(config.water_flow_kg_h, max_steam_kg_h)

    result.boiler_duty_kw = result.steam_mass_flow_kg_h * delta_h / 3600.0
    result.thermal_input_required_kw = result.boiler_duty_kw / config.boiler_efficiency
    
    return result
