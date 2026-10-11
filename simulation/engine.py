"""
Central Simulation Engine
=========================
Orchestrates the complete waste-to-energy simulation pipeline.

Sequence:
  1. Load scenario parameters
  2. Calculate feedstock properties
  3. Run gasification model
  4. Calculate mass balance
  5. Compute anomaly features
  6. Run ML anomaly prediction
  7. Generate steam
  8. Calculate turbine power
  9. Run heat exchanger
  10. Calculate energy balance
  11. Return structured results
"""

import time
import uuid
import json
from dataclasses import dataclass, field, asdict
from typing import Optional, Any

from simulation.feedstock import (
    FeedstockConfig, ProximateAnalysis, UltimateAnalysis, 
    WasteComposition, calculate_feedstock
)
from simulation.gasifier import GasifierConfig, calculate_gasification
from simulation.mass_balance import calculate_mass_balance
from simulation.steam_cycle import (
    SteamConfig, calculate_steam_generation, calculate_feed_pump, PumpConfig
)
from simulation.turbine import TurbineConfig, calculate_turbine
from simulation.heat_exchanger import HeatExchangerConfig, calculate_heat_exchanger
from simulation.energy_balance import calculate_energy_balance
from simulation.fluidization import FluidizationConfig, calculate_fluidization


def calculate_stoichiometric_airflow(
    waste_feed_kg_h: float = 500.0,
    moisture_pct: float = 15.0,
    carbon: float = 0.54,
    hydrogen: float = 0.055,
    oxygen: float = 0.32,
    sulfur: float = 0.002,
    target_er: float = 0.30,
) -> float:
    """
    Compute stoichiometric air flow in normal conditions (Nm³/h at 0 °C, 101.325 kPa)
    for a target equivalence ratio, based on the fuel's elemental analysis.
    """
    dry_fuel = waste_feed_kg_h * (1.0 - moisture_pct / 100.0)
    c_in = dry_fuel * carbon
    h_in = dry_fuel * hydrogen
    o_in = dry_fuel * oxygen
    s_in = dry_fuel * sulfur
    o2_stoich = max(0.0, (c_in * 32.0 / 12.011) + (h_in * 16.0 / 2.016) - o_in + (s_in * 32.0 / 32.065))
    o2_req = target_er * o2_stoich
    # Air is 23.3% O2 by mass; standard normal air density = 1.2923 kg/Nm³
    air_mass = o2_req / 0.233
    rho_normal = 101325.0 / (287.058 * 273.15)
    airflow_nm3_h = air_mass / rho_normal
    return round(airflow_nm3_h, 1)


# Default baseline airflow at ER = 0.30 for standard feed (500 kg/h, 15% moisture)
DEFAULT_AIRFLOW_NM3_H = calculate_stoichiometric_airflow(500.0, 15.0, target_er=0.30)  # ~661.0 Nm³/h


@dataclass
class ScenarioParams:
    """Complete scenario parameters."""
    name: str = "Normal Operation"
    waste_feed_kg_h: float = 500.0
    moisture_pct: float = 15.0
    plastic_ratio: float = 0.20
    organic_ratio: float = 0.50
    glass_ratio: float = 0.10
    infectious_ratio: float = 0.20
    airflow_m3_h: float = DEFAULT_AIRFLOW_NM3_H
    reactor_temp_c: float = 850.0
    pressure_kpa: float = 101.325
    water_flow_kg_h: float = 200.0
    boiler_efficiency: float = 0.85
    turbine_efficiency: float = 0.75
    # Ultimate analysis (dry basis, fractions)
    carbon: float = 0.54
    hydrogen: float = 0.055
    oxygen: float = 0.32
    nitrogen: float = 0.015
    sulfur: float = 0.002
    chlorine: float = 0.008
    ash: float = 0.05
    # Hydrodynamic particle & agglomeration parameters
    agglomeration_index: float = 0.0  # Particle agglomeration index [0.0 = clean bed, 1.0 = fully agglomerated]
    d_p: float = 400e-6               # Base particle diameter (m)


# Predefined scenarios (re-based relative to ER=0.30 baseline of 661.0 Nm³/h)
SCENARIOS = {
    "normal": ScenarioParams(
        name="Normal Operation",
        waste_feed_kg_h=500, moisture_pct=15, plastic_ratio=0.20,
        organic_ratio=0.50, airflow_m3_h=DEFAULT_AIRFLOW_NM3_H, reactor_temp_c=850,
        agglomeration_index=0.0,
    ),
    "high_plastic": ScenarioParams(
        name="High Plastic Waste",
        waste_feed_kg_h=500, moisture_pct=12, plastic_ratio=0.45,
        organic_ratio=0.30,
        airflow_m3_h=round(DEFAULT_AIRFLOW_NM3_H * 125.0 / 120.0, 1),  # 688.5 Nm³/h
        reactor_temp_c=860,
        agglomeration_index=0.0,
    ),
    "high_moisture": ScenarioParams(
        name="High Moisture Waste",
        waste_feed_kg_h=500, moisture_pct=35, plastic_ratio=0.15,
        organic_ratio=0.45,
        airflow_m3_h=round(DEFAULT_AIRFLOW_NM3_H * 130.0 / 120.0, 1),  # 716.1 Nm³/h
        reactor_temp_c=840,
        agglomeration_index=0.0,
    ),
    "early_agglomeration": ScenarioParams(
        name="Early Agglomeration",
        waste_feed_kg_h=500, moisture_pct=15, plastic_ratio=0.40,
        organic_ratio=0.35,
        airflow_m3_h=round(DEFAULT_AIRFLOW_NM3_H * 115.0 / 120.0, 1),  # 633.5 Nm³/h
        reactor_temp_c=820,
        agglomeration_index=0.25,
    ),
    "severe_clumping": ScenarioParams(
        name="Severe Clumping",
        waste_feed_kg_h=500, moisture_pct=18, plastic_ratio=0.50,
        organic_ratio=0.25,
        airflow_m3_h=round(DEFAULT_AIRFLOW_NM3_H * 95.0 / 120.0, 1),   # 523.3 Nm³/h
        reactor_temp_c=750,
        agglomeration_index=0.50,
    ),
    "high_throughput": ScenarioParams(
        name="High Throughput",
        waste_feed_kg_h=800, moisture_pct=15, plastic_ratio=0.20,
        organic_ratio=0.50,
        airflow_m3_h=calculate_stoichiometric_airflow(800.0, 15.0, target_er=0.30),  # 1057.6 Nm³/h
        reactor_temp_c=870,
        water_flow_kg_h=350,
        agglomeration_index=0.0,
    ),
    "low_airflow": ScenarioParams(
        name="Low Airflow",
        waste_feed_kg_h=500, moisture_pct=15, plastic_ratio=0.25,
        organic_ratio=0.45,
        airflow_m3_h=round(DEFAULT_AIRFLOW_NM3_H * 80.0 / 120.0, 1),   # 440.7 Nm³/h
        reactor_temp_c=800,
        agglomeration_index=0.0,
    ),
    "defluidized_agglomeration": ScenarioParams(
        name="Defluidized Bed Agglomeration",
        waste_feed_kg_h=500.0,
        moisture_pct=15.0,
        plastic_ratio=0.20,
        organic_ratio=0.50,
        airflow_m3_h=DEFAULT_AIRFLOW_NM3_H,  # 661.0 Nm³/h (standard nominal baseline airflow)
        reactor_temp_c=850.0,                # 850.0 °C (standard nominal baseline temperature)
        agglomeration_index=0.85,            # Defluidization arises SOLELY from agglomeration growth (d_eff=2.1 mm, Umf_eff=1.23 m/s > U0=0.57 m/s)
    ),
}


def compute_reactor_heat_balance(
    waste_feed_kg_h: float,
    moisture_pct: float,
    airflow_m3_h: float,
    reactor_temp_c: float,
    thermal_energy_kw: float,
    char_ash_kg_h: float,
    ash_fraction: float = 0.05,
    feedstock_lhv_mj_kg: float = 18.812,
) -> dict:
    """
    Compute reactor energy balance across the fluidized bed:
    1. Sensible & evaporation heat demand:
       - Moisture evaporation & superheating to bed temperature
       - Dry feedstock sensible heating to bed temperature (Cp_feed ~ 1.65 kJ/kg·K)
       - Air sensible heating to bed temperature (Cp_air ~ 1.085 kJ/kg·K)
       - Reactor wall heat loss (ASSUMPTION: 2% of feedstock chemical input)
    2. Exothermic oxidation minus endothermic gasification chemical heat release:
       - Q_released = Q_chem_in - Q_syngas_chem - Q_char_chem
    3. Net heat surplus or deficit:
       - Q_net = Q_released - Q_demand
       - If Q_net >= 0: Autothermal (self-sustaining at bed temperature)
       - If Q_net < 0: Allothermal (requires external heat input)
    """
    t0 = 20.0
    t_bed = reactor_temp_c
    dt = max(0.0, t_bed - t0)

    # Mass flows (kg/s)
    m_waste = waste_feed_kg_h / 3600.0
    m_moist = m_waste * (moisture_pct / 100.0)
    m_dry = m_waste * (1.0 - moisture_pct / 100.0)
    # Air mass: airflow_nm3_h * rho_air_NTP (1.2923 kg/Nm3) / 3600
    m_air = (airflow_m3_h * 1.2923) / 3600.0

    # 1. Heat demands (kW)
    # Steam enthalpy relative to 20 °C water
    h_evap_superheat = 2257.0 + 4.18 * (100.0 - t0) + 2.01 * max(0.0, t_bed - 100.0)
    q_moisture = m_moist * h_evap_superheat

    # Dry feed sensible heating: Cp ~ 1.65 kJ/(kg·K)
    q_sens_feed = m_dry * 1.65 * dt

    # Air sensible heating: Cp ~ 1.085 kJ/(kg·K)
    q_sens_air = m_air * 1.085 * dt

    # Feedstock chemical input (kW)
    chem_in_kw = (waste_feed_kg_h * feedstock_lhv_mj_kg * 1000.0) / 3600.0

    # Reactor wall heat losses: 2% of fuel chemical input (ASSUMPTION)
    q_wall_loss = 0.02 * chem_in_kw

    total_demand_kw = q_moisture + q_sens_feed + q_sens_air + q_wall_loss

    # 2. Chemical energy released (kW)
    syngas_chem_kw = thermal_energy_kw
    dry_feed_kg_h = waste_feed_kg_h * (1.0 - moisture_pct / 100.0)
    ash_kg_h = dry_feed_kg_h * (ash_fraction if ash_fraction <= 1.0 else ash_fraction / 100.0)
    unreacted_c_kg_h = max(0.0, char_ash_kg_h - ash_kg_h)
    char_chem_kw = (unreacted_c_kg_h * 32.8 * 1000.0) / 3600.0

    q_chem_released = chem_in_kw - syngas_chem_kw - char_chem_kw

    # 3. Net heat balance (kW)
    net_heat_balance_kw = q_chem_released - total_demand_kw
    is_autothermal = net_heat_balance_kw >= 0.0
    regime = "AUTOTHERMAL" if is_autothermal else "ALLOTHERMAL"

    if is_autothermal:
        note = f"Autothermal operation (+{net_heat_balance_kw:.1f} kW surplus): partial oxidation releases sufficient exothermic heat to sustain {reactor_temp_c:.0f} °C bed temperature without external heating."
    else:
        note = f"Allothermal operation ({net_heat_balance_kw:.1f} kW deficit): oxidation heat is insufficient to sustain {reactor_temp_c:.0f} °C; requires external heating or bed preheating."

    return {
        "sensible_evaporation_demand_kw": round(total_demand_kw, 2),
        "moisture_evaporation_demand_kw": round(q_moisture, 2),
        "feed_sensible_demand_kw": round(q_sens_feed, 2),
        "air_sensible_demand_kw": round(q_sens_air, 2),
        "wall_loss_kw": round(q_wall_loss, 2),
        "exothermic_heat_released_kw": round(q_chem_released, 2),
        "syngas_chemical_kw": round(syngas_chem_kw, 2),
        "char_chemical_kw": round(char_chem_kw, 2),
        "net_heat_balance_kw": round(net_heat_balance_kw, 2),
        "regime": regime,
        "is_autothermal": is_autothermal,
        "note": note,
    }


def run_simulation(params: ScenarioParams, anomaly_predictor=None) -> dict:
    """
    Run the complete simulation pipeline.
    
    Returns a structured dictionary with all simulation results.
    """
    sim_id = str(uuid.uuid4())[:8]
    timestamp = time.time()
    
    # 1. Feedstock
    feedstock_config = FeedstockConfig(
        mass_flow_kg_h=params.waste_feed_kg_h,
        proximate=ProximateAnalysis(
            moisture=params.moisture_pct,
            volatile_matter=70.0,
            fixed_carbon=10.0,
            ash=params.ash * 100 if params.ash < 1 else params.ash,
        ),
        ultimate=UltimateAnalysis(
            carbon=params.carbon * 100 if params.carbon < 1 else params.carbon,
            hydrogen=params.hydrogen * 100 if params.hydrogen < 1 else params.hydrogen,
            oxygen=params.oxygen * 100 if params.oxygen < 1 else params.oxygen,
            nitrogen=params.nitrogen * 100 if params.nitrogen < 1 else params.nitrogen,
            sulfur=params.sulfur * 100 if params.sulfur < 1 else params.sulfur,
            chlorine=params.chlorine * 100 if params.chlorine < 1 else params.chlorine,
            ash=params.ash * 100 if params.ash < 1 else params.ash,
        ),
    )
    # Normalize waste stream composition fractions so they sum to 100%
    p_plastic = params.plastic_ratio * 100 if params.plastic_ratio <= 1 else params.plastic_ratio
    p_organic = params.organic_ratio * 100 if params.organic_ratio <= 1 else params.organic_ratio
    p_glass = params.glass_ratio * 100 if params.glass_ratio <= 1 else params.glass_ratio
    p_infectious = params.infectious_ratio * 100 if params.infectious_ratio <= 1 else params.infectious_ratio
    tot_comp = p_plastic + p_organic + p_glass + p_infectious
    if tot_comp > 0 and abs(tot_comp - 100.0) > 0.01:
        p_plastic = (p_plastic / tot_comp) * 100.0
        p_organic = (p_organic / tot_comp) * 100.0
        p_glass = (p_glass / tot_comp) * 100.0
        p_infectious = (p_infectious / tot_comp) * 100.0

    feedstock_config.composition = WasteComposition(
        plastic_fraction=p_plastic,
        organic_fraction=p_organic,
        glass_fraction=p_glass,
        infectious_fraction=p_infectious,
    )
    
    # Adjust proximate to sum to 100
    prox = feedstock_config.proximate
    remaining = 100.0 - prox.moisture - prox.ash
    if remaining > 0:
        prox.volatile_matter = remaining * 0.875
        prox.fixed_carbon = remaining * 0.125
    
    feedstock_result = calculate_feedstock(feedstock_config)
    
    # 2. Gasification
    gasifier_config = GasifierConfig(
        waste_feed_kg_h=params.waste_feed_kg_h,
        moisture_pct=params.moisture_pct,
        airflow_m3_h=params.airflow_m3_h,
        reactor_temp_c=params.reactor_temp_c,
        pressure_kpa=params.pressure_kpa,
        plastic_ratio=params.plastic_ratio,
        organic_ratio=params.organic_ratio,
        ash_fraction=params.ash,
        carbon=params.carbon,
        hydrogen=params.hydrogen,
        oxygen=params.oxygen,
        nitrogen=params.nitrogen,
        sulfur=params.sulfur,
        chlorine=params.chlorine,
        feedstock_lhv_mj_kg=feedstock_result.lhv_mj_kg,
    )
    gasification_result = calculate_gasification(gasifier_config)
    
    # 3. Mass balance
    mass_balance_result = calculate_mass_balance(
        waste_feed_kg_h=params.waste_feed_kg_h,
        airflow_m3_h=params.airflow_m3_h,
        gas_output_kg_h=gasification_result.gas_mass_flow_kg_h,
        solid_output_kg_h=gasification_result.char_ash_kg_h,
        moisture_pct=params.moisture_pct,
    )
    
    # 4. Fluidization Hydrodynamics & Anomaly detection
    fluid_config = FluidizationConfig()
    fluid_result = calculate_fluidization(
        airflow_m3_h=params.airflow_m3_h,
        reactor_temp_c=params.reactor_temp_c,
        pressure_kpa=params.pressure_kpa,
        plastic_ratio=params.plastic_ratio,
        config=fluid_config,
        agglomeration_index=getattr(params, "agglomeration_index", 0.0),
        d_p=getattr(params, "d_p", 400e-6),
    )
    # Total pressure drop (kPa) derived from bed buoyant weight and distributor drop
    pressure_drop = fluid_result.dp_total_kpa
    
    anomaly_features = {
        "bed_temperature": params.reactor_temp_c,
        "airflow": params.airflow_m3_h,
        "pressure_drop": round(pressure_drop, 2),
        "plastic_ratio": params.plastic_ratio * 100 if params.plastic_ratio <= 1 else params.plastic_ratio,
    }
    
    # Derived features (compatible with existing ML model pipeline)
    base_af = DEFAULT_AIRFLOW_NM3_H
    anomaly_features["temperature_gradient"] = (850 - params.reactor_temp_c) / 100
    anomaly_features["airflow_deviation"] = (base_af - params.airflow_m3_h) / base_af if base_af > 0 else 0.0
    anomaly_features["pressure_deviation"] = (pressure_drop - 8.58) / 8.58
    
    # Baseline recommendation aligned with physics state
    if fluid_result.physics_state == "SEVERE_CLUMPING":
        rec = "Severe bed agglomeration or defluidization detected. Reduce plastic feed ratio, increase airflow, and raise bed temperature."
    elif fluid_result.physics_state == "EARLY_AGGLOMERATION":
        rec = "Early signs of bed agglomeration detected. Monitor closely. Consider reducing plastic fraction or increasing airflow."
    else:
        rec = "System operating within normal parameters."

    anomaly_result = {
        "state": fluid_result.physics_state,
        "confidence": 0.88,
        "risk_level": fluid_result.physics_risk_level,
        "features": anomaly_features,
        "recommendation": rec,
        "physics_label": fluid_result.physics_state,
        "physics_reason": fluid_result.physics_reason,
        "model_loaded": False,
    }
    
    # Use ML model if available
    if anomaly_predictor is not None:
        try:
            model_input_features = dict(anomaly_features)
            # Map airflow and pressure drop to pre-trained model distribution (mean ~120 and ~15.2)
            model_input_features["airflow"] = 120.0 * (params.airflow_m3_h / base_af) if base_af > 0 else params.airflow_m3_h
            model_input_features["pressure_drop"] = 15.2 * (pressure_drop / 8.58) if pressure_drop > 0 else pressure_drop
            prediction = anomaly_predictor(model_input_features)
            anomaly_result.update(prediction)
            anomaly_result["physics_label"] = fluid_result.physics_state
            anomaly_result["physics_reason"] = fluid_result.physics_reason
            anomaly_result["model_loaded"] = True
        except Exception as e:
            anomaly_result["model_error"] = str(e)
    
    # 5. Feed Pump & Steam generation (closed Rankine loop with IAPWS-IF97)
    # 5a. Initial feed pump calculation at design flow (50 °C condensate return -> 10 bar)
    pump_pre = calculate_feed_pump(params.water_flow_kg_h, condensate_temp_c=50.0)
    
    # 5b. Steam generation using post-pump feedwater enthalpy
    steam_config = SteamConfig(
        water_flow_kg_h=params.water_flow_kg_h,
        inlet_water_temp_c=50.0,  # ASSUMPTION: Closed Rankine cycle feedwater returns at condensate temperature
        boiler_efficiency=params.boiler_efficiency,
        target_steam_pressure_bar=10.0,
        target_steam_temp_c=350.0,
        feedwater_enthalpy_kj_kg=pump_pre.enthalpy_outlet_kj_kg,
    )
    steam_result = calculate_steam_generation(
        steam_config, gasification_result.thermal_energy_kw
    )

    # 5c. Feed pump sized to actual generated steam mass flow
    pump_result = calculate_feed_pump(
        steam_result.steam_mass_flow_kg_h, condensate_temp_c=50.0
    )
    
    # 6. Turbine
    turbine_config = TurbineConfig(
        efficiency_isentropic=params.turbine_efficiency,
    )
    turbine_result = calculate_turbine(
        steam_flow_kg_h=steam_result.steam_mass_flow_kg_h,
        inlet_enthalpy_kj_kg=steam_result.enthalpy_outlet_kj_kg,
        inlet_temp_c=steam_result.steam_temperature_c,
        inlet_pressure_bar=steam_result.steam_pressure_bar,
        config=turbine_config,
    )
    
    # 7. Heat exchanger (dynamic district water sizing and condensation duty)
    hx_config = HeatExchangerConfig(
        auto_water_flow=True,
        target_hot_water_temp_c=70.0,
        condensate_return_temp_c=50.0,
    )
    hx_result = calculate_heat_exchanger(
        steam_flow_kg_h=steam_result.steam_mass_flow_kg_h,
        steam_inlet_temp_c=turbine_result.exhaust_temperature_c,
        steam_inlet_enthalpy_kj_kg=turbine_result.exhaust_enthalpy_kj_kg,
        config=hx_config,
    )
    
    # 8. Reactor energy balance (sensible/evaporative demand vs oxidation heat release)
    reactor_heat_bal = compute_reactor_heat_balance(
        waste_feed_kg_h=params.waste_feed_kg_h,
        moisture_pct=params.moisture_pct,
        airflow_m3_h=params.airflow_m3_h,
        reactor_temp_c=params.reactor_temp_c,
        thermal_energy_kw=gasification_result.thermal_energy_kw,
        char_ash_kg_h=gasification_result.char_ash_kg_h,
        ash_fraction=params.ash,
        feedstock_lhv_mj_kg=feedstock_result.lhv_mj_kg,
    )
    sensible_demand_kw = (
        reactor_heat_bal["moisture_evaporation_demand_kw"] +
        reactor_heat_bal["feed_sensible_demand_kw"] +
        reactor_heat_bal["air_sensible_demand_kw"]
    )

    # 9. Energy balance: Independent Steam Loop and Whole-Plant First-Law Energy Conservation
    energy_result = calculate_energy_balance(
        chemical_energy_kw=feedstock_result.chemical_energy_kw,
        gasification_thermal_kw=gasification_result.thermal_energy_kw,
        boiler_energy_kw=steam_result.boiler_duty_kw,
        turbine_power_kw=turbine_result.electrical_power_kw,
        heat_recovery_kw=hx_result.recovered_heat_kw,
        turbine_shaft_work_kw=turbine_result.turbine_power_kw,
        condenser_heat_kw=hx_result.condenser_heat_kw,
        unrecovered_heat_kw=hx_result.unrecovered_heat_kw,
        cooling_loss_kw=hx_result.cooling_loss_kw,
        pump_power_shaft_kw=pump_result.pump_power_shaft_kw,
        pump_power_electrical_kw=pump_result.pump_power_electrical_kw,
        reactor_wall_loss_kw=reactor_heat_bal["wall_loss_kw"],
        char_chemical_kw=reactor_heat_bal["char_chemical_kw"],
        syngas_sensible_demand_kw=sensible_demand_kw,
    )
    
    # Build result
    result = {
        "scenario_id": sim_id,
        "timestamp": timestamp,
        "scenario_name": params.name,
        "parameters": {
            "waste_feed_kg_h": params.waste_feed_kg_h,
            "moisture_pct": params.moisture_pct,
            "plastic_ratio": round(params.plastic_ratio * 100 if params.plastic_ratio <= 1 else params.plastic_ratio, 1),
            "organic_ratio": round(params.organic_ratio * 100 if params.organic_ratio <= 1 else params.organic_ratio, 1),
            "airflow_m3_h": params.airflow_m3_h,
            "reactor_temp_c": params.reactor_temp_c,
            "pressure_kpa": params.pressure_kpa,
            "water_flow_kg_h": params.water_flow_kg_h,
        },
        "feedstock": {
            "dry_mass_flow_kg_h": round(feedstock_result.dry_mass_flow_kg_h, 2),
            "moisture_flow_kg_h": round(feedstock_result.moisture_flow_kg_h, 2),
            "hhv_mj_kg": round(feedstock_result.hhv_mj_kg, 3),
            "lhv_mj_kg": round(feedstock_result.lhv_mj_kg, 3),
            "chemical_energy_kw": round(feedstock_result.chemical_energy_kw, 2),
            "valid": feedstock_result.valid,
        },
        "gasification": {
            "gas_mass_flow_kg_h": round(gasification_result.gas_mass_flow_kg_h, 2),
            "gas_composition": {k: round(v, 4) for k, v in gasification_result.gas_composition.items()},
            "syngas_flow_nm3_h": round(gasification_result.syngas_flow_nm3_h, 2),
            "syngas_lhv_mj_nm3": round(gasification_result.syngas_lhv_mj_nm3, 3),
            "thermal_energy_kw": round(gasification_result.thermal_energy_kw, 2),
            "carbon_conversion": round(gasification_result.carbon_conversion, 4),
            "equivalence_ratio": round(gasification_result.equivalence_ratio, 4),
            "gasification_efficiency": round(gasification_result.gasification_efficiency, 4),
            "char_ash_kg_h": round(gasification_result.char_ash_kg_h, 2),
            "reactor_heat_balance_kw": reactor_heat_bal["net_heat_balance_kw"],
            "reactor_thermal_regime": reactor_heat_bal["regime"],
            "reactor_heat_balance_note": reactor_heat_bal["note"],
            "reactor_heat_balance": reactor_heat_bal,
        },
        "mass_balance": mass_balance_result.details,
        "fluidization": {
            "u0_m_s": round(fluid_result.u0, 4),
            "umf_m_s": round(fluid_result.umf_wen_yu, 4),
            "umf_wen_yu_m_s": round(fluid_result.umf_wen_yu, 4),
            "umf_ergun_m_s": round(fluid_result.umf_ergun, 4),
            "umf_diff_pct": round(fluid_result.umf_diff_pct, 2),
            "ut_m_s": round(fluid_result.ut, 4),
            "u0_over_umf": round(fluid_result.u0_over_umf, 3),
            "u0_over_umf_eff": round(fluid_result.u0_over_umf_eff, 4),
            "u0_over_ut": round(fluid_result.u0_over_ut, 4),
            "geldart_group": fluid_result.geldart_group,
            "regime": fluid_result.regime,
            "agglomeration_index": round(fluid_result.agglomeration_index, 4),
            "d_eff_m": round(fluid_result.d_eff, 6),
            "defluidization_risk": round(fluid_result.defluidization_risk, 3),
            "umf_effective_m_s": round(fluid_result.umf_effective, 4),
            "dp_bed_kpa": round(fluid_result.dp_bed_kpa, 3),
            "dp_distributor_kpa": round(fluid_result.dp_distributor_kpa, 3),
            "pressure_drop": round(fluid_result.dp_total_kpa, 3),
            "pressure_drop_kpa": round(fluid_result.dp_total_kpa, 3),
            "dp_ratio": round(fluid_result.dp_ratio, 4),
            "gas_density_kg_m3": round(fluid_result.rho_g, 4),
            "gas_viscosity_pa_s": round(fluid_result.mu_g, 6),
            "archimedes": round(fluid_result.archimedes, 2),
            "defluidization_margin": round(fluid_result.defluidization_margin, 3),
            "bubble_diameter_m": round(fluid_result.bubble_diameter_m, 4),
            "bubble_velocity_m_s": round(fluid_result.bubble_velocity_m_s, 4),
            "physics_state": fluid_result.physics_state,
            "physics_risk_level": fluid_result.physics_risk_level,
            "physics_reason": fluid_result.physics_reason,
        },
        # Top-level hydrodynamic and diagnostic keys for direct access
        "equivalence_ratio": round(gasification_result.equivalence_ratio, 4),
        "energy_closure_error_pct": round(energy_result.energy_closure_error_pct, 4),
        "whole_plant_closure_error_pct": round(energy_result.whole_plant_closure_error_pct, 4),
        "steam_loop_closure_error_pct": round(energy_result.steam_loop_closure_error_pct, 4),
        "reactor_heat_balance_kw": reactor_heat_bal["net_heat_balance_kw"],
        "reactor_thermal_regime": reactor_heat_bal["regime"],
        "reactor_heat_balance_note": reactor_heat_bal["note"],
        "u0_m_s": round(fluid_result.u0, 4),
        "umf_m_s": round(fluid_result.umf_wen_yu, 4),
        "umf_wen_yu_m_s": round(fluid_result.umf_wen_yu, 4),
        "umf_ergun_m_s": round(fluid_result.umf_ergun, 4),
        "ut_m_s": round(fluid_result.ut, 4),
        "u0_over_umf": round(fluid_result.u0_over_umf, 3),
        "u0_over_umf_eff": round(fluid_result.u0_over_umf_eff, 4),
        "u0_over_ut": round(fluid_result.u0_over_ut, 4),
        "geldart_group": fluid_result.geldart_group,
        "regime": fluid_result.regime,
        "agglomeration_index": round(fluid_result.agglomeration_index, 4),
        "defluidization_risk": round(fluid_result.defluidization_risk, 3),
        "umf_effective_m_s": round(fluid_result.umf_effective, 4),
        "dp_bed_kpa": round(fluid_result.dp_bed_kpa, 3),
        "dp_distributor_kpa": round(fluid_result.dp_distributor_kpa, 3),
        "pressure_drop": round(fluid_result.dp_total_kpa, 3),
        "dp_ratio": round(fluid_result.dp_ratio, 4),
        "physics_state": fluid_result.physics_state,
        "anomaly": anomaly_result,
        "steam_cycle": {
            "steam_flow_kg_h": round(steam_result.steam_mass_flow_kg_h, 2),
            "steam_temp_c": round(steam_result.steam_temperature_c, 1),
            "steam_pressure_bar": round(steam_result.steam_pressure_bar, 2),
            "boiler_duty_kw": round(steam_result.boiler_duty_kw, 2),
            "enthalpy_in_kj_kg": round(steam_result.enthalpy_inlet_kj_kg, 2),
            "enthalpy_out_kj_kg": round(steam_result.enthalpy_outlet_kj_kg, 2),
            "is_superheated": steam_result.is_superheated,
            "steam_engine": steam_result.steam_engine,
        },
        "feed_pump": {
            "pump_power_shaft_kw": round(pump_result.pump_power_shaft_kw, 3),
            "pump_power_electrical_kw": round(pump_result.pump_power_electrical_kw, 3),
            "enthalpy_in_kj_kg": round(pump_result.enthalpy_inlet_kj_kg, 2),
            "enthalpy_out_kj_kg": round(pump_result.enthalpy_outlet_kj_kg, 2),
            "work_specific_kj_kg": round(pump_result.work_specific_kj_kg, 3),
            "suction_pressure_bar": pump_result.inlet_pressure_bar,
            "discharge_pressure_bar": pump_result.outlet_pressure_bar,
            "condensate_temp_c": pump_result.condensate_temp_c,
            "steam_engine": pump_result.steam_engine,
        },
        "turbine": {
            "turbine_power_kw": round(turbine_result.turbine_power_kw, 2),
            "electrical_power_kw": round(turbine_result.electrical_power_kw, 2),
            "net_electrical_power_kw": round(energy_result.net_electrical_power_kw, 2),
            "enthalpy_drop_kj_kg": round(turbine_result.enthalpy_drop_kj_kg, 2),
            "exhaust_temp_c": round(turbine_result.exhaust_temperature_c, 1),
            "steam_rate_kg_kwh": round(turbine_result.steam_rate_kg_kwh, 2) if turbine_result.steam_rate_kg_kwh else 0,
            "isentropic_efficiency": round(turbine_result.isentropic_efficiency, 4),
            "steam_engine": turbine_result.steam_engine,
        },
        "heat_exchanger": {
            "hot_water_temp_c": round(hx_result.hot_water_outlet_temp_c, 1),
            "recovered_heat_kw": round(hx_result.recovered_heat_kw, 2),
            "exchanger_efficiency": round(hx_result.exchanger_efficiency, 4),
            "lmtd_c": round(hx_result.log_mean_temp_diff_c, 2),
            "steam_available_heat_kw": round(hx_result.steam_available_heat_kw, 2),
            "condenser_heat_kw": round(hx_result.condenser_heat_kw, 2),
            "unrecovered_heat_kw": round(hx_result.unrecovered_heat_kw, 2),
            "water_side_limited": hx_result.water_side_limited,
            "required_water_flow_kg_h": round(hx_result.required_water_flow_kg_h, 2),
            "water_flow_used_kg_h": round(hx_result.water_flow_used_kg_h, 2),
            "cooling_loss_kw": round(hx_result.cooling_loss_kw, 2),
            "steam_engine": hx_result.steam_engine,
        },
        "energy_balance": energy_result.details,
        "whole_plant_closure": {
            "chemical_input_kw": round(feedstock_result.chemical_energy_kw, 2),
            "net_electrical_power_kw": round(energy_result.net_electrical_power_kw, 2),
            "district_heat_kw": round(hx_result.recovered_heat_kw, 2),
            "unrecovered_condenser_heat_kw": round(hx_result.unrecovered_heat_kw, 2),
            "reactor_wall_loss_kw": round(reactor_heat_bal["wall_loss_kw"], 2),
            "char_chemical_energy_kw": round(reactor_heat_bal["char_chemical_kw"], 2),
            "boiler_stack_loss_kw": round(energy_result.boiler_stack_loss_kw, 2),
            "syngas_sensible_stack_losses_kw": round(energy_result.syngas_sensible_stack_losses_kw, 2),
            "whole_plant_output_sum_kw": round(energy_result.whole_plant_output_sum_kw, 2),
            "closure_error_pct": round(energy_result.whole_plant_closure_error_pct, 4),
        },
        "overall": {
            "waste_input_kw": round(feedstock_result.chemical_energy_kw, 2),
            "electrical_output_kw": round(turbine_result.electrical_power_kw, 2),
            "net_power_kw": round(energy_result.net_electrical_power_kw, 2),
            "feed_pump_electrical_kw": round(pump_result.pump_power_electrical_kw, 3),
            "heat_recovery_kw": round(hx_result.recovered_heat_kw, 2),
            "total_useful_kw": round(energy_result.total_useful_energy_kw, 2),
            "overall_efficiency_pct": round(energy_result.overall_efficiency * 100, 2),
            "gasification_efficiency_pct": round(
                gasification_result.gasification_efficiency * 100, 2
            ),
            "cold_gas_efficiency_pct": round(
                gasification_result.gasification_efficiency * 100, 2
            ),
            "energy_closure_error_pct": round(energy_result.energy_closure_error_pct, 4),
            "whole_plant_closure_error_pct": round(energy_result.whole_plant_closure_error_pct, 4),
            "steam_loop_closure_error_pct": round(energy_result.steam_loop_closure_error_pct, 4),
            "reactor_heat_balance_kw": reactor_heat_bal["net_heat_balance_kw"],
            "reactor_thermal_regime": reactor_heat_bal["regime"],
        },
    }
    
    return result


def get_scenario(scenario_id: str) -> ScenarioParams:
    """Get predefined scenario by ID."""
    return SCENARIOS.get(scenario_id, SCENARIOS["normal"])


def list_scenarios() -> list[dict]:
    """List all available scenarios."""
    return [
        {"id": sid, "name": s.name, "description": _scenario_description(sid)}
        for sid, s in SCENARIOS.items()
    ]


def _scenario_description(sid: str) -> str:
    descriptions = {
        "normal": "Standard operating conditions with balanced waste composition.",
        "high_plastic": "Elevated plastic content (45%) - risk of bed agglomeration.",
        "high_moisture": "High moisture content (35%) - reduced gasification efficiency.",
        "early_agglomeration": "Conditions showing early signs of bed agglomeration.",
        "severe_clumping": "Severe clumping conditions with degraded performance.",
        "high_throughput": "Increased waste feed rate at 800 kg/h.",
        "low_airflow": "Reduced airflow conditions affecting fluidization.",
        "defluidized_agglomeration": "Bed agglomeration growth (a=0.85, d_eff=2.1mm) causing complete defluidization under nominal airflow.",
    }
    return descriptions.get(sid, "Custom scenario.")
