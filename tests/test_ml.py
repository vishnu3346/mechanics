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
