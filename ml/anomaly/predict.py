"""
Anomaly Prediction Module
==========================
Loads trained model and provides prediction interface.
"""

import os
import joblib
import numpy as np
from typing import Optional

from ml.anomaly.preprocessing import FEATURE_COLUMNS


class AnomalyPredictor:
    """Loads and runs the trained anomaly detection model."""
    
    def __init__(self, model_dir: str = None):
        if model_dir is None:
            base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            model_dir = os.path.join(base, "models")
        
        self.model = None
        self.scaler = None
        self.label_encoder = None
        self.loaded = False
        
        self._load(model_dir)
    
    def _load(self, model_dir: str):
        """Load model, scaler, and encoder."""
        model_path = os.path.join(model_dir, "anomaly_model.joblib")
        scaler_path = os.path.join(model_dir, "anomaly_scaler.joblib")
        le_path = os.path.join(model_dir, "anomaly_label_encoder.joblib")
        
        if not all(os.path.exists(p) for p in [model_path, scaler_path, le_path]):
            print(f"Warning: Model files not found in {model_dir}")
            return
        
        try:
            self.model = joblib.load(model_path)
            self.scaler = joblib.load(scaler_path)
            self.label_encoder = joblib.load(le_path)
            self.loaded = True
            print("Anomaly detection model loaded successfully")
        except Exception as e:
            print(f"Error loading model: {e}")
    
    def predict(self, features: dict) -> dict:
        """
        Predict anomaly state from feature dictionary.
        
        Features expected:
          bed_temperature, airflow, pressure_drop, plastic_ratio,
          temperature_gradient, airflow_deviation, pressure_deviation
        """
        if not self.loaded:
            return self._fallback_predict(features)
        
        # Build feature vector
        x = np.array([[features.get(col, 0.0) for col in FEATURE_COLUMNS]])
        x_scaled = self.scaler.transform(x)
        
        # Predict
        prediction = self.model.predict(x_scaled)[0]
        probabilities = self.model.predict_proba(x_scaled)[0]
        
        state = self.label_encoder.inverse_transform([prediction])[0]
        confidence = float(max(probabilities))
        
        # Risk level
        risk_map = {
            "NORMAL_FLUIDIZATION": "LOW",
            "EARLY_AGGLOMERATION": "MEDIUM",
            "SEVERE_CLUMPING": "CRITICAL",
        }
        
        # Recommendations
        rec_map = {
            "NORMAL_FLUIDIZATION": "System operating within normal parameters.",
            "EARLY_AGGLOMERATION": (
                "Early signs of bed agglomeration detected. Monitor closely. "
                "Consider reducing plastic fraction or increasing airflow."
            ),
            "SEVERE_CLUMPING": (
                "Severe bed agglomeration detected. Reduce plastic feed ratio, "
                "increase airflow, and raise bed temperature."
            ),
        }
        
        # Contributing factors
        factors = []
        if features.get("plastic_ratio", 0) > 35:
            factors.append(f"High plastic ratio: {features['plastic_ratio']:.1f}%")
        if features.get("bed_temperature", 900) < 800:
            factors.append(f"Low bed temperature: {features['bed_temperature']:.1f}°C")
        if features.get("pressure_drop", 15) > 20:
            factors.append(f"Elevated pressure drop: {features['pressure_drop']:.1f} kPa")
        if features.get("airflow", 120) < 100:
            factors.append(f"Low airflow: {features['airflow']:.1f} m³/h")
        
        return {
            "state": state,
            "confidence": round(confidence, 4),
            "risk_level": risk_map.get(state, "UNKNOWN"),
            "probabilities": {
                cls: round(float(p), 4) 
                for cls, p in zip(self.label_encoder.classes_, probabilities)
            },
            "recommendation": rec_map.get(state, ""),
            "contributing_factors": factors,
            "model_loaded": True,
        }
    
    def _fallback_predict(self, features: dict) -> dict:
        """Rule-based fallback when model isn't loaded."""
        plastic = features.get("plastic_ratio", 20)
        temp = features.get("bed_temperature", 850)
        pressure = features.get("pressure_drop", 15.2)
        airflow = features.get("airflow", 120)
        
        if plastic >= 45 and temp < 780 and pressure > 22:
            state = "SEVERE_CLUMPING"
            conf = 0.88
        elif plastic >= 35 and (temp < 830 or pressure > 17):
            state = "EARLY_AGGLOMERATION"
            conf = 0.75
        else:
            state = "NORMAL_FLUIDIZATION"
            conf = 0.82
        
        risk_map = {
            "NORMAL_FLUIDIZATION": "LOW",
            "EARLY_AGGLOMERATION": "MEDIUM",
            "SEVERE_CLUMPING": "CRITICAL",
        }
        
        return {
            "state": state,
            "confidence": conf,
            "risk_level": risk_map[state],
            "recommendation": "Rule-based prediction (model not loaded).",
            "model_loaded": False,
        }
    
    def __call__(self, features: dict) -> dict:
        return self.predict(features)
