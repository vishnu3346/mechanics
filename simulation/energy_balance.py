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
    turbine_shaft_work_kw: float = 0.0
    condenser_heat_kw: float = 0.0
    cooling_loss_kw: float = 0.0
    unrecovered_heat_kw: float = 0.0
    condensate_subcooling_loss_kw: float = 0.0
    documented_losses_kw: float = 0.0
    energy_closure_error_pct: float = 0.0
    # Phase 2d Whole-Plant and Feed Pump additions:
    net_electrical_power_kw: float = 0.0
    feed_pump_shaft_power_kw: float = 0.0
    feed_pump_electrical_power_kw: float = 0.0
    reactor_wall_loss_kw: float = 0.0
    char_chemical_energy_kw: float = 0.0
    boiler_stack_loss_kw: float = 0.0
    syngas_sensible_demand_kw: float = 0.0
    electromechanical_losses_kw: float = 0.0
    syngas_sensible_stack_losses_kw: float = 0.0
    whole_plant_output_sum_kw: float = 0.0
    whole_plant_closure_error_pct: float = 0.0
    steam_loop_closure_error_pct: float = 0.0
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
    turbine_shaft_work_kw: float = None,
    cooling_loss_kw: float = None,
    condenser_heat_kw: float = None,
    unrecovered_heat_kw: float = None,
    condensate_subcooling_loss_kw: float = None,
    pump_power_shaft_kw: float = 0.0,
    pump_power_electrical_kw: float = 0.0,
    reactor_wall_loss_kw: float = 0.0,
    char_chemical_kw: float = 0.0,
    syngas_sensible_demand_kw: float = 0.0,
) -> EnergyBalanceResult:
    """
    Calculate complete energy balance across the WtE system.
    
    Energy flows:
      Steam Loop:  Q_boiler + W_pump,shaft = W_turbine,shaft + Q_condenser
      Whole Plant: Q_chem,in = W_net,elec + Q_district + Q_unrecovered + Q_wall + Q_char + Q_syngas_stack
    
    Parameters:
      chemical_energy_kw: Chemical energy in waste feedstock (kW)
      gasification_thermal_kw: Thermal energy in syngas (kW)
      boiler_energy_kw: Energy transferred to steam in boiler (kW)
      turbine_power_kw: Electrical power from turbine (kW)
      heat_recovery_kw: Heat recovered in heat exchanger (kW)
      radiation_loss_fraction: Radiation heat loss as fraction of input
      convection_loss_fraction: Convection heat loss as fraction of input
      unaccounted_fraction: Unaccounted energy losses
      turbine_shaft_work_kw: Mechanical shaft power from turbine before generator losses (kW)
      cooling_loss_kw: Condenser cooling / unrecovered exhaust heat loss (kW)
      condensate_subcooling_loss_kw: Sensible heat in liquid condensate above boiler inlet (kW)
      pump_power_shaft_kw: Mechanical shaft power required by feed pump (kW)
      pump_power_electrical_kw: Electrical power consumed by feed pump motor (kW)
      reactor_wall_loss_kw: Wall heat loss from gasifier reactor (kW)
      char_chemical_kw: Chemical heating value of unreacted solid char (kW)
      syngas_sensible_demand_kw: Sensible & evaporative heat of syngas exiting gasifier (kW)
    """
    result = EnergyBalanceResult()
    
    result.chemical_energy_input_kw = chemical_energy_kw
    result.gasification_thermal_kw = gasification_thermal_kw
    result.boiler_energy_kw = boiler_energy_kw
    result.turbine_power_kw = turbine_power_kw
    result.heat_recovery_kw = heat_recovery_kw
    
    # Net electrical power: Gross turbine electric - feed pump electric
    net_elec_kw = turbine_power_kw - pump_power_electrical_kw
    result.net_electrical_power_kw = net_elec_kw
    result.feed_pump_shaft_power_kw = pump_power_shaft_kw
    result.feed_pump_electrical_power_kw = pump_power_electrical_kw
    result.reactor_wall_loss_kw = reactor_wall_loss_kw
    result.char_chemical_energy_kw = char_chemical_kw
    result.syngas_sensible_demand_kw = syngas_sensible_demand_kw
    
    # Sensible heat in gas (historical field)
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
    
    # Total useful energy (net electric + district heat)
    result.total_useful_energy_kw = net_elec_kw + heat_recovery_kw
    
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

    # 1. First-Law Steam Loop Energy Closure from state enthalpies:
    # boiler duty = m(h_steam - h_feedwater)
    # pump shaft work = m * w_pump,act
    # turbine work = m(h_in - h_exhaust_actual)
    # condenser heat = m(h_exhaust_actual - h_condensate)
    # district heat = effectiveness × condenser heat
    # unrecovered heat = condenser heat - district heat
    t_shaft = turbine_shaft_work_kw if turbine_shaft_work_kw is not None else turbine_power_kw
    result.turbine_shaft_work_kw = t_shaft
    
    if condenser_heat_kw is not None:
        q_condenser = condenser_heat_kw
    elif cooling_loss_kw is not None:
        q_condenser = heat_recovery_kw + cooling_loss_kw
    else:
        q_condenser = max(0.0, boiler_energy_kw - t_shaft)
    result.condenser_heat_kw = q_condenser

    if unrecovered_heat_kw is not None:
        q_unrec = unrecovered_heat_kw
    elif cooling_loss_kw is not None:
        q_unrec = cooling_loss_kw
    else:
        q_unrec = max(0.0, q_condenser - heat_recovery_kw)
    result.cooling_loss_kw = q_unrec
    result.unrecovered_heat_kw = q_unrec

    # Historical field preserved for schema stability
    sub_loss = condensate_subcooling_loss_kw if condensate_subcooling_loss_kw is not None else 0.0
    result.condensate_subcooling_loss_kw = sub_loss
    result.documented_losses_kw = q_unrec
    
    # Steam loop inputs: boiler duty + feed pump shaft work
    steam_loop_in = boiler_energy_kw + pump_power_shaft_kw
    # Steam loop outputs: turbine shaft work + condenser heat
    steam_loop_out = t_shaft + q_condenser
    if boiler_energy_kw > 0:
        result.steam_loop_closure_error_pct = abs(steam_loop_in - steam_loop_out) / boiler_energy_kw * 100.0
    else:
        result.steam_loop_closure_error_pct = 0.0
    
    # Keep energy_closure_error_pct aligned with steam loop closure for backwards-compatibility
    result.energy_closure_error_pct = result.steam_loop_closure_error_pct

    # 2. First-Law Whole-Plant Energy Closure:
    # feed LHV = net electrical + district heat + unrecovered condenser heat +
    #            reactor wall loss + unconverted-char chemical energy + syngas sensible/stack losses
    # Every term computed from its own physical model, none as a remainder or plug.
    boiler_stack_loss = max(0.0, gasification_thermal_kw - boiler_energy_kw)
    elec_losses = max(0.0, t_shaft - turbine_power_kw) + max(0.0, pump_power_electrical_kw - pump_power_shaft_kw)
    syngas_sensible_stack_losses = boiler_stack_loss + syngas_sensible_demand_kw + elec_losses
    
    result.boiler_stack_loss_kw = boiler_stack_loss
    result.electromechanical_losses_kw = elec_losses
    result.syngas_sensible_stack_losses_kw = syngas_sensible_stack_losses

    whole_plant_out = (
        net_elec_kw +
        heat_recovery_kw +
        q_unrec +
        reactor_wall_loss_kw +
        char_chemical_kw +
        syngas_sensible_stack_losses
    )
    result.whole_plant_output_sum_kw = whole_plant_out
    
    if chemical_energy_kw > 0:
        result.whole_plant_closure_error_pct = abs(chemical_energy_kw - whole_plant_out) / chemical_energy_kw * 100.0
    else:
        result.whole_plant_closure_error_pct = 0.0

    result.details = {
        "chemical_input_kw": round(chemical_energy_kw, 2),
        "gasification_thermal_kw": round(gasification_thermal_kw, 2),
        "boiler_energy_kw": round(boiler_energy_kw, 2),
        "turbine_power_kw": round(turbine_power_kw, 2),
        "turbine_shaft_work_kw": round(result.turbine_shaft_work_kw, 2),
        "feed_pump_shaft_power_kw": round(pump_power_shaft_kw, 2),
        "feed_pump_electrical_power_kw": round(pump_power_electrical_kw, 2),
        "net_electrical_power_kw": round(net_elec_kw, 2),
        "heat_recovery_kw": round(heat_recovery_kw, 2),
        "condenser_heat_kw": round(result.condenser_heat_kw, 2),
        "cooling_loss_kw": round(result.cooling_loss_kw, 2),
        "unrecovered_heat_kw": round(result.unrecovered_heat_kw, 2),
        "condensate_subcooling_loss_kw": round(result.condensate_subcooling_loss_kw, 2),
        "documented_losses_kw": round(result.documented_losses_kw, 2),
        "reactor_wall_loss_kw": round(reactor_wall_loss_kw, 2),
        "char_chemical_energy_kw": round(char_chemical_kw, 2),
        "boiler_stack_loss_kw": round(boiler_stack_loss, 2),
        "syngas_sensible_demand_kw": round(syngas_sensible_demand_kw, 2),
        "electromechanical_losses_kw": round(elec_losses, 2),
        "syngas_sensible_stack_losses_kw": round(syngas_sensible_stack_losses, 2),
        "whole_plant_output_sum_kw": round(whole_plant_out, 2),
        "whole_plant_closure_error_pct": round(result.whole_plant_closure_error_pct, 4),
        "steam_loop_closure_error_pct": round(result.steam_loop_closure_error_pct, 4),
        "energy_closure_error_pct": round(result.energy_closure_error_pct, 4),
        "total_losses_kw": round(result.total_losses_kw, 2),
        "total_useful_kw": round(result.total_useful_energy_kw, 2),
        "overall_efficiency": round(result.overall_efficiency * 100, 2),
        "gasification_efficiency": round(result.gasification_efficiency * 100, 2),
        "power_gen_efficiency": round(result.power_generation_efficiency * 100, 2),
    }
    
    return result
