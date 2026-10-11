"""
Unit tests for the thermodynamic and thermochemical simulation modules.
"""

import pytest
from simulation.feedstock import calculate_feedstock, FeedstockConfig, ProximateAnalysis, WasteComposition
from simulation.gasifier import calculate_gasification, GasifierConfig
from simulation.mass_balance import calculate_mass_balance
from simulation.steam_cycle import calculate_steam_generation, SteamConfig
from simulation.turbine import calculate_turbine, TurbineConfig
from simulation.heat_exchanger import calculate_heat_exchanger, HeatExchangerConfig
from simulation.energy_balance import calculate_energy_balance
from simulation.engine import run_simulation, ScenarioParams, SCENARIOS, list_scenarios, get_scenario


def test_feedstock_calculation():
    config = FeedstockConfig(
        mass_flow_kg_h=500.0,
        proximate=ProximateAnalysis(moisture=15.0, volatile_matter=70.0, fixed_carbon=10.0, ash=5.0),
        composition=WasteComposition(
            plastic_fraction=20.0,
            organic_fraction=50.0,
            glass_fraction=10.0,
            infectious_fraction=20.0,
        )
    )
    res = calculate_feedstock(config)
    assert res.dry_mass_flow_kg_h == pytest.approx(425.0, rel=1e-2)
    assert res.lhv_mj_kg > 10.0
    assert res.chemical_energy_kw > 1000.0


def test_gasification_calculation():
    gasifier_cfg = GasifierConfig(
        waste_feed_kg_h=500.0,
        moisture_pct=15.0,
        reactor_temp_c=850.0,
        airflow_m3_h=120.0,
        pressure_kpa=101.325,
    )
    gas_res = calculate_gasification(gasifier_cfg)

    assert gas_res.syngas_flow_nm3_h > 0
    assert gas_res.syngas_lhv_mj_nm3 > 0
    assert gas_res.gasification_efficiency > 0


def test_mass_balance():
    gasifier_cfg = GasifierConfig(
        waste_feed_kg_h=500.0,
        moisture_pct=15.0,
        reactor_temp_c=850.0,
        airflow_m3_h=120.0,
    )
    gas_res = calculate_gasification(gasifier_cfg)

    mb = calculate_mass_balance(
        waste_feed_kg_h=500.0,
        airflow_m3_h=120.0,
        gas_output_kg_h=gas_res.gas_mass_flow_kg_h,
        solid_output_kg_h=gas_res.char_ash_kg_h,
        moisture_pct=15.0,
    )
    assert mb.total_input_kg_h > 0
    assert mb.total_output_kg_h > 0
    assert mb.valid is True


def test_steam_and_turbine():
    steam_cfg = SteamConfig(water_flow_kg_h=200.0, boiler_efficiency=0.85)
    steam_res = calculate_steam_generation(steam_cfg, available_thermal_kw=1500.0)
    assert steam_res.steam_mass_flow_kg_h > 0
    assert steam_res.boiler_duty_kw > 0

    turbine_cfg = TurbineConfig(efficiency_isentropic=0.75, generator_efficiency=0.95)
    turb_res = calculate_turbine(
        steam_flow_kg_h=steam_res.steam_mass_flow_kg_h,
        inlet_enthalpy_kj_kg=steam_res.enthalpy_outlet_kj_kg,
        inlet_temp_c=steam_res.steam_temperature_c,
        inlet_pressure_bar=steam_res.steam_pressure_bar,
        config=turbine_cfg,
    )
    assert turb_res.electrical_power_kw > 0
    assert turb_res.valid is True


def test_overall_engine_simulation():
    params = ScenarioParams()
    res = run_simulation(params)

    assert "scenario_id" in res
    assert "parameters" in res
    assert "gasification" in res
    assert "mass_balance" in res
    assert "steam_cycle" in res
    assert "turbine" in res
    assert "heat_exchanger" in res
    assert "energy_balance" in res
    assert "overall" in res
    assert res["overall"]["electrical_output_kw"] > 0
    assert res["overall"]["heat_recovery_kw"] > 0
    assert res["overall"]["overall_efficiency_pct"] > 0


def test_scenarios_listing():
    scenarios = list_scenarios()
    assert len(scenarios) >= 5
    for sc in scenarios:
        assert "id" in sc
        assert "name" in sc
        assert "description" in sc

    normal = get_scenario("normal")
    assert normal.waste_feed_kg_h == 500
