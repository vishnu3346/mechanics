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
from simulation.fluidization import (
    FluidizationConfig, calculate_fluidization, calculate_gas_density,
    calculate_gas_viscosity, calculate_archimedes, calculate_umf_wen_yu,
    calculate_umf_ergun, calculate_terminal_velocity_haider_levenspiel,
    classify_geldart_group, calculate_bed_pressure_drop, generate_dp_curve,
    calculate_defluidization_model
)


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


def test_fluidization_gas_density_and_viscosity():
    """
    Independently verify gas density (ideal gas law) and dynamic viscosity
    (Sutherland's law) at 850 °C (1123.15 K) and 101.325 kPa (101325 Pa).
    Reference targets: rho_g ~ 0.314 kg/m³ (5% tol), mu_g ~ 4.45e-5 Pa·s (5% tol).
    """
    temp_c = 850.0
    pressure_kpa = 101.325
    t_k = temp_c + 273.15
    p_pa = pressure_kpa * 1000.0
    r_air = 287.058

    # Independent calculations
    calc_rho_g = p_pa / (r_air * t_k)
    assert calc_rho_g == pytest.approx(0.314, rel=0.05)

    mu_ref = 1.716e-5
    t_ref = 273.15
    s = 110.4
    calc_mu_g = mu_ref * ((t_k / t_ref) ** 1.5) * ((t_ref + s) / (t_k + s))
    assert calc_mu_g == pytest.approx(4.45e-5, rel=0.05)

    # Function verification
    res_rho = calculate_gas_density(temp_c, pressure_kpa)
    res_mu = calculate_gas_viscosity(temp_c)
    assert res_rho == pytest.approx(calc_rho_g, rel=1e-3)
    assert res_mu == pytest.approx(calc_mu_g, rel=1e-3)


def test_fluidization_archimedes_number():
    """
    Independently verify Archimedes number at 850 °C, 101.325 kPa,
    d = 400 µm, rho_p = 2650 kg/m³.
    Reference target: Ar ~ 264 (5% tolerance).
    """
    d_p = 400e-6
    rho_p = 2650.0
    g = 9.80665
    rho_g = 101325.0 / (287.058 * 1123.15)
    mu_g = 1.716e-5 * ((1123.15 / 273.15) ** 1.5) * ((273.15 + 110.4) / (1123.15 + 110.4))

    calc_ar = (d_p ** 3) * rho_g * (rho_p - rho_g) * g / (mu_g ** 2)
    assert calc_ar == pytest.approx(264.0, rel=0.05)

    ar = calculate_archimedes(d_p, rho_p, rho_g, mu_g, g)
    assert ar == pytest.approx(calc_ar, rel=1e-3)


def test_fluidization_umf_wen_yu_and_ergun_agreement():
    """
    Independently verify minimum fluidization velocity:
    - Wen & Yu (1966) Umf ~ 0.056 m/s (10% tolerance)
    - Ergun and Wen-Yu Umf agree within 15%
    """
    d_p = 400e-6
    rho_p = 2650.0
    g = 9.80665
    rho_g = 101325.0 / (287.058 * 1123.15)
    mu_g = 1.716e-5 * ((1123.15 / 273.15) ** 1.5) * ((273.15 + 110.4) / (1123.15 + 110.4))
    ar = (d_p ** 3) * rho_g * (rho_p - rho_g) * g / (mu_g ** 2)

    # Independent Wen & Yu (1966)
    re_mf_calc = (33.7 ** 2 + 0.0408 * ar) ** 0.5 - 33.7
    umf_wen_yu_calc = re_mf_calc * mu_g / (rho_g * d_p)
    assert umf_wen_yu_calc == pytest.approx(0.056, rel=0.10)

    # Function calls
    umf_wy, _ = calculate_umf_wen_yu(d_p, rho_p, rho_g, mu_g, g)
    umf_erg = calculate_umf_ergun(d_p, rho_p, rho_g, mu_g, sphericity=0.8, eps_mf=0.45, g=g)

    assert umf_wy == pytest.approx(umf_wen_yu_calc, rel=1e-3)

    # Ergun and Wen-Yu agreement check: within 15%
    diff_pct = abs(umf_erg - umf_wy) / umf_erg * 100.0
    assert diff_pct < 15.0


def test_umf_increases_with_particle_diameter():
    """Verify that minimum fluidization velocity strictly increases with particle diameter."""
    cfg = FluidizationConfig()
    rho_g = calculate_gas_density(850.0, 101.325, cfg)
    mu_g = calculate_gas_viscosity(850.0, cfg)

    diameters = [200e-6, 300e-6, 400e-6, 600e-6, 800e-6]
    umf_values = [calculate_umf_wen_yu(d, cfg.rho_p, rho_g, mu_g, cfg.g)[0] for d in diameters]

    for i in range(len(umf_values) - 1):
        assert umf_values[i + 1] > umf_values[i]


def test_plateau_pressure_drop_equals_buoyant_bed_weight():
    """
    Verify that fluidized plateau pressure drop equals buoyant bed weight per area:
    dP_bed = (1 - eps_mf) * (rho_p - rho_g) * g * H_mf
    """
    cfg = FluidizationConfig()
    res = calculate_fluidization(airflow_m3_h=120.0, reactor_temp_c=850.0, config=cfg)

    # Independent calculation
    expected_dp_bed_pa = (1.0 - cfg.eps_mf) * (cfg.rho_p - res.rho_g) * cfg.g * cfg.bed_height
    expected_dp_bed_kpa = expected_dp_bed_pa / 1000.0

    assert res.dp_bed_kpa == pytest.approx(expected_dp_bed_kpa, rel=1e-3)
    assert res.dp_distributor_kpa == pytest.approx(0.20 * expected_dp_bed_kpa, rel=1e-3)
    assert res.dp_total_kpa == pytest.approx(1.20 * expected_dp_bed_kpa, rel=1e-3)


def test_dp_curve_monotonic_below_umf_and_flat_above():
    """
    Verify full dP vs U0 curve:
    - Monotonically increasing below Umf (packed bed Ergun regime)
    - Flat plateau at buoyant bed weight above Umf up to Ut
    """
    curve = generate_dp_curve(reactor_temp_c=850.0, n_points=80)
    u_curve = curve["u_curve"]
    dp_bed_curve = curve["dp_bed_curve"]
    umf = curve["umf"]["wen_yu_m_s"]
    ut = curve["ut_m_s"]

    # Check monotonicity below Umf
    below_umf_dp = [dp for u, dp in zip(u_curve, dp_bed_curve) if u < umf]
    for i in range(len(below_umf_dp) - 1):
        assert below_umf_dp[i + 1] >= below_umf_dp[i]

    # Check flat plateau between Umf and Ut
    plateau_dp = [dp for u, dp in zip(u_curve, dp_bed_curve) if umf <= u <= ut]
    assert len(plateau_dp) > 5
    first_plateau = plateau_dp[0]
    for dp in plateau_dp:
        assert dp == pytest.approx(first_plateau, rel=1e-3)


def test_geldart_group_classification():
    """Verify Geldart (1973) powder classification for multiple particle sizes."""
    cfg = FluidizationConfig()
    rho_g = calculate_gas_density(850.0, 101.325, cfg)

    # Group B: Sand bed (400 µm, 2650 kg/m³)
    assert classify_geldart_group(400e-6, cfg.rho_p, rho_g) == "B"

    # Group C: Very fine cohesive powder (15 µm)
    assert classify_geldart_group(15e-6, cfg.rho_p, rho_g) == "C"

    # Group A: Aeratable small powder (55 µm, 1400 kg/m³)
    assert classify_geldart_group(55e-6, 1400.0, rho_g) == "A"

    # Group D: Large spoutable gravel (2500 µm)
    assert classify_geldart_group(2500e-6, cfg.rho_p, rho_g) == "D"


def test_defluidization_margin_and_risk_behavior():
    """
    Verify that effective particle diameter grows with plastic fraction at elevated temperature,
    causing defluidization margin (U0 / Umf_eff) to fall and risk index to rise.
    """
    r_low = calculate_fluidization(airflow_m3_h=120.0, reactor_temp_c=850.0, plastic_ratio=0.10)
    r_med = calculate_fluidization(airflow_m3_h=120.0, reactor_temp_c=850.0, plastic_ratio=0.25)
    r_high = calculate_fluidization(airflow_m3_h=120.0, reactor_temp_c=850.0, plastic_ratio=0.45)

    # Effective diameter increases with plastic
    assert r_low.d_eff < r_med.d_eff < r_high.d_eff

    # Effective minimum fluidization velocity increases
    assert r_low.umf_effective < r_med.umf_effective < r_high.umf_effective

    # Defluidization margin falls
    assert r_low.defluidization_margin > r_med.defluidization_margin > r_high.defluidization_margin

    # Defluidization risk increases
    assert r_low.defluidization_risk <= r_med.defluidization_risk <= r_high.defluidization_risk


def test_fluidization_edge_cases_and_error_handling():
    """Verify that unphysical inputs raise clear errors or produce clear warnings."""
    # Negative airflow raises ValueError
    with pytest.raises(ValueError, match="cannot be negative"):
        calculate_fluidization(airflow_m3_h=-50.0)

    # Below absolute zero raises ValueError
    with pytest.raises(ValueError, match="absolute zero"):
        calculate_fluidization(reactor_temp_c=-300.0)

    # Non-positive pressure raises ValueError
    with pytest.raises(ValueError, match="positive"):
        calculate_fluidization(pressure_kpa=0.0)

    # Zero airflow clamps safely with warning
    res_zero = calculate_fluidization(airflow_m3_h=0.0)
    assert res_zero.u0 == 0.0
    assert len(res_zero.warnings) > 0


def test_engine_response_contains_new_hydrodynamic_keys():
    """Verify that run_simulation output contains all new required hydrodynamic keys."""
    params = ScenarioParams()
    res = run_simulation(params)

    # Check top-level keys
    required_keys = [
        "u0_m_s", "umf_m_s", "umf_ergun_m_s", "umf_wen_yu_m_s", "ut_m_s",
        "u0_over_umf", "geldart_group", "regime", "defluidization_risk",
        "umf_effective_m_s", "dp_bed_kpa", "dp_distributor_kpa", "pressure_drop"
    ]
    for k in required_keys:
        assert k in res, f"Missing key in simulation result: {k}"
        assert res[k] is not None

    # Check fluidization sub-dictionary
    assert "fluidization" in res
    fluid = res["fluidization"]
    for k in required_keys:
        assert k in fluid, f"Missing key in fluidization dict: {k}"

    assert fluid["geldart_group"] == "B"
    assert fluid["regime"] == "bubbling"
    assert fluid["u0_m_s"] > 0
    assert fluid["umf_m_s"] > 0
    assert fluid["ut_m_s"] > fluid["u0_m_s"] > fluid["umf_m_s"]

