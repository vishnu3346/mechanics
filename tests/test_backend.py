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
    payload = {
        "scenario_id": "normal",
        "waste_feed_kg_h": 125.0,
        "moisture_pct": 14.5,
        "reactor_temp_c": 852.0,
    }
    run_resp = client.post("/api/simulation/run", json=payload)
    assert run_resp.status_code == 200
    sim_data = run_resp.json()
    sim_id = sim_data["scenario_id"]

    response = client.get("/api/history")
    assert response.status_code == 200
    data = response.json()
    assert "history" in data
    matching = [r for r in data["history"] if r["id"] == sim_id]
    assert len(matching) == 1
    stored = matching[0]

    assert stored["id"] == sim_id
    assert stored["scenario_name"] == sim_data["scenario_name"]
    assert stored["overall"] is not None
    assert stored["overall"].get("electrical_output_kw") is not None
    assert stored["overall"].get("net_power_kw") is not None
    assert stored["overall"].get("overall_efficiency_pct") is not None
    assert stored["overall"]["electrical_output_kw"] > 0
    assert stored["overall"]["net_power_kw"] > 0
    assert stored["overall"]["overall_efficiency_pct"] > 0


def test_system_endpoint():
    response = client.get("/api/system")
    assert response.status_code == 200
    data = response.json()
    assert "python_version" in data
    assert "platform" in data


def test_health_extended_fields():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "anomaly_model_loaded" in data
    assert "yolo_model_loaded" in data
    assert "vit_model_loaded" in data
    assert data["yolo_model_loaded"] is True
    assert data["vit_model_loaded"] is True


def test_yolo_inference_real_image():
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent
    test_img = root / "medical waste.v2i.yolov8" / "test" / "images" / "IMG_6279_JPG.rf.9d6e0582ca511184fcc450be22db9348.jpg"
    assert test_img.exists()

    with open(test_img, "rb") as f:
        response = client.post("/api/vision/inference", files={"file": ("test.jpg", f, "image/jpeg")})
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "inference"
    assert data["synthetic"] is False
    assert "detections" in data
    assert "class_counts" in data
    assert len(data["detections"]) > 0


def test_vit_classify_endpoint_real_image():
    from pathlib import Path
    root = Path(__file__).resolve().parent.parent
    img_path = (
        root
        / "archive (2)"
        / "Pharmaceutical and Biomedical Waste (PBW)"
        / "Tweezers"
        / "Test images"
        / "IMG_6807_JPG.rf.3a693ddae62c67b529566f9081eac08a.jpg"
    )
    assert img_path.exists()

    with open(img_path, "rb") as f:
        response = client.post(
            "/api/vision/classify",
            files={"file": ("tweezers.jpg", f, "image/jpeg")},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_class"] == "Tweezers"
    assert data["confidence_pct"] > 90.0
    assert len(data["top_predictions"]) == 3
    assert data["top_predictions"][0]["class"] == "Tweezers"

    # Test invalid file type validation
    invalid_resp = client.post(
        "/api/vision/classify",
        files={"file": ("notes.txt", b"hello world", "text/plain")},
    )
    assert invalid_resp.status_code == 400


def test_persistence_across_app_restarts(tmp_path):
    import os
    import sys
    import subprocess
    from pathlib import Path

    root = Path(__file__).resolve().parent.parent
    restart_db = tmp_path / "restart_test.db"
    orig_env = os.environ.get("WTE_DB_PATH")
    os.environ["WTE_DB_PATH"] = str(restart_db)

    try:
        payload = {
            "scenario_id": "normal",
            "waste_feed_kg_h": 150.0,
            "reactor_temp_c": 860.0,
        }
        run_resp = client.post("/api/simulation/run", json=payload)
        assert run_resp.status_code == 200
        sim_id = run_resp.json()["scenario_id"]

        # Simulate real restart via a fresh Python subprocess using the app's database code
        code = (
            "import os, sys, asyncio\n"
            "from backend.app.database import get_history_records\n"
            "async def read_db():\n"
            "    records, total = await get_history_records()\n"
            "    if records:\n"
            "        print(records[0]['id'])\n"
            "asyncio.run(read_db())\n"
        )
        env = os.environ.copy()
        env["WTE_DB_PATH"] = str(restart_db)
        env["PYTHONPATH"] = str(root)

        proc = subprocess.run(
            [sys.executable, "-c", code],
            env=env,
            capture_output=True,
            text=True,
            cwd=str(root),
            check=True,
        )
        output_id = proc.stdout.strip().splitlines()[-1]
        assert output_id == sim_id

        # Verify pagination on the isolated DB
        paginated_resp = client.get("/api/history?limit=2&offset=0")
        assert paginated_resp.status_code == 200
        pdata = paginated_resp.json()
        assert "history" in pdata
        assert "total" in pdata
        assert pdata["total"] == 1
        assert len(pdata["history"]) == 1
        assert pdata["history"][0]["id"] == sim_id
    finally:
        if orig_env is not None:
            os.environ["WTE_DB_PATH"] = orig_env
        else:
            os.environ.pop("WTE_DB_PATH", None)


def test_history_record_power_and_efficiency_fields():
    payload = {"scenario_id": "normal"}
    run_resp = client.post("/api/simulation/run", json=payload)
    assert run_resp.status_code == 200
    sim_data = run_resp.json()
    sim_id = sim_data["scenario_id"]

    hist_resp = client.get(f"/api/history/{sim_id}")
    assert hist_resp.status_code == 200
    stored = hist_resp.json()

    assert stored["overall"]["net_power_kw"] is not None
    assert stored["overall"]["electrical_output_kw"] is not None
    assert stored["overall"]["overall_efficiency_pct"] is not None

    assert stored["overall"]["net_power_kw"] == sim_data["overall"]["net_power_kw"]
    assert stored["overall"]["electrical_output_kw"] == sim_data["overall"]["electrical_output_kw"]
    assert stored["overall"]["overall_efficiency_pct"] == sim_data["overall"]["overall_efficiency_pct"]
    # Net power equals gross electrical output minus auxiliary feed pump electrical consumption
    feed_pump_kw = stored["overall"].get("feed_pump_electrical_kw", 0.0)
    assert stored["overall"]["net_power_kw"] == pytest.approx(
        stored["overall"]["electrical_output_kw"] - feed_pump_kw, abs=1e-2
    )


def test_shared_websocket_state():
    import time
    with client.websocket_connect("/ws/simulation") as ws1:
        _ = ws1.receive_json()  # initial connection state
        with client.websocket_connect("/ws/simulation") as ws2:
            _ = ws2.receive_json()  # initial connection state

            # Client 1 commands start
            ws1.send_json({"action": "start", "scenario_id": "normal"})
            time.sleep(0.5)

            msg1 = ws1.receive_json()
            msg2 = ws2.receive_json()

            assert msg1.get("running") is True
            assert msg2.get("running") is True
            assert msg1.get("tick") == msg2.get("tick")

            # Client 2 commands pause
            ws2.send_json({"action": "pause"})
            time.sleep(0.3)

            p1 = ws1.receive_json()
            p2 = ws2.receive_json()
            assert p1.get("running") is False
            assert p2.get("running") is False


def test_websocket_shared_ticks_and_disconnect():
    from backend.app.main import sim_manager
    try:
        with client.websocket_connect("/ws/simulation") as ws1:
            _ = ws1.receive_json()  # initial connection state
            with client.websocket_connect("/ws/simulation") as ws2:
                _ = ws2.receive_json()  # initial connection state

                # Set speed for reliable ticks
                ws1.send_json({"action": "speed", "value": 10.0})
                ws1.send_json({"action": "start", "scenario_id": "normal"})

                ticks1 = []
                ticks2 = []

                # Both receive at least 3 consecutive ticks with identical values
                for _ in range(3):
                    m1 = ws1.receive_json()
                    m2 = ws2.receive_json()
                    assert m1.get("running") is True
                    assert m2.get("running") is True
                    assert m1.get("tick") == m2.get("tick")
                    assert m1["overall"]["electrical_output_kw"] == m2["overall"]["electrical_output_kw"]
                    assert m1["overall"]["net_power_kw"] == m2["overall"]["net_power_kw"]
                    ticks1.append(m1["tick"])
                    ticks2.append(m2["tick"])

                # Verify increasing consecutive tick numbers
                assert len(ticks1) >= 3
                for i in range(len(ticks1) - 1):
                    assert ticks1[i + 1] > ticks1[i]
                    assert ticks2[i + 1] > ticks2[i]
                assert ticks1 == ticks2

                # ws2 disconnects when leaving with ws2

            # After client 2 disconnects, client 1 keeps receiving ticks
            m1_after = ws1.receive_json()
            assert m1_after.get("running") is True
            assert m1_after.get("tick") > ticks1[-1]

            # Pause simulation
            ws1.send_json({"action": "pause"})
            _ = ws1.receive_json()
    finally:
        sim_manager.running = False


def test_fluidization_curve_endpoint():
    """Verify GET /api/fluidization/curve returns full hydrodynamic curves and metadata."""
    response = client.get("/api/fluidization/curve")
    assert response.status_code == 200
    data = response.json()

    # Structural keys
    assert "u_curve" in data
    assert "dp_bed_curve" in data
    assert "dp_distributor_curve" in data
    assert "dp_total_curve" in data
    assert "operating_point" in data
    assert "umf" in data
    assert "ut_m_s" in data
    assert "geldart_group" in data
    assert "assumptions" in data

    # Numerical validity
    assert len(data["u_curve"]) >= 50
    assert len(data["dp_bed_curve"]) == len(data["u_curve"])
    assert data["operating_point"]["regime"] == "bubbling"
    assert data["geldart_group"] == "B"
    assert data["umf"]["wen_yu_m_s"] > 0
    assert data["ut_m_s"] > data["umf"]["wen_yu_m_s"]

    # Test with parameter overrides (higher airflow than default ~661 Nm³/h)
    res_override = client.get("/api/fluidization/curve?airflow_m3_h=800&reactor_temp_c=870")
    assert res_override.status_code == 200
    data_override = res_override.json()
    assert data_override["operating_point"]["u0_m_s"] > data["operating_point"]["u0_m_s"]

    # Test edge case error handling
    res_err = client.get("/api/fluidization/curve?airflow_m3_h=-10")
    assert res_err.status_code == 400


def test_scenarios_comparison_endpoint():
    """Verify GET /api/scenarios/comparison returns all 8 scenarios with required comparison fields."""
    response = client.get("/api/scenarios/comparison")
    assert response.status_code == 200
    data = response.json()
    assert "scenarios" in data
    assert len(data["scenarios"]) == 8

    # Verify each scenario has required comparison fields
    for sc in data["scenarios"]:
        assert "scenario_id" in sc
        assert "equivalence_ratio" in sc
        assert "fluidization" in sc
        assert "u0_over_umf_eff" in sc["fluidization"]
        assert "physics_state" in sc["fluidization"]
        assert "whole_plant_closure" in sc
        assert "net_electrical_power_kw" in sc["whole_plant_closure"]
        assert "district_heat_kw" in sc["whole_plant_closure"]
        assert "overall" in sc
        assert "overall_efficiency_pct" in sc["overall"]
        assert "reactor_heat_balance_kw" in sc

    # Verify defluidized_agglomeration scenario is included
    defluidized = [sc for sc in data["scenarios"] if sc["scenario_id"] == "defluidized_agglomeration"]
    assert len(defluidized) == 1
    assert defluidized[0]["fluidization"]["physics_state"] == "SEVERE_CLUMPING"
    assert defluidized[0]["fluidization"]["u0_over_umf_eff"] < 1.0


