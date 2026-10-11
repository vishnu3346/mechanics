"""
Unit tests for Machine Learning anomaly detection and diagnostics.
"""

import os
import pytest
from ml.anomaly.predict import AnomalyPredictor
from ml.anomaly.preprocessing import FEATURE_COLUMNS


def test_feature_columns_definition():
    assert len(FEATURE_COLUMNS) == 7
    assert "bed_temperature" in FEATURE_COLUMNS
    assert "airflow" in FEATURE_COLUMNS
    assert "pressure_drop" in FEATURE_COLUMNS
    assert "plastic_ratio" in FEATURE_COLUMNS
    assert "temperature_gradient" in FEATURE_COLUMNS
    assert "airflow_deviation" in FEATURE_COLUMNS
    assert "pressure_deviation" in FEATURE_COLUMNS


def test_anomaly_model_prediction():
    models_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
    predictor = AnomalyPredictor(models_dir)
    assert predictor.loaded is True

    # Normal operating state
    normal_features = {
        "bed_temperature": 850.0,
        "airflow": 120.0,
        "pressure_drop": 15.2,
        "plastic_ratio": 20.0,
        "temperature_gradient": 0.0,
        "airflow_deviation": 0.0,
        "pressure_deviation": 0.0,
    }
    res = predictor.predict(normal_features)
    assert res["model_loaded"] is True
    assert "state" in res
    assert "confidence" in res
    assert "risk_level" in res
    assert res["state"] == "NORMAL_FLUIDIZATION"
    assert res["confidence"] > 0.5


def test_severe_clumping_detection():
    models_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
    predictor = AnomalyPredictor(models_dir)

    high_plastic_features = {
        "bed_temperature": 740.0,
        "airflow": 85.0,
        "pressure_drop": 27.0,
        "plastic_ratio": 55.0,
        "temperature_gradient": (850 - 740) / 100,
        "airflow_deviation": (120 - 85) / 120,
        "pressure_deviation": (27.0 - 15.2) / 15.2,
    }
    res = predictor.predict(high_plastic_features)
    assert res["state"] in ["SEVERE_CLUMPING", "EARLY_AGGLOMERATION"]
    assert res["risk_level"] in ["CRITICAL", "MEDIUM", "HIGH"]


def test_physics_state_label_thresholds():
    """
    Task 2 & 7: Verify that state labels strictly follow the documented physics thresholds.
    No label may come from the ML model or scenario name.
    """
    from simulation.fluidization import classify_physics_state

    # 1. Defluidization: U0 / Umf_eff < 1.0 -> SEVERE_CLUMPING
    st, rk, re = classify_physics_state(u0=0.50, umf_eff=0.60, ut=2.5, dp_bed=7.1, dp_expected=7.1, temp_c=850.0)
    assert st == "SEVERE_CLUMPING"
    assert rk == "CRITICAL"
    assert "U0/Umf_eff" in re or "Defluidization" in re

    # 2. Terminal blowout: U0 / Ut >= 0.75 -> SEVERE_CLUMPING
    st, rk, _ = classify_physics_state(u0=2.0, umf_eff=0.10, ut=2.5, dp_bed=7.1, dp_expected=7.1, temp_c=850.0)
    assert st == "SEVERE_CLUMPING"
    assert rk == "CRITICAL"

    # 3. Severe channeling: dP_bed / dP_expected < 0.60 -> SEVERE_CLUMPING
    st, rk, _ = classify_physics_state(u0=0.60, umf_eff=0.10, ut=2.5, dp_bed=3.5, dp_expected=7.1, temp_c=850.0)
    assert st == "SEVERE_CLUMPING"
    assert rk == "CRITICAL"

    # 4. Thermal flameout: T < 650 °C -> SEVERE_CLUMPING
    st, rk, _ = classify_physics_state(u0=0.60, umf_eff=0.10, ut=2.5, dp_bed=7.1, dp_expected=7.1, temp_c=620.0)
    assert st == "SEVERE_CLUMPING"
    assert rk == "CRITICAL"

    # 5. Sintering runaway: T > 1020 °C -> SEVERE_CLUMPING
    st, rk, _ = classify_physics_state(u0=0.60, umf_eff=0.10, ut=2.5, dp_bed=7.1, dp_expected=7.1, temp_c=1050.0)
    assert st == "SEVERE_CLUMPING"
    assert rk == "CRITICAL"

    # 6. Incipient defluidization: 1.0 <= U0 / Umf_eff < 2.0 -> EARLY_AGGLOMERATION
    st, rk, re = classify_physics_state(u0=0.55, umf_eff=0.35, ut=2.5, dp_bed=7.1, dp_expected=7.1, temp_c=850.0)
    assert st == "EARLY_AGGLOMERATION"
    assert rk == "MEDIUM"

    # 7. Slugging transition: 0.50 <= U0 / Ut < 0.75 -> EARLY_AGGLOMERATION
    st, rk, _ = classify_physics_state(u0=1.40, umf_eff=0.10, ut=2.5, dp_bed=7.1, dp_expected=7.1, temp_c=850.0)
    assert st == "EARLY_AGGLOMERATION"
    assert rk == "MEDIUM"

    # 8. Moderate channeling: 0.60 <= dP_bed / dP_expected < 0.85 -> EARLY_AGGLOMERATION
    st, rk, _ = classify_physics_state(u0=0.60, umf_eff=0.10, ut=2.5, dp_bed=5.0, dp_expected=7.1, temp_c=850.0)
    assert st == "EARLY_AGGLOMERATION"
    assert rk == "MEDIUM"

    # 9. Cold bed margin: 650 <= T < 750 °C -> EARLY_AGGLOMERATION
    st, rk, _ = classify_physics_state(u0=0.60, umf_eff=0.10, ut=2.5, dp_bed=7.1, dp_expected=7.1, temp_c=720.0)
    assert st == "EARLY_AGGLOMERATION"
    assert rk == "MEDIUM"

    # 10. Thermal margin warning: 930 < T <= 1020 °C -> EARLY_AGGLOMERATION
    st, rk, _ = classify_physics_state(u0=0.60, umf_eff=0.10, ut=2.5, dp_bed=7.1, dp_expected=7.1, temp_c=960.0)
    assert st == "EARLY_AGGLOMERATION"
    assert rk == "MEDIUM"

    # 11. Normal fluidization: safe margins -> NORMAL_FLUIDIZATION
    st, rk, _ = classify_physics_state(u0=0.60, umf_eff=0.10, ut=2.5, dp_bed=7.1, dp_expected=7.1, temp_c=850.0)
    assert st == "NORMAL_FLUIDIZATION"
    assert rk == "LOW"


def test_generator_reproducibility_with_fixed_seed():
    """
    Task 3 & 7: Verify that the data generator is strictly reproducible given a fixed seed.
    """
    from ml.anomaly.generate_data import generate_anomaly_dataset
    import pandas as pd

    df1 = generate_anomaly_dataset(n_groups=10, samples_per_group=3, seed=42)
    df2 = generate_anomaly_dataset(n_groups=10, samples_per_group=3, seed=42)

    pd.testing.assert_frame_equal(df1, df2)
    assert len(df1) == 30
    assert "u0_over_umf_eff" in df1.columns
    assert "state" in df1.columns


def test_defluidized_agglomeration_scenario_physics():
    """
    Task 1: Verify that defluidized_agglomeration scenario has U0/Umf_eff < 1 arising
    ONLY from agglomeration mechanism, with all other operating inputs matching baseline.
    """
    from simulation.engine import SCENARIOS, DEFAULT_AIRFLOW_NM3_H, run_simulation

    sc = SCENARIOS["defluidized_agglomeration"]
    assert sc.waste_feed_kg_h == 500.0
    assert sc.moisture_pct == 15.0
    assert sc.plastic_ratio == 0.20
    assert sc.airflow_m3_h == DEFAULT_AIRFLOW_NM3_H
    assert sc.reactor_temp_c == 850.0
    assert sc.agglomeration_index == 0.85

    res = run_simulation(sc)
    assert res["u0_over_umf_eff"] < 1.0
    assert res["physics_state"] == "SEVERE_CLUMPING"
    assert res["u0_m_s"] == pytest.approx(0.5674, rel=1e-2)
    assert res["umf_effective_m_s"] > res["u0_m_s"]

