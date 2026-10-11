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
from simulation.steam_cycle import SteamConfig, calculate_steam_generation
from simulation.turbine import TurbineConfig, calculate_turbine
from simulation.heat_exchanger import HeatExchangerConfig, calculate_heat_exchanger
from simulation.energy_balance import calculate_energy_balance


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
    airflow_m3_h: float = 120.0
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


# Predefined scenarios
SCENARIOS = {
    "normal": ScenarioParams(
        name="Normal Operation",
        waste_feed_kg_h=500, moisture_pct=15, plastic_ratio=0.20,
        organic_ratio=0.50, airflow_m3_h=120, reactor_temp_c=850,
    ),
    "high_plastic": ScenarioParams(
        name="High Plastic Waste",
        waste_feed_kg_h=500, moisture_pct=12, plastic_ratio=0.45,
        organic_ratio=0.30, airflow_m3_h=125, reactor_temp_c=860,
    ),
    "high_moisture": ScenarioParams(
        name="High Moisture Waste",
        waste_feed_kg_h=500, moisture_pct=35, plastic_ratio=0.15,
        organic_ratio=0.45, airflow_m3_h=130, reactor_temp_c=840,
    ),
    "early_agglomeration": ScenarioParams(
        name="Early Agglomeration",
        waste_feed_kg_h=500, moisture_pct=15, plastic_ratio=0.40,
        organic_ratio=0.35, airflow_m3_h=115, reactor_temp_c=820,
    ),
    "severe_clumping": ScenarioParams(
        name="Severe Clumping",
        waste_feed_kg_h=500, moisture_pct=18, plastic_ratio=0.50,
        organic_ratio=0.25, airflow_m3_h=95, reactor_temp_c=750,
    ),
    "high_throughput": ScenarioParams(
        name="High Throughput",
        waste_feed_kg_h=800, moisture_pct=15, plastic_ratio=0.20,
        organic_ratio=0.50, airflow_m3_h=180, reactor_temp_c=870,
        water_flow_kg_h=350,
    ),
    "low_airflow": ScenarioParams(
        name="Low Airflow",
        waste_feed_kg_h=500, moisture_pct=15, plastic_ratio=0.25,
        organic_ratio=0.45, airflow_m3_h=80, reactor_temp_c=800,
    ),
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
        composition=WasteComposition(
            plastic_fraction=params.plastic_ratio * 100 if params.plastic_ratio <= 1 else params.plastic_ratio,
            organic_fraction=params.organic_ratio * 100 if params.organic_ratio <= 1 else params.organic_ratio,
            glass_fraction=params.glass_ratio * 100 if params.glass_ratio <= 1 else params.glass_ratio,
            infectious_fraction=params.infectious_ratio * 100 if params.infectious_ratio <= 1 else params.infectious_ratio,
        ),
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
    
    # 4. Anomaly detection
    # Calculate pressure drop based on conditions
    base_pressure_drop = 15.2  # kPa normal
    pressure_drop = base_pressure_drop
    if params.plastic_ratio > 0.35:
        pressure_drop += (params.plastic_ratio - 0.35) * 80
    if params.reactor_temp_c < 800:
        pressure_drop += (800 - params.reactor_temp_c) * 0.05
    if params.airflow_m3_h < 100:
        pressure_drop += (100 - params.airflow_m3_h) * 0.1
    
    anomaly_features = {
        "bed_temperature": params.reactor_temp_c,
        "airflow": params.airflow_m3_h,
        "pressure_drop": round(pressure_drop, 2),
        "plastic_ratio": params.plastic_ratio * 100 if params.plastic_ratio <= 1 else params.plastic_ratio,
    }
    
    # Derived features
    anomaly_features["temperature_gradient"] = (850 - params.reactor_temp_c) / 100
    anomaly_features["airflow_deviation"] = (120 - params.airflow_m3_h) / 120
    anomaly_features["pressure_deviation"] = (pressure_drop - 15.2) / 15.2
    
    anomaly_result = {
        "state": "NORMAL_FLUIDIZATION",
        "confidence": 0.85,
        "risk_level": "LOW",
        "features": anomaly_features,
        "recommendation": "System operating within normal parameters.",
        "model_loaded": False,
    }
    
    # Use ML model if available
    if anomaly_predictor is not None:
        try:
            prediction = anomaly_predictor(anomaly_features)
            anomaly_result.update(prediction)
            anomaly_result["model_loaded"] = True
        except Exception as e:
            anomaly_result["model_error"] = str(e)
    else:
        # Rule-based fallback
        plastic_pct = anomaly_features["plastic_ratio"]
        if plastic_pct >= 45 and params.reactor_temp_c < 780 and pressure_drop > 22:
            anomaly_result["state"] = "SEVERE_CLUMPING"
            anomaly_result["confidence"] = 0.92
            anomaly_result["risk_level"] = "CRITICAL"
            anomaly_result["recommendation"] = (
                "Severe bed agglomeration detected. Reduce plastic feed ratio, "
                "increase airflow, and raise bed temperature."
            )
        elif plastic_pct >= 35 and (params.reactor_temp_c < 830 or pressure_drop > 17):
            anomaly_result["state"] = "EARLY_AGGLOMERATION"
            anomaly_result["confidence"] = 0.78
            anomaly_result["risk_level"] = "MEDIUM"
            anomaly_result["recommendation"] = (
                "Early signs of bed agglomeration. Monitor closely. "
                "Consider reducing plastic fraction or increasing airflow."
            )
    
    # 5. Steam generation
    steam_config = SteamConfig(
        water_flow_kg_h=params.water_flow_kg_h,
        inlet_water_temp_c=20.0,
        boiler_efficiency=params.boiler_efficiency,
        target_steam_pressure_bar=10.0,
        target_steam_temp_c=350.0,
    )
    steam_result = calculate_steam_generation(
        steam_config, gasification_result.thermal_energy_kw
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
    
    # 7. Heat exchanger
    hx_config = HeatExchangerConfig(
        cold_water_flow_kg_h=300.0,
        cold_water_inlet_temp_c=20.0,
    )
    hx_result = calculate_heat_exchanger(
        steam_flow_kg_h=steam_result.steam_mass_flow_kg_h,
        steam_inlet_temp_c=turbine_result.exhaust_temperature_c,
        steam_inlet_enthalpy_kj_kg=turbine_result.exhaust_enthalpy_kj_kg,
        config=hx_config,
    )
    
    # 8. Energy balance
    energy_result = calculate_energy_balance(
        chemical_energy_kw=feedstock_result.chemical_energy_kw,
        gasification_thermal_kw=gasification_result.thermal_energy_kw,
        boiler_energy_kw=steam_result.boiler_duty_kw,
        turbine_power_kw=turbine_result.electrical_power_kw,
        heat_recovery_kw=hx_result.recovered_heat_kw,
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
        },
        "mass_balance": mass_balance_result.details,
        "anomaly": anomaly_result,
        "steam_cycle": {
            "steam_flow_kg_h": round(steam_result.steam_mass_flow_kg_h, 2),
            "steam_temp_c": round(steam_result.steam_temperature_c, 1),
            "steam_pressure_bar": round(steam_result.steam_pressure_bar, 2),
            "boiler_duty_kw": round(steam_result.boiler_duty_kw, 2),
            "enthalpy_in_kj_kg": round(steam_result.enthalpy_inlet_kj_kg, 2),
            "enthalpy_out_kj_kg": round(steam_result.enthalpy_outlet_kj_kg, 2),
            "is_superheated": steam_result.is_superheated,
        },
        "turbine": {
            "turbine_power_kw": round(turbine_result.turbine_power_kw, 2),
            "electrical_power_kw": round(turbine_result.electrical_power_kw, 2),
            "enthalpy_drop_kj_kg": round(turbine_result.enthalpy_drop_kj_kg, 2),
            "exhaust_temp_c": round(turbine_result.exhaust_temperature_c, 1),
            "steam_rate_kg_kwh": round(turbine_result.steam_rate_kg_kwh, 2) if turbine_result.steam_rate_kg_kwh else 0,
            "isentropic_efficiency": round(turbine_result.isentropic_efficiency, 4),
        },
        "heat_exchanger": {
            "hot_water_temp_c": round(hx_result.hot_water_outlet_temp_c, 1),
            "recovered_heat_kw": round(hx_result.recovered_heat_kw, 2),
            "exchanger_efficiency": round(hx_result.exchanger_efficiency, 4),
            "lmtd_c": round(hx_result.log_mean_temp_diff_c, 2),
        },
        "energy_balance": energy_result.details,
        "overall": {
            "waste_input_kw": round(feedstock_result.chemical_energy_kw, 2),
            "electrical_output_kw": round(turbine_result.electrical_power_kw, 2),
            "heat_recovery_kw": round(hx_result.recovered_heat_kw, 2),
            "total_useful_kw": round(
                turbine_result.electrical_power_kw + hx_result.recovered_heat_kw, 2
            ),
            "overall_efficiency_pct": round(energy_result.overall_efficiency * 100, 2),
            "gasification_efficiency_pct": round(
                gasification_result.gasification_efficiency * 100, 2
            ),
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
    }
    return descriptions.get(sid, "Custom scenario.")
