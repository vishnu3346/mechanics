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

    # Check new top-level diagnostic keys
    assert "equivalence_ratio" in res
    assert "energy_closure_error_pct" in res
    assert res["equivalence_ratio"] > 0
    assert res["energy_closure_error_pct"] < 2.0


def test_first_law_energy_closure_multi_scenarios():
    """
    Verify First-Law thermodynamic energy closure across the steam loop:
    Boiler duty = Turbine shaft work + Condenser/district heat + Documented losses
    asserting closure error < 2.0% for at least three different scenarios.
    """
    scenarios_to_test = ["normal", "high_plastic", "severe_clumping", "high_moisture"]
    for sid in scenarios_to_test:
        params = SCENARIOS[sid]
        res = run_simulation(params)
        eb = res["energy_balance"]
        
        boiler_duty = eb["boiler_energy_kw"]
        turbine_shaft = eb["turbine_shaft_work_kw"]
        district_heat = eb["heat_recovery_kw"]
        losses = eb["documented_losses_kw"]
        
        sum_outputs = turbine_shaft + district_heat + losses
        closure_err = abs(boiler_duty - sum_outputs) / boiler_duty * 100.0 if boiler_duty > 0 else 0.0
        
        assert closure_err < 2.0, f"Scenario {sid} First-Law closure failed: error={closure_err:.3f}%"
        assert res["energy_closure_error_pct"] < 2.0
        assert res["overall"]["energy_closure_error_pct"] < 2.0


def test_mass_balance_closure_rigorous():
    """
    Verify mass balance closure across the gasification reactor:
    Total Mass In (waste + air) = Total Mass Out (syngas mass + char/ash)
    asserting closure error < 2.0% for default and stress scenarios.
    """
    for sid in ["normal", "high_moisture", "high_throughput"]:
        params = SCENARIOS[sid]
        res = run_simulation(params)
        mb = res["mass_balance"]
        
        total_in = mb["total_in"]
        total_out = mb["total_out"]
        err_pct = mb["error_pct"]
        
        assert err_pct < 2.0, f"Scenario {sid} mass balance failed: err={err_pct:.3f}%"
        assert mb["status"] == "PASS"
        assert abs(total_in - total_out) / total_in * 100.0 < 2.0


def test_independent_ergun_quadratic_solver():
    """
    Independently solve the Ergun (1952) quadratic equation for minimum fluidization:
      A * Re_mf² + B * Re_mf - Ar = 0
    where:
      A = 1.75 / (phi_s * eps_mf³)
      B = 150 * (1 - eps_mf) / (phi_s² * eps_mf³)
      Re_mf = (-B + sqrt(B² + 4 * A * Ar)) / (2 * A)
      U_mf = Re_mf * mu_g / (rho_g * d_p)
    Confirm calculate_umf_ergun exactly matches this independent analytical solution.
    """
    import math

    # Bed and gas properties at 850 °C, 101.325 kPa
    d_p = 400e-6
    rho_p = 2650.0
    sphericity = 0.8
    eps_mf = 0.45
    g = 9.80665

    rho_g = 101325.0 / (287.058 * 1123.15)
    mu_g = 1.716e-5 * ((1123.15 / 273.15) ** 1.5) * ((273.15 + 110.4) / (1123.15 + 110.4))
    ar = (d_p ** 3) * rho_g * (rho_p - rho_g) * g / (mu_g ** 2)

    # Independent Ergun quadratic coefficients
    a_erg = 1.75 / (sphericity * (eps_mf ** 3))
    b_erg = 150.0 * (1.0 - eps_mf) / ((sphericity ** 2) * (eps_mf ** 3))

    disc = b_erg * b_erg + 4.0 * a_erg * ar
    re_mf_independent = (-b_erg + math.sqrt(disc)) / (2.0 * a_erg)
    umf_ergun_independent = re_mf_independent * mu_g / (rho_g * d_p)

    # Function call
    umf_ergun_func = calculate_umf_ergun(
        d_p=d_p, rho_p=rho_p, rho_g=rho_g, mu_g=mu_g,
        sphericity=sphericity, eps_mf=eps_mf, g=g
    )

    # Verify exact agreement
    assert umf_ergun_func == pytest.approx(umf_ergun_independent, rel=1e-5)
    assert 0.05 < umf_ergun_func < 0.08


def test_independent_iapws_steam_closure():
    """
    Independent First-Law Rankine cycle verification using IAPWS-IF97:
    - Boiler feedwater inlet at 50 °C (condensate return state) and 10 bar (1.0 MPa)
    - Superheated steam at 350 °C and 10 bar (1.0 MPa)
    - Isentropic expansion to condenser pressure 0.5 bar (0.05 MPa)
    - Actual expansion with isentropic efficiency eta = 0.75
    - District heat exchanger condensation to 50 °C subcooled liquid
    Assert independent energy closure error < 0.05% with no plug terms.
    """
    from iapws import IAPWS97

    # 1. State enthalpies (kJ/kg) from IAPWS-IF97
    # Boiler feedwater: 50 °C (323.15 K), 10 bar (1.0 MPa)
    state_fw = IAPWS97(T=323.15, P=1.0)
    h_fw = state_fw.h

    # Boiler outlet / Turbine inlet: 350 °C (623.15 K), 10 bar (1.0 MPa)
    state_steam = IAPWS97(T=623.15, P=1.0)
    h_in = state_steam.h
    s_in = state_steam.s

    # Isentropic expansion to 0.5 bar (0.05 MPa)
    p_cond = 0.05
    state_ex_s = IAPWS97(P=p_cond, s=s_in)
    h_ex_s = state_ex_s.h

    # Actual exhaust enthalpy with eta_isentropic = 0.75
    eta_isen = 0.75
    delta_h_actual = (h_in - h_ex_s) * eta_isen
    h_ex_act = h_in - delta_h_actual

    # Condensate return liquid: 50 °C, 0.5 bar
    state_cond = IAPWS97(T=323.15, P=p_cond)
    h_cond = state_cond.h

    # 2. Cycle energy duties for m_steam = 1500 kg/h
    m_steam = 1500.0  # kg/h
    q_boiler = m_steam * (h_in - h_fw) / 3600.0
    w_turbine = m_steam * (h_in - h_ex_act) / 3600.0
    q_condenser = m_steam * (h_ex_act - h_cond) / 3600.0

    # District heat recovery with effectiveness = 0.85 * 0.95 = 0.8075
    effectiveness = 0.85 * 0.95
    q_district = effectiveness * q_condenser
    q_unrecovered = (1.0 - effectiveness) * q_condenser

    # First-Law energy closure check: Q_boiler ≈ W_turbine + Q_condenser
    sum_outputs = w_turbine + q_district + q_unrecovered
    assert q_district + q_unrecovered == pytest.approx(q_condenser, rel=1e-5)
    
    # Closure error between boiler duty and sum of power + condenser heat
    closure_err_pct = abs(q_boiler - sum_outputs) / q_boiler * 100.0
    assert closure_err_pct < 0.05


def test_reactor_heat_balance_reporting_and_regimes():
    """
    Verify reactor heat balance behavior across the ER operating range:
    - At low ER (0.05, 0.10, 0.20): Net heat balance is negative (Allothermal deficit).
    - At normal/high ER (0.30, 0.40): Net heat balance is positive (Autothermal surplus).
    - In run_simulation default scenario: reactor_heat_balance_kw is reported and positive.
    """
    from simulation.engine import calculate_stoichiometric_airflow, compute_reactor_heat_balance, run_simulation, SCENARIOS
    from simulation.gasifier import GasifierConfig, calculate_gasification

    # Low ER checks: should be ALLOTHERMAL (heat deficit)
    for er in [0.05, 0.10, 0.20]:
        af = calculate_stoichiometric_airflow(500.0, 15.0, target_er=er)
        cfg = GasifierConfig(waste_feed_kg_h=500.0, moisture_pct=15.0, airflow_m3_h=af, reactor_temp_c=850.0, feedstock_lhv_mj_kg=18.812)
        res = calculate_gasification(cfg)
        hb = compute_reactor_heat_balance(500.0, 15.0, af, 850.0, res.thermal_energy_kw, res.char_ash_kg_h, ash_fraction=0.05, feedstock_lhv_mj_kg=18.812)
        assert hb["net_heat_balance_kw"] < 0.0, f"Expected deficit at ER={er}, got {hb['net_heat_balance_kw']}"
        assert hb["regime"] == "ALLOTHERMAL"
        assert hb["is_autothermal"] is False

    # High ER checks: should be AUTOTHERMAL (heat surplus)
    for er in [0.30, 0.40]:
        af = calculate_stoichiometric_airflow(500.0, 15.0, target_er=er)
        cfg = GasifierConfig(waste_feed_kg_h=500.0, moisture_pct=15.0, airflow_m3_h=af, reactor_temp_c=850.0, feedstock_lhv_mj_kg=18.812)
        res = calculate_gasification(cfg)
        hb = compute_reactor_heat_balance(500.0, 15.0, af, 850.0, res.thermal_energy_kw, res.char_ash_kg_h, ash_fraction=0.05, feedstock_lhv_mj_kg=18.812)
        assert hb["net_heat_balance_kw"] > 0.0, f"Expected surplus at ER={er}, got {hb['net_heat_balance_kw']}"
        assert hb["regime"] == "AUTOTHERMAL"
        assert hb["is_autothermal"] is True

    # Default simulation scenario checks
    res_normal = run_simulation(SCENARIOS["normal"])
    assert "reactor_heat_balance_kw" in res_normal
    assert "reactor_thermal_regime" in res_normal
    assert "reactor_heat_balance_note" in res_normal
    assert res_normal["reactor_heat_balance_kw"] > 0.0
    assert res_normal["reactor_thermal_regime"] == "AUTOTHERMAL"
    assert "surplus" in res_normal["reactor_heat_balance_note"].lower()


def test_cge_and_carbon_conversion_unique_across_er_sweep():
    """
    Verify that Cold Gas Efficiency (CGE) and carbon conversion (X_c) respond
    physically and uniquely across the equivalence ratio sweep [0.05, 0.10, 0.20, 0.30, 0.40]:
    - No CGE values are clamped to 95.00% or equal to each other.
    - Carbon conversion is strictly monotonically increasing with ER.
    - Nitrogen volume fraction strictly increases with ER.
    """
    from simulation.engine import calculate_stoichiometric_airflow
    from simulation.gasifier import GasifierConfig, calculate_gasification

    er_points = [0.05, 0.10, 0.20, 0.30, 0.40]
    cge_values = []
    xc_values = []
    n2_values = []

    for er in er_points:
        af = calculate_stoichiometric_airflow(500.0, 15.0, target_er=er)
        cfg = GasifierConfig(waste_feed_kg_h=500.0, moisture_pct=15.0, airflow_m3_h=af, reactor_temp_c=850.0, feedstock_lhv_mj_kg=18.812)
        res = calculate_gasification(cfg)
        cge_values.append(res.gasification_efficiency)
        xc_values.append(res.carbon_conversion)
        n2_values.append(res.gas_composition.get("N2", 0.0))

    # 1. No CGE value is clamped to 0.9500
    for cge in cge_values:
        assert cge != pytest.approx(0.9500, abs=1e-4)

    # 2. CGE values are distinct across all adjacent ER points (no coincidences)
    for i in range(len(cge_values) - 1):
        assert abs(cge_values[i + 1] - cge_values[i]) > 0.001

    # 3. Carbon conversion strictly monotonically increases with ER
    for i in range(len(xc_values) - 1):
        assert xc_values[i + 1] > xc_values[i], f"Expected X_c({er_points[i+1]}) > X_c({er_points[i]})"

    # 4. Nitrogen fraction strictly increases with ER (dilution by air)
    for i in range(len(n2_values) - 1):
        assert n2_values[i + 1] > n2_values[i], f"Expected N2({er_points[i+1]}) > N2({er_points[i]})"


def test_steam_cycle_model_vs_iapws_independent_benchmark():
    """
    Task 7: Test whose expected steam values are computed inside the test with IAPWS-IF97,
    not from model outputs.
    Asserts that the model's steam generation, feed pump, turbine, and heat exchanger
    match independent thermodynamic states computed directly using IAPWS97 within 0.2%.
    """
    from iapws import IAPWS97
    from simulation.steam_cycle import (
        SteamConfig, calculate_steam_generation, calculate_feed_pump, PumpConfig
    )
    from simulation.turbine import TurbineConfig, calculate_turbine
    from simulation.heat_exchanger import HeatExchangerConfig, calculate_heat_exchanger
    from simulation.engine import run_simulation, SCENARIOS

    # --- 1. INDEPENDENT THERMODYNAMIC CALCULATION WITH IAPWS97 ---
    p_cond_mpa = 0.05       # 0.5 bar condenser pressure
    p_boiler_mpa = 1.0      # 10 bar boiler pressure
    t_cond_k = 50.0 + 273.15  # 50 °C condensate return
    t_steam_k = 350.0 + 273.15  # 350 °C superheated steam

    # State 1: Condensate liquid at 50 °C, 0.5 bar
    state_cond = IAPWS97(T=t_cond_k, P=p_cond_mpa)
    h_cond_indep = state_cond.h          # kJ/kg
    v_cond_indep = state_cond.v          # m3/kg (e.g. ~0.001012 m3/kg)

    # State 2: Feed pump isentropic and actual work to 10 bar (1.0 MPa)
    dp_kpa = (p_boiler_mpa - p_cond_mpa) * 1000.0  # 950 kPa
    w_pump_s_indep = v_cond_indep * dp_kpa          # kJ/kg (~0.961 kJ/kg)
    eta_pump = 0.80
    w_pump_act_indep = w_pump_s_indep / eta_pump    # kJ/kg (~1.202 kJ/kg)
    h_fw_indep = h_cond_indep + w_pump_act_indep    # kJ/kg (~210.57 kJ/kg)

    # State 3: Boiler outlet steam at 350 °C, 10 bar (1.0 MPa)
    state_steam = IAPWS97(T=t_steam_k, P=p_boiler_mpa)
    h_steam_indep = state_steam.h        # kJ/kg (~3158.16 kJ/kg)
    s_steam_indep = state_steam.s        # kJ/(kg.K) (~7.3028 kJ/kg.K)

    # Boiler enthalpy rise and steam mass flow for available thermal heat
    q_thermal_avail = 1490.4  # kW
    eta_boiler = 0.85
    q_boiler_indep = q_thermal_avail * eta_boiler  # 1266.84 kW
    delta_h_boiler_indep = h_steam_indep - h_fw_indep
    m_steam_indep_kg_h = (q_boiler_indep / delta_h_boiler_indep) * 3600.0  # kg/h (~1547.24 kg/h)

    # State 4: Turbine expansion to 0.5 bar (0.05 MPa)
    state_ex_s = IAPWS97(P=p_cond_mpa, s=s_steam_indep)
    h_ex_s_indep = state_ex_s.h          # kJ/kg (~2542.36 kJ/kg)
    delta_h_isen_indep = h_steam_indep - h_ex_s_indep
    eta_turb = 0.75
    delta_h_act_indep = delta_h_isen_indep * eta_turb
    h_ex_act_indep = h_steam_indep - delta_h_act_indep  # kJ/kg (~2696.31 kJ/kg)

    # Turbine shaft work and electrical power
    w_turb_shaft_indep = (m_steam_indep_kg_h / 3600.0) * delta_h_act_indep  # kW (~198.50 kW)
    eta_mech = 0.95
    eta_gen = 0.95
    w_turb_elec_indep = w_turb_shaft_indep * eta_mech * eta_gen            # kW (~179.14 kW)

    # Feed pump power at actual mass flow
    w_pump_shaft_indep = (m_steam_indep_kg_h / 3600.0) * w_pump_act_indep  # kW (~0.517 kW)
    w_pump_elec_indep = w_pump_shaft_indep / 0.95                         # kW (~0.544 kW)

    # Condenser heat duty
    q_condenser_indep = (m_steam_indep_kg_h / 3600.0) * (h_ex_act_indep - h_cond_indep)  # kW (~1068.86 kW)

    # --- 2. COMPARE AGAINST SIMULATION MODEL MODULES ---
    # Feed pump module
    pump_pre = calculate_feed_pump(200.0, condensate_temp_c=50.0)
    assert pump_pre.enthalpy_inlet_kj_kg == pytest.approx(h_cond_indep, rel=1e-3)
    assert pump_pre.enthalpy_outlet_kj_kg == pytest.approx(h_fw_indep, rel=1e-3)
    assert pump_pre.work_specific_kj_kg == pytest.approx(w_pump_act_indep, rel=1e-3)

    # Steam generation module
    st_cfg = SteamConfig(
        water_flow_kg_h=200.0,
        inlet_water_temp_c=50.0,
        boiler_efficiency=eta_boiler,
        target_steam_pressure_bar=10.0,
        target_steam_temp_c=350.0,
        feedwater_enthalpy_kj_kg=pump_pre.enthalpy_outlet_kj_kg,
    )
    st_res = calculate_steam_generation(st_cfg, available_thermal_kw=q_thermal_avail)
    assert st_res.steam_engine == "IAPWS-IF97"
    assert st_res.enthalpy_inlet_kj_kg == pytest.approx(h_fw_indep, rel=1e-3)
    assert st_res.enthalpy_outlet_kj_kg == pytest.approx(h_steam_indep, rel=1e-3)
    assert st_res.steam_mass_flow_kg_h == pytest.approx(m_steam_indep_kg_h, rel=1e-3)
    assert st_res.boiler_duty_kw == pytest.approx(q_boiler_indep, rel=1e-3)

    # Actual sized pump module
    pump_res = calculate_feed_pump(st_res.steam_mass_flow_kg_h, condensate_temp_c=50.0)
    assert pump_res.pump_power_shaft_kw == pytest.approx(w_pump_shaft_indep, rel=1e-3)
    assert pump_res.pump_power_electrical_kw == pytest.approx(w_pump_elec_indep, rel=1e-3)

    # Turbine module
    turb_cfg = TurbineConfig(efficiency_isentropic=eta_turb, generator_efficiency=eta_gen)
    turb_res = calculate_turbine(
        st_res.steam_mass_flow_kg_h, st_res.enthalpy_outlet_kj_kg,
        st_res.steam_temperature_c, st_res.steam_pressure_bar, turb_cfg
    )
    assert turb_res.steam_engine == "IAPWS-IF97"
    assert turb_res.exhaust_enthalpy_kj_kg == pytest.approx(h_ex_act_indep, rel=1e-3)
    assert turb_res.turbine_power_kw == pytest.approx(w_turb_shaft_indep, rel=1e-3)
    assert turb_res.electrical_power_kw == pytest.approx(w_turb_elec_indep, rel=1e-3)

    # Heat exchanger module
    hx_cfg = HeatExchangerConfig(auto_water_flow=True, target_hot_water_temp_c=70.0, condensate_return_temp_c=50.0)
    hx_res = calculate_heat_exchanger(
        st_res.steam_mass_flow_kg_h, turb_res.exhaust_temperature_c,
        turb_res.exhaust_enthalpy_kj_kg, hx_cfg
    )
    assert hx_res.steam_engine == "IAPWS-IF97"
    assert hx_res.condenser_heat_kw == pytest.approx(q_condenser_indep, rel=1e-3)

    # --- 3. COMPARE AGAINST RUN_SIMULATION DEFAULT SCENARIO ---
    sim_res = run_simulation(SCENARIOS["normal"])
    assert sim_res["steam_cycle"]["enthalpy_in_kj_kg"] == pytest.approx(h_fw_indep, rel=1e-3)
    assert sim_res["steam_cycle"]["enthalpy_out_kj_kg"] == pytest.approx(h_steam_indep, rel=1e-3)
    assert sim_res["steam_cycle"]["steam_flow_kg_h"] == pytest.approx(m_steam_indep_kg_h, rel=1e-3)
    assert sim_res["turbine"]["turbine_power_kw"] == pytest.approx(w_turb_shaft_indep, rel=1e-3)
    assert sim_res["feed_pump"]["pump_power_shaft_kw"] == pytest.approx(w_pump_shaft_indep, rel=1e-3)


def test_whole_plant_energy_closure_independent():
    """
    Task 4: Whole-plant First-Law energy closure check:
    feed LHV = net electrical + district heat + unrecovered condenser heat +
               reactor wall loss + unconverted-char chemical energy + syngas sensible/stack losses.
    Every term from its own calculation, none as a remainder.
    """
    from simulation.engine import run_simulation, SCENARIOS

    res = run_simulation(SCENARIOS["normal"])
    wpc = res["whole_plant_closure"]

    # Assert all independent energy streams are positive and computed
    assert wpc["chemical_input_kw"] > 2000.0
    assert wpc["net_electrical_power_kw"] > 100.0
    assert wpc["district_heat_kw"] > 700.0
    assert wpc["unrecovered_condenser_heat_kw"] > 100.0
    assert wpc["reactor_wall_loss_kw"] > 30.0
    assert wpc["char_chemical_energy_kw"] > 300.0
    assert wpc["boiler_stack_loss_kw"] > 150.0
    assert wpc["syngas_sensible_stack_losses_kw"] > 500.0

    # Verify that whole_plant_output_sum_kw equals the explicit sum of the 6 independent terms
    output_sum = (
        wpc["net_electrical_power_kw"] +
        wpc["district_heat_kw"] +
        wpc["unrecovered_condenser_heat_kw"] +
        wpc["reactor_wall_loss_kw"] +
        wpc["char_chemical_energy_kw"] +
        wpc["syngas_sensible_stack_losses_kw"]
    )
    assert wpc["whole_plant_output_sum_kw"] == pytest.approx(output_sum, abs=0.05)

    # Check closure error calculation
    expected_err = abs(wpc["chemical_input_kw"] - output_sum) / wpc["chemical_input_kw"] * 100.0
    assert res["whole_plant_closure_error_pct"] == pytest.approx(expected_err, abs=0.01)
    assert res["whole_plant_closure_error_pct"] == pytest.approx(3.67, abs=0.1)

    # Assert steam loop closure is exact (< 0.01%)
    assert res["steam_loop_closure_error_pct"] < 0.01



