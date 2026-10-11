"""
Integration tests for FastAPI backend endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "disclaimer" in data


def test_scenarios_endpoints():
    response = client.get("/api/scenarios")
    assert response.status_code == 200
    data = response.json()
    assert "scenarios" in data
    assert len(data["scenarios"]) >= 5

    # Test single scenario
    res_single = client.get("/api/scenarios/normal")
    assert res_single.status_code == 200
    single_data = res_single.json()
    assert single_data["id"] == "normal"
    assert "params" in single_data


def test_simulation_run():
    payload = {
        "scenario_id": "normal",
        "waste_feed_kg_h": 120.0,
        "moisture_pct": 14.0,
        "plastic_ratio": 0.22,
        "reactor_temp_c": 855.0,
    }
    response = client.post("/api/simulation/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "scenario_id" in data
    assert "overall" in data
    assert data["overall"]["electrical_output_kw"] > 0
    assert data["overall"]["overall_efficiency_pct"] > 0


def test_simulation_validation():
    valid_payload = {"waste_feed_kg_h": 100.0, "reactor_temp_c": 800.0}
    res = client.post("/api/simulation/validate", json=valid_payload)
    assert res.status_code == 200
    assert res.json()["valid"] is True

    invalid_payload = {"waste_feed_kg_h": -10.0, "reactor_temp_c": 2000.0}
    res_inv = client.post("/api/simulation/validate", json=invalid_payload)
    assert res_inv.status_code == 200
    assert res_inv.json()["valid"] is False
    assert len(res_inv.json()["errors"]) > 0


def test_anomaly_predict():
    payload = {
        "bed_temperature": 850.0,
        "airflow": 120.0,
        "pressure_drop": 15.2,
        "plastic_ratio": 20.0,
    }
    response = client.post("/api/anomaly/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "state" in data
    assert "confidence" in data
    assert "risk_level" in data


def test_vision_inference_synthetic():
    response = client.post("/api/vision/inference")
    assert response.status_code == 200
    data = response.json()
    assert "detections" in data
    assert "class_counts" in data
    assert data["total_objects"] > 0


def test_history_endpoint():
    # History should contain at least the run from test_simulation_run
    response = client.get("/api/history")
    assert response.status_code == 200
    data = response.json()
    assert "history" in data
    assert len(data["history"]) >= 1


def test_system_endpoint():
    response = client.get("/api/system")
    assert response.status_code == 200
    data = response.json()
    assert "python_version" in data
    assert "platform" in data
