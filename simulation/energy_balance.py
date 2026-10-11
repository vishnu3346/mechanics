"""
Energy Balance Module
=====================
Calculates energy flows through the waste-to-energy system.

Energy streams:
  Chemical energy in waste → Gasification → Syngas thermal energy
  → Boiler → Steam enthalpy → Turbine → Electrical power
  → Heat exchanger → Hot water recovery

Overall efficiency:
  η_overall = (W_electrical + Q_recovered) / Q_chemical_input

Assumptions:
  - Heat losses estimated as fraction of thermal energy
  - Radiation and convection losses = 5% of thermal input
  - Unaccounted losses = 2%
"""

from dataclasses import dataclass, field


@dataclass
class EnergyBalanceResult:
    """Energy balance calculation results."""
    chemical_energy_input_kw: float = 0.0
    gasification_thermal_kw: float = 0.0
    sensible_gas_energy_kw: float = 0.0
    boiler_energy_kw: float = 0.0
    turbine_power_kw: float = 0.0
    heat_recovery_kw: float = 0.0
    radiation_losses_kw: float = 0.0
    convection_losses_kw: float = 0.0
    unaccounted_losses_kw: float = 0.0
    total_losses_kw: float = 0.0
    total_useful_energy_kw: float = 0.0
    overall_efficiency: float = 0.0
    gasification_efficiency: float = 0.0
    power_generation_efficiency: float = 0.0
    heat_recovery_efficiency: float = 0.0
    valid: bool = True
    details: dict = field(default_factory=dict)


def calculate_energy_balance(
    chemical_energy_kw: float,
    gasification_thermal_kw: float,
    boiler_energy_kw: float,
    turbine_power_kw: float,
    heat_recovery_kw: float,
    radiation_loss_fraction: float = 0.05,
    convection_loss_fraction: float = 0.03,
    unaccounted_fraction: float = 0.02,
) -> EnergyBalanceResult:
    """
    Calculate complete energy balance across the WtE system.
    
    Energy flow:
      Q_chem → Q_gasification → Q_boiler → W_turbine + Q_hx + Q_losses
    
    Parameters:
      chemical_energy_kw: Chemical energy in waste feedstock (kW)
      gasification_thermal_kw: Thermal energy in syngas (kW)
      boiler_energy_kw: Energy transferred to steam in boiler (kW)
      turbine_power_kw: Electrical power from turbine (kW)
      heat_recovery_kw: Heat recovered in heat exchanger (kW)
      radiation_loss_fraction: Radiation heat loss as fraction of input
      convection_loss_fraction: Convection heat loss as fraction of input
      unaccounted_fraction: Unaccounted energy losses
    """
    result = EnergyBalanceResult()
    
    result.chemical_energy_input_kw = chemical_energy_kw
    result.gasification_thermal_kw = gasification_thermal_kw
    result.boiler_energy_kw = boiler_energy_kw
    result.turbine_power_kw = turbine_power_kw
    result.heat_recovery_kw = heat_recovery_kw
    
    # Sensible heat in gas (approximation: gas exits at elevated temperature)
    # Cp_gas ≈ 1.1 kJ/(kg·K), ΔT ≈ 300K above ambient
    result.sensible_gas_energy_kw = gasification_thermal_kw * 0.15
    
    # Losses
    result.radiation_losses_kw = chemical_energy_kw * radiation_loss_fraction
    result.convection_losses_kw = chemical_energy_kw * convection_loss_fraction
    result.unaccounted_losses_kw = chemical_energy_kw * unaccounted_fraction
    result.total_losses_kw = (
        result.radiation_losses_kw + 
        result.convection_losses_kw + 
        result.unaccounted_losses_kw
    )
    
    # Total useful energy
    result.total_useful_energy_kw = turbine_power_kw + heat_recovery_kw
    
    # Efficiencies
    if chemical_energy_kw > 0:
        result.overall_efficiency = result.total_useful_energy_kw / chemical_energy_kw
        result.gasification_efficiency = gasification_thermal_kw / chemical_energy_kw
    
    if gasification_thermal_kw > 0:
        result.power_generation_efficiency = turbine_power_kw / gasification_thermal_kw
    
    if boiler_energy_kw > 0:
        result.heat_recovery_efficiency = heat_recovery_kw / boiler_energy_kw if boiler_energy_kw > 0 else 0.0
    
    # Clamp efficiencies
    result.overall_efficiency = min(1.0, max(0.0, result.overall_efficiency))
    result.gasification_efficiency = min(1.0, max(0.0, result.gasification_efficiency))
    result.power_generation_efficiency = min(1.0, max(0.0, result.power_generation_efficiency))
    
    result.details = {
        "chemical_input_kw": round(chemical_energy_kw, 2),
        "gasification_thermal_kw": round(gasification_thermal_kw, 2),
        "boiler_energy_kw": round(boiler_energy_kw, 2),
        "turbine_power_kw": round(turbine_power_kw, 2),
        "heat_recovery_kw": round(heat_recovery_kw, 2),
        "total_losses_kw": round(result.total_losses_kw, 2),
        "total_useful_kw": round(result.total_useful_energy_kw, 2),
        "overall_efficiency": round(result.overall_efficiency * 100, 2),
        "gasification_efficiency": round(result.gasification_efficiency * 100, 2),
        "power_gen_efficiency": round(result.power_generation_efficiency * 100, 2),
    }
    
    return result
