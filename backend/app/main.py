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
import io
import copy
import random
import asyncio
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Set, Dict, Any
from contextlib import asynccontextmanager

from PIL import Image
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT_STR = str(PROJECT_ROOT)
if PROJECT_ROOT_STR not in sys.path:
    sys.path.insert(0, PROJECT_ROOT_STR)

from simulation.engine import (
    run_simulation, ScenarioParams, SCENARIOS, list_scenarios, get_scenario
)
from simulation.fluidization import generate_dp_curve, FluidizationConfig
from ml.anomaly.predict import AnomalyPredictor
from predict import load_vit_model, predict_vit
from backend.app.database import (
    init_db, add_history_record, get_history_records, get_history_record_by_id, count_history_records
)

# Global models and state
anomaly_predictor: Optional[AnomalyPredictor] = None

# YOLO state
yolo_model: Any = None
yolo_model_loaded: bool = False
yolo_weights_path = PROJECT_ROOT / "runs" / "detect" / "medical_waste_yolo" / "run1" / "weights" / "best.pt"

# ViT state
vit_model: Any = None
vit_transforms: Any = None
vit_classes: List[str] = []
vit_device: Any = None
vit_model_loaded: bool = False
vit_weights_path = PROJECT_ROOT / "vit_pbw_model.pth"

# File constraints
MAX_IMAGE_FILE_SIZE = 20 * 1024 * 1024  # 20MB
ALLOWED_IMAGE_MIME = {
    "image/jpeg", "image/png", "image/webp", "image/avif", "image/bmp", "image/tiff"
}


def get_anomaly_predictor() -> AnomalyPredictor:
    """Get or lazily initialize the anomaly predictor."""
    global anomaly_predictor
    if anomaly_predictor is None:
        model_dir = str(PROJECT_ROOT / "models")
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


def init_yolo_model() -> None:
    """Load trained YOLO model at startup."""
    global yolo_model, yolo_model_loaded
    if yolo_weights_path.exists():
        try:
            from ultralytics import YOLO
            yolo_model = YOLO(str(yolo_weights_path))
            yolo_model_loaded = True
            print(f"YOLO model loaded from {yolo_weights_path}")
        except Exception as e:
            print(f"Warning: Could not load YOLO model: {e}")
            yolo_model = None
            yolo_model_loaded = False
    else:
        print(f"Warning: YOLO weights file not found at {yolo_weights_path}")
        yolo_model = None
        yolo_model_loaded = False


def init_vit_model() -> None:
    """Load trained ViT model at startup."""
    global vit_model, vit_transforms, vit_classes, vit_device, vit_model_loaded
    if vit_weights_path.exists():
        try:
            vit_model, vit_transforms, vit_classes, vit_device = load_vit_model(vit_weights_path)
            vit_model_loaded = True
            print(f"ViT model loaded from {vit_weights_path} on {vit_device}")
        except Exception as e:
            print(f"Warning: Could not load ViT model: {e}")
            vit_model = None
            vit_model_loaded = False
    else:
        print(f"Warning: ViT weights file not found at {vit_weights_path}")
        vit_model = None
        vit_model_loaded = False


# ── Shared WebSocket Simulation Manager ──────────────────────

class SharedSimulationManager:
    """
    Manages a single shared plant simulation loop and WebSocket broadcasts.
    All connected clients observe the exact same plant simulation state.
    """

    def __init__(self):
        self.connections: Set[WebSocket] = set()
        self.running: bool = False
        self.speed: float = 1.0
        self.params: ScenarioParams = ScenarioParams()
        self.scenario_id: str = "normal"
        self.tick: int = 0
        self.last_result: Optional[Dict[str, Any]] = None
        self._task: Optional[asyncio.Task] = None
        self._is_active: bool = True
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self.connections.add(ws)

        # Immediately send current state if available
        if self.last_result:
            try:
                await ws.send_json(self.last_result)
            except Exception:
                pass
        else:
            try:
                await ws.send_json({
                    "running": self.running,
                    "tick": self.tick,
                    "speed": self.speed,
                    "scenario_id": self.scenario_id,
                })
            except Exception:
                pass

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self.connections.discard(ws)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        async with self._lock:
            clients = list(self.connections)
        disconnected = []
        for ws in clients:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        if disconnected:
            async with self._lock:
                for ws in disconnected:
                    self.connections.discard(ws)

    def start_background_loop(self) -> None:
        if self._task is None or self._task.done():
            self._is_active = True
            self._task = asyncio.create_task(self._run_loop())

    async def stop_background_loop(self) -> None:
        self._is_active = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run_loop(self) -> None:
        while self._is_active:
            try:
                if self.running:
                    speed = max(0.1, self.speed)
                    p = copy.deepcopy(self.params)

                    # Realistic small stochastic fluctuations
                    p.reactor_temp_c += random.gauss(0, 1.2) * min(speed, 2.0)
                    p.airflow_m3_h += random.gauss(0, 0.7) * min(speed, 2.0)

                    predictor = get_anomaly_predictor()
                    predictor_fn = predictor.predict if (predictor and predictor.loaded) else None
                    result = run_simulation(p, anomaly_predictor=predictor_fn)
                    result["tick"] = self.tick
                    result["sim_time_s"] = self.tick * 5
                    result["speed"] = speed
                    result["running"] = True
                    result["scenario_id"] = self.scenario_id
                    result["scenario_name"] = self.params.name

                    self.last_result = result
                    await self.broadcast(result)
                    self.tick += 1

                    sleep_time = max(0.2, 2.0 / speed)
                    await asyncio.sleep(sleep_time)
                else:
                    await asyncio.sleep(0.3)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error in shared simulation loop: {e}")
                await asyncio.sleep(1.0)


sim_manager = SharedSimulationManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown."""
    # 1. Initialize persistent SQLite database
    await init_db()

    # 2. Lazy or eager models initialization
    get_anomaly_predictor()
    init_yolo_model()
    init_vit_model()

    # 3. Start shared simulation background task
    sim_manager.start_background_loop()

    yield

    # Shutdown
    print("Shutting down background tasks...")
    await sim_manager.stop_background_loop()


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


# ── Health ────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    if not yolo_model_loaded and yolo_weights_path.exists():
        init_yolo_model()
    if not vit_model_loaded and vit_weights_path.exists():
        init_vit_model()
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "anomaly_model_loaded": anomaly_predictor.loaded if anomaly_predictor else False,
        "yolo_model_loaded": yolo_model_loaded,
        "vit_model_loaded": vit_model_loaded,
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
    """Run a complete simulation and persist run in database."""
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
    predictor = get_anomaly_predictor()
    predictor_fn = predictor.predict if (predictor and predictor.loaded) else None
    result = run_simulation(params, anomaly_predictor=predictor_fn)

    # Save to persistent database
    history_entry = {
        "id": result["scenario_id"],
        "timestamp": datetime.now().isoformat(),
        "scenario_name": result["scenario_name"],
        "parameters": result["parameters"],
        "overall": result["overall"],
        "anomaly_state": result["anomaly"]["state"],
    }
    await add_history_record(history_entry, full_result=result)

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


@app.get("/api/fluidization/curve")
async def get_fluidization_curve(
    scenario_id: Optional[str] = Query("normal"),
    airflow_m3_h: Optional[float] = Query(None),
    reactor_temp_c: Optional[float] = Query(None),
    pressure_kpa: Optional[float] = Query(None),
    plastic_ratio: Optional[float] = Query(None),
):
    """
    Get dP vs U0 curve arrays, Umf values, operating point, Geldart group,
    and reactor hydrodynamic design assumptions.
    """
    params = get_scenario(scenario_id) if (scenario_id and scenario_id != "custom") else ScenarioParams()
    
    # Overrides if supplied
    af = airflow_m3_h if airflow_m3_h is not None else params.airflow_m3_h
    temp = reactor_temp_c if reactor_temp_c is not None else params.reactor_temp_c
    p = pressure_kpa if pressure_kpa is not None else params.pressure_kpa
    pr = plastic_ratio if plastic_ratio is not None else params.plastic_ratio
    
    try:
        curve_data = generate_dp_curve(
            reactor_temp_c=temp,
            pressure_kpa=p,
            plastic_ratio=pr,
            current_airflow_m3_h=af,
        )
        return curve_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


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


# ── Vision Inference (YOLO) ──────────────────────────────────

@app.post("/api/vision/inference")
async def vision_inference(
    file: Optional[UploadFile] = File(None),
    synthetic: Optional[bool] = Query(None),
):
    """
    Run YOLOv8 waste detection inference on an uploaded image,
    or opt-in to synthetic demo detection.
    """
    # 1. Real inference branch when image file is uploaded
    if file is not None and file.filename:
        if not yolo_model_loaded and yolo_weights_path.exists():
            init_yolo_model()
        if not yolo_weights_path.exists() or not yolo_model_loaded or yolo_model is None:
            rel_path = yolo_weights_path.relative_to(PROJECT_ROOT).as_posix()
            raise HTTPException(
                status_code=503,
                detail=f"YOLO model weights not found or failed to load. Expected weights at '{rel_path}'."
            )

        try:
            contents = await file.read()
            if len(contents) > MAX_IMAGE_FILE_SIZE:
                raise HTTPException(status_code=413, detail="File too large (exceeds 20MB limit).")
            if len(contents) == 0:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")

            image = Image.open(io.BytesIO(contents)).convert("RGB")
            results = yolo_model(image, conf=0.25)

            detections = []
            class_map = getattr(yolo_model, "names", {
                0: "General", 1: "Infectious", 2: "Pathological", 3: "Sharps"
            })
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

            class_counts: Dict[str, int] = {}
            for d in detections:
                cls_name = d["class"]
                class_counts[cls_name] = class_counts.get(cls_name, 0) + 1

            return {
                "detections": detections,
                "class_counts": class_counts,
                "total_objects": len(detections),
                "mode": "inference",
                "synthetic": False,
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"YOLO inference error: {str(e)}")

    # 2. No file provided: check if synthetic demo mode is allowed
    if synthetic is False:
        raise HTTPException(
            status_code=400,
            detail="No image file provided and synthetic demo mode is explicitly disabled."
        )

    # Opt-in synthetic demo detection
    rnd = random.Random(42)
    demo_classes = ["Infectious", "Plastic", "Glass", "Organic"]
    demo_colors = {
        "Infectious": "#ef4444",
        "Plastic": "#3b82f6",
        "Glass": "#8b5cf6",
        "Organic": "#22c55e",
    }

    detections = []
    n_objects = rnd.randint(3, 8)
    for i in range(n_objects):
        cls_name = rnd.choice(demo_classes)
        detections.append({
            "id": i,
            "class": cls_name,
            "confidence": round(rnd.uniform(0.65, 0.98), 3),
            "bbox": {
                "x": rnd.randint(50, 400),
                "y": rnd.randint(50, 300),
                "width": rnd.randint(40, 120),
                "height": rnd.randint(40, 120),
            },
            "color": demo_colors[cls_name],
        })

    class_counts = {}
    for d in detections:
        cls_name = d["class"]
        class_counts[cls_name] = class_counts.get(cls_name, 0) + 1

    return {
        "detections": detections,
        "class_counts": class_counts,
        "total_objects": len(detections),
        "mode": "demo",
        "synthetic": True,
    }


# ── Vision Classification (ViT-B/16) ─────────────────────────

@app.post("/api/vision/classify")
async def vision_classify(file: UploadFile = File(...)):
    """
    Classify biomedical/pharmaceutical waste image using ViT-B/16.
    Returns top-3 predicted classes with confidence probabilities.
    """
    if file is None or not file.filename:
        raise HTTPException(status_code=400, detail="No image file provided.")

    # 1. Validate file extension and MIME type
    content_type = (file.content_type or "").lower()
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp", ".tiff"}
    ext = Path(file.filename).suffix.lower()
    if content_type not in ALLOWED_IMAGE_MIME and ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{content_type or ext}'. Only image files (JPEG, PNG, WebP, AVIF) are accepted."
        )

    # 2. Check if model is loaded
    if not vit_model_loaded and vit_weights_path.exists():
        init_vit_model()
    if not vit_model_loaded or vit_model is None:
        raise HTTPException(
            status_code=503,
            detail="ViT model is not loaded. Model file vit_pbw_model.pth missing or corrupted."
        )

    # 3. Read content and validate size
    contents = await file.read()
    if len(contents) > MAX_IMAGE_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of {MAX_IMAGE_FILE_SIZE // (1024*1024)}MB."
        )
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # 4. Decode image
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot decode image file: {str(e)}")

    # 5. Run inference
    try:
        predictions = predict_vit(
            model=vit_model,
            transforms=vit_transforms,
            classes=vit_classes,
            device=vit_device,
            image=image,
            top_k=3,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ViT classification inference failed: {str(e)}")

    return {
        "filename": file.filename,
        "top_predictions": predictions,
        "predicted_class": predictions[0]["class"] if predictions else "Unknown",
        "confidence_pct": predictions[0]["confidence_pct"] if predictions else 0.0,
        "probability": predictions[0]["probability"] if predictions else 0.0,
        "device": str(vit_device),
        "model": "ViT-B/16-PBW",
    }


# ── Simulation Status ────────────────────────────────────────

@app.get("/api/simulation/status")
async def simulation_status():
    hist_count = await count_history_records()
    return {
        "active_simulations": 1 if sim_manager.running else 0,
        "connected_clients": len(sim_manager.connections),
        "history_count": hist_count,
        "sim_running": sim_manager.running,
        "sim_tick": sim_manager.tick,
    }


# ── History ───────────────────────────────────────────────────

@app.get("/api/history")
async def get_history(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Retrieve paginated simulation history records."""
    records, total = await get_history_records(limit=limit, offset=offset)
    return {
        "history": records,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@app.get("/api/history/{sim_id}")
async def get_history_entry(sim_id: str):
    """Retrieve full simulation result for a specific run ID."""
    entry = await get_history_record_by_id(sim_id)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Simulation run '{sim_id}' not found")
    return entry


# ── Shared WebSocket Simulation ──────────────────────────────

@app.websocket("/ws/simulation")
async def websocket_simulation(ws: WebSocket):
    """
    Subscribes client to the single shared plant simulation loop.
    All connected clients observe and manipulate the shared digital twin.
    """
    await sim_manager.connect(ws)

    try:
        while True:
            data = await ws.receive_json()
            action = data.get("action", "")

            if action == "start":
                scenario_id = data.get("scenario_id", sim_manager.scenario_id)
                if scenario_id in SCENARIOS:
                    sim_manager.scenario_id = scenario_id
                    sim_manager.params = ScenarioParams(**SCENARIOS[scenario_id].__dict__)

                # Apply overrides
                for key in ["waste_feed_kg_h", "moisture_pct", "plastic_ratio", "organic_ratio",
                           "airflow_m3_h", "reactor_temp_c", "pressure_kpa", "water_flow_kg_h",
                           "boiler_efficiency", "turbine_efficiency"]:
                    if key in data and data[key] is not None:
                        setattr(sim_manager.params, key, data[key])

                sim_manager.running = True
                sim_manager.start_background_loop()

            elif action == "pause":
                sim_manager.running = False
                await sim_manager.broadcast({"running": False, "tick": sim_manager.tick})

            elif action == "reset":
                sim_manager.running = False
                sim_manager.tick = 0
                scenario_id = data.get("scenario_id", "normal")
                if scenario_id in SCENARIOS:
                    sim_manager.scenario_id = scenario_id
                    sim_manager.params = ScenarioParams(**SCENARIOS[scenario_id].__dict__)
                else:
                    sim_manager.params = ScenarioParams()
                sim_manager.last_result = None
                await sim_manager.broadcast({"running": False, "tick": 0, "reset": True})

            elif action == "speed":
                sim_manager.speed = float(data.get("value", 1.0))

            elif action == "update_params":
                for key in ["waste_feed_kg_h", "moisture_pct", "plastic_ratio", "organic_ratio",
                           "airflow_m3_h", "reactor_temp_c", "pressure_kpa", "water_flow_kg_h",
                           "boiler_efficiency", "turbine_efficiency"]:
                    if key in data and data[key] is not None:
                        setattr(sim_manager.params, key, data[key])

            elif action == "correct":
                # Demo correction logic
                p = sim_manager.params
                p.plastic_ratio = 0.20
                p.airflow_m3_h = 130
                p.reactor_temp_c = 860

    except WebSocketDisconnect:
        await sim_manager.disconnect(ws)
    except Exception as e:
        print(f"WebSocket client error: {e}")
        await sim_manager.disconnect(ws)


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

    hist_count = await count_history_records()

    return {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "cuda_available": cuda_available,
        "anomaly_model_loaded": anomaly_predictor.loaded if anomaly_predictor else False,
        "yolo_model_loaded": yolo_model_loaded,
        "vit_model_loaded": vit_model_loaded,
        "history_count": hist_count,
        "disclaimer": (
            "Engineering simulation prototype. Results are model-based approximations "
            "and are not a substitute for validated industrial process simulation, "
            "CFD, plant commissioning, or safety analysis."
        ),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
