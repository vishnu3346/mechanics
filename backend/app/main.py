"""
Medical Waste-to-Energy Backend Application
=============================================
FastAPI backend serving simulation, ML inference, and WebSocket APIs.

Engineering simulation prototype. Results are model-based approximations
and are not a substitute for validated industrial process simulation,
CFD, plant commissioning, or safety analysis.
"""

import os
import sys
import json
import time
import asyncio
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Add project root to path
PROJECT_ROOT = str(Path(__file__).parent.parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from simulation.engine import (
    run_simulation, ScenarioParams, SCENARIOS, list_scenarios, get_scenario
)
from ml.anomaly.predict import AnomalyPredictor

# Global state
anomaly_predictor: Optional[AnomalyPredictor] = None
simulation_history: list = []
active_simulations: dict = {}


def get_anomaly_predictor() -> AnomalyPredictor:
    """Get or lazily initialize the anomaly predictor."""
    global anomaly_predictor
    if anomaly_predictor is None:
        model_dir = os.path.join(PROJECT_ROOT, "models")
        try:
            anomaly_predictor = AnomalyPredictor(model_dir)
        except Exception as e:
            print(f"Warning: Could not load anomaly model: {e}")
            anomaly_predictor = AnomalyPredictor.__new__(AnomalyPredictor)
            anomaly_predictor.loaded = False
            anomaly_predictor.model = None
            anomaly_predictor.scaler = None
            anomaly_predictor.label_encoder = None
    return anomaly_predictor


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown."""
    get_anomaly_predictor()
    yield
    print("Shutting down...")


app = FastAPI(
    title="Medical Waste-to-Energy Simulation API",
    description="AI-driven medical waste gasification simulation and anomaly detection",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic Models ──────────────────────────────────────────

class SimulationRequest(BaseModel):
    scenario_id: Optional[str] = "normal"
    waste_feed_kg_h: Optional[float] = None
    moisture_pct: Optional[float] = None
    plastic_ratio: Optional[float] = None
    organic_ratio: Optional[float] = None
    airflow_m3_h: Optional[float] = None
    reactor_temp_c: Optional[float] = None
    pressure_kpa: Optional[float] = None
    water_flow_kg_h: Optional[float] = None
    boiler_efficiency: Optional[float] = None
    turbine_efficiency: Optional[float] = None


class AnomalyRequest(BaseModel):
    bed_temperature: float = 850.0
    airflow: float = 120.0
    pressure_drop: float = 15.2
    plastic_ratio: float = 20.0


class VisionResponse(BaseModel):
    detections: list = []
    class_counts: dict = {}
    mode: str = "demo"
    total_objects: int = 0


# ── Health ────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "anomaly_model_loaded": anomaly_predictor.loaded if anomaly_predictor else False,
        "version": "1.0.0",
        "disclaimer": (
            "Engineering simulation prototype. Results are model-based approximations "
            "and are not a substitute for validated industrial process simulation, "
            "CFD, plant commissioning, or safety analysis."
        ),
    }


# ── Scenarios ─────────────────────────────────────────────────

@app.get("/api/scenarios")
async def get_scenarios():
    base_scenarios = list_scenarios()
    scenarios = []
    for sc in base_scenarios:
        sid = sc["id"]
        params = SCENARIOS.get(sid)
        scenarios.append({
            **sc,
            "parameters": params.__dict__ if params else ScenarioParams().__dict__,
        })
    # Add custom scenario option
    scenarios.append({
        "id": "custom",
        "name": "Custom Scenario",
        "description": "Configure all parameters manually.",
        "parameters": ScenarioParams().__dict__,
    })
    return {"scenarios": scenarios}



@app.get("/api/scenarios/{scenario_id}")
async def get_scenario_details(scenario_id: str):
    if scenario_id == "custom":
        return {"id": "custom", "name": "Custom Scenario", "params": ScenarioParams().__dict__}
    scenario = SCENARIOS.get(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")
    return {"id": scenario_id, "name": scenario.name, "params": scenario.__dict__}


@app.post("/api/scenarios/{scenario_id}/run")
async def run_scenario_endpoint(scenario_id: str):
    res = await run_sim(SimulationRequest(scenario_id=scenario_id))
    return {"result": res, **res}



# ── Simulation ────────────────────────────────────────────────

@app.post("/api/simulation/run")
async def run_sim(request: SimulationRequest):
    """Run a complete simulation."""
    # Get base scenario
    if request.scenario_id and request.scenario_id != "custom":
        params = get_scenario(request.scenario_id)
        params = ScenarioParams(**params.__dict__)  # copy
    else:
        params = ScenarioParams(name="Custom Scenario")
    
    # Override with request values
    if request.waste_feed_kg_h is not None:
        params.waste_feed_kg_h = request.waste_feed_kg_h
    if request.moisture_pct is not None:
        params.moisture_pct = request.moisture_pct
    if request.plastic_ratio is not None:
        params.plastic_ratio = request.plastic_ratio
    if request.organic_ratio is not None:
        params.organic_ratio = request.organic_ratio
    if request.airflow_m3_h is not None:
        params.airflow_m3_h = request.airflow_m3_h
    if request.reactor_temp_c is not None:
        params.reactor_temp_c = request.reactor_temp_c
    if request.pressure_kpa is not None:
        params.pressure_kpa = request.pressure_kpa
    if request.water_flow_kg_h is not None:
        params.water_flow_kg_h = request.water_flow_kg_h
    if request.boiler_efficiency is not None:
        params.boiler_efficiency = request.boiler_efficiency
    if request.turbine_efficiency is not None:
        params.turbine_efficiency = request.turbine_efficiency
    
    # Ensure ratios sum properly
    if params.plastic_ratio + params.organic_ratio > 0.95:
        params.glass_ratio = 0.025
        params.infectious_ratio = 0.025
    else:
        remaining = 1.0 - params.plastic_ratio - params.organic_ratio
        params.glass_ratio = remaining * 0.33
        params.infectious_ratio = remaining * 0.67
    
    # Run simulation with anomaly predictor
    predictor_fn = anomaly_predictor.predict if (anomaly_predictor and anomaly_predictor.loaded) else None
    result = run_simulation(params, anomaly_predictor=predictor_fn)
    
    # Save to history
    history_entry = {
        "id": result["scenario_id"],
        "timestamp": datetime.now().isoformat(),
        "scenario_name": result["scenario_name"],
        "parameters": result["parameters"],
        "overall": result["overall"],
        "anomaly_state": result["anomaly"]["state"],
    }
    simulation_history.append(history_entry)
    # Keep last 100
    if len(simulation_history) > 100:
        simulation_history.pop(0)
    
    return result


@app.post("/api/simulation/validate")
async def validate_sim(request: SimulationRequest):
    """Validate simulation parameters without running."""
    errors = []
    if request.waste_feed_kg_h is not None and request.waste_feed_kg_h <= 0:
        errors.append("Waste feed rate must be positive")
    if request.moisture_pct is not None and not (0 <= request.moisture_pct <= 100):
        errors.append("Moisture must be 0-100%")
    if request.plastic_ratio is not None and not (0 <= request.plastic_ratio <= 1):
        errors.append("Plastic ratio must be 0-1")
    if request.airflow_m3_h is not None and request.airflow_m3_h <= 0:
        errors.append("Airflow must be positive")
    if request.reactor_temp_c is not None and not (400 <= request.reactor_temp_c <= 1200):
        errors.append("Temperature must be 400-1200°C")
    
    return {"valid": len(errors) == 0, "errors": errors}


# ── Anomaly Detection ────────────────────────────────────────

@app.post("/api/anomaly/predict")
async def predict_anomaly(request: AnomalyRequest):
    """Run anomaly detection on given parameters."""
    features = {
        "bed_temperature": request.bed_temperature,
        "airflow": request.airflow,
        "pressure_drop": request.pressure_drop,
        "plastic_ratio": request.plastic_ratio,
        "temperature_gradient": (850 - request.bed_temperature) / 100,
        "airflow_deviation": (120 - request.airflow) / 120,
        "pressure_deviation": (request.pressure_drop - 15.2) / 15.2,
    }
    
    predictor = get_anomaly_predictor()
    if predictor and predictor.loaded:
        result = predictor.predict(features)
    else:
        result = predictor._fallback_predict(features) if predictor else {
            "state": "NORMAL_FLUIDIZATION",
            "confidence": 0.85,
            "risk_level": "LOW",
            "model_loaded": False,
        }
    
    return result


# ── Vision ────────────────────────────────────────────────────

@app.post("/api/vision/inference")
async def vision_inference(file: UploadFile = File(None)):
    """Run waste detection inference."""
    # Demo mode: return synthetic detections
    import random
    random.seed(42)
    
    classes = ["Infectious", "Plastic", "Glass", "Organic"]
    colors = {
        "Infectious": "#ef4444",
        "Plastic": "#3b82f6", 
        "Glass": "#8b5cf6",
        "Organic": "#22c55e",
    }
    
    detections = []
    n_objects = random.randint(3, 8)
    
    for i in range(n_objects):
        cls = random.choice(classes)
        detections.append({
            "id": i,
            "class": cls,
            "confidence": round(random.uniform(0.65, 0.98), 3),
            "bbox": {
                "x": random.randint(50, 400),
                "y": random.randint(50, 300),
                "width": random.randint(40, 120),
                "height": random.randint(40, 120),
            },
            "color": colors[cls],
        })
    
    class_counts = {}
    for d in detections:
        cls = d["class"]
        class_counts[cls] = class_counts.get(cls, 0) + 1
    
    mode = "demo"
    
    # Try real inference if model exists
    yolo_path = os.path.join(PROJECT_ROOT, "weights", "yolo26n.pt")
    yolo_path_alt = os.path.join(PROJECT_ROOT, "yolov8s.pt")
    
    if file and (os.path.exists(yolo_path) or os.path.exists(yolo_path_alt)):
        try:
            from ultralytics import YOLO
            from PIL import Image
            import io
            
            model_file = yolo_path if os.path.exists(yolo_path) else yolo_path_alt
            model = YOLO(model_file)
            
            contents = await file.read()
            image = Image.open(io.BytesIO(contents))
            
            results = model(image, conf=0.25)
            
            detections = []
            class_map = {0: "General", 1: "Infectious", 2: "Pathological", 3: "Sharps"}
            color_map = {
                "General": "#3b82f6",
                "Infectious": "#ef4444",
                "Pathological": "#f59e0b",
                "Sharps": "#8b5cf6",
            }
            
            for r in results:
                for i, box in enumerate(r.boxes):
                    cls_id = int(box.cls[0])
                    cls_name = class_map.get(cls_id, f"Class_{cls_id}")
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    
                    detections.append({
                        "id": i,
                        "class": cls_name,
                        "confidence": round(conf, 3),
                        "bbox": {
                            "x": round(x1),
                            "y": round(y1),
                            "width": round(x2 - x1),
                            "height": round(y2 - y1),
                        },
                        "color": color_map.get(cls_name, "#6b7280"),
                    })
            
            class_counts = {}
            for d in detections:
                cls = d["class"]
                class_counts[cls] = class_counts.get(cls, 0) + 1
            
            mode = "inference"
        except Exception as e:
            print(f"YOLO inference error: {e}")
            mode = "demo"
    
    return {
        "detections": detections,
        "class_counts": class_counts,
        "total_objects": len(detections),
        "mode": mode,
    }


# ── Simulation Status ────────────────────────────────────────

@app.get("/api/simulation/status")
async def simulation_status():
    return {
        "active_simulations": len(active_simulations),
        "history_count": len(simulation_history),
    }


# ── History ───────────────────────────────────────────────────

@app.get("/api/history")
async def get_history():
    return {"history": list(reversed(simulation_history))}


@app.get("/api/history/{sim_id}")
async def get_history_entry(sim_id: str):
    for entry in simulation_history:
        if entry["id"] == sim_id:
            return entry
    raise HTTPException(status_code=404, detail="Simulation not found")


# ── WebSocket ─────────────────────────────────────────────────

class SimulationManager:
    """Manages WebSocket simulation sessions."""
    
    def __init__(self):
        self.connections: dict[str, WebSocket] = {}
        self.running: dict[str, bool] = {}
        self.speed: dict[str, float] = {}
        self.params: dict[str, ScenarioParams] = {}
    
    async def connect(self, ws: WebSocket, session_id: str):
        await ws.accept()
        self.connections[session_id] = ws
        self.running[session_id] = False
        self.speed[session_id] = 1.0
        self.params[session_id] = ScenarioParams()
    
    def disconnect(self, session_id: str):
        self.connections.pop(session_id, None)
        self.running.pop(session_id, None)
        self.speed.pop(session_id, None)
        self.params.pop(session_id, None)
    
    async def run_live(self, session_id: str):
        """Run live simulation loop."""
        ws = self.connections.get(session_id)
        if not ws:
            return
        
        tick = 0
        self.running[session_id] = True
        
        while self.running.get(session_id, False):
            params = self.params.get(session_id, ScenarioParams())
            speed = self.speed.get(session_id, 1.0)
            
            # Add small time-varying perturbations for realism
            import random
            import copy
            p = copy.deepcopy(params)
            
            # Small oscillations
            p.reactor_temp_c += random.gauss(0, 2) * speed
            p.airflow_m3_h += random.gauss(0, 1) * speed
            
            # Run simulation
            predictor_fn = anomaly_predictor.predict if (anomaly_predictor and anomaly_predictor.loaded) else None
            result = run_simulation(p, anomaly_predictor=predictor_fn)
            result["tick"] = tick
            result["sim_time_s"] = tick * 5  # 5 seconds per tick
            result["speed"] = speed
            result["running"] = True
            
            try:
                await ws.send_json(result)
            except Exception:
                break
            
            tick += 1
            await asyncio.sleep(max(0.5, 2.0 / speed))
        
        # Send stopped signal
        try:
            await ws.send_json({"running": False, "tick": tick})
        except Exception:
            pass


sim_manager = SimulationManager()


@app.websocket("/ws/simulation")
async def websocket_simulation(ws: WebSocket):
    session_id = str(uuid.uuid4())[:8]
    await sim_manager.connect(ws, session_id)
    
    try:
        while True:
            data = await ws.receive_json()
            action = data.get("action", "")
            
            if action == "start":
                # Load scenario
                scenario_id = data.get("scenario_id", "normal")
                if scenario_id in SCENARIOS:
                    sim_manager.params[session_id] = ScenarioParams(**SCENARIOS[scenario_id].__dict__)
                
                # Apply overrides
                for key in ["waste_feed_kg_h", "moisture_pct", "plastic_ratio", "organic_ratio",
                           "airflow_m3_h", "reactor_temp_c", "pressure_kpa", "water_flow_kg_h",
                           "boiler_efficiency", "turbine_efficiency"]:
                    if key in data:
                        setattr(sim_manager.params[session_id], key, data[key])
                
                # Start simulation loop
                asyncio.create_task(sim_manager.run_live(session_id))
            
            elif action == "pause":
                sim_manager.running[session_id] = False
            
            elif action == "reset":
                sim_manager.running[session_id] = False
                sim_manager.params[session_id] = ScenarioParams()
            
            elif action == "speed":
                sim_manager.speed[session_id] = data.get("value", 1.0)
            
            elif action == "update_params":
                for key in ["waste_feed_kg_h", "moisture_pct", "plastic_ratio", "organic_ratio",
                           "airflow_m3_h", "reactor_temp_c", "pressure_kpa", "water_flow_kg_h"]:
                    if key in data:
                        setattr(sim_manager.params[session_id], key, data[key])
            
            elif action == "correct":
                # Apply correction for demo
                p = sim_manager.params[session_id]
                p.plastic_ratio = 0.20
                p.airflow_m3_h = 130
                p.reactor_temp_c = 860
    
    except WebSocketDisconnect:
        sim_manager.disconnect(session_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        sim_manager.disconnect(session_id)


# ── System Info ───────────────────────────────────────────────

@app.get("/api/system")
async def system_info():
    import platform
    
    cuda_available = False
    try:
        import torch
        cuda_available = torch.cuda.is_available()
    except ImportError:
        pass
    
    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "cuda_available": cuda_available,
        "anomaly_model_loaded": anomaly_predictor.loaded if anomaly_predictor else False,
        "history_count": len(simulation_history),
        "disclaimer": (
            "Engineering simulation prototype. Results are model-based approximations "
            "and are not a substitute for validated industrial process simulation, "
            "CFD, plant commissioning, or safety analysis."
        ),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
