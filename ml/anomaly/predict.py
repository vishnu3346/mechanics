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
        """Rule-based physics fallback when model isn't loaded."""
        plastic = float(features.get("plastic_ratio", 20.0))
        temp = float(features.get("bed_temperature", 850.0))
        pressure = float(features.get("pressure_drop", 15.2))
        airflow = float(features.get("airflow", 120.0))
        
        # Check if direct physics quantities are supplied
        if "u0_over_umf_eff" in features and "u0_over_ut" in features and "dp_ratio" in features:
            from simulation.fluidization import classify_physics_state
            state, risk, reason = classify_physics_state(
                u0=features.get("u0_m_s", 0.567),
                umf_eff=features.get("umf_effective_m_s", 0.056),
                ut=features.get("ut_m_s", 2.8),
                dp_bed=pressure,
                dp_expected=8.58,
                temp_c=temp
            )
            conf = 0.90
        elif temp < 650.0 or temp > 1020.0 or (plastic >= 45.0 and temp < 780.0) or (pressure > 25.0) or (airflow < 80.0 and plastic >= 35.0):
            state = "SEVERE_CLUMPING"
            conf = 0.88
        elif temp < 750.0 or temp > 930.0 or plastic >= 35.0 or pressure > 18.0 or airflow < 105.0:
            state = "EARLY_AGGLOMERATION"
            conf = 0.78
        else:
            state = "NORMAL_FLUIDIZATION"
            conf = 0.84
        
        risk_map = {
            "NORMAL_FLUIDIZATION": "LOW",
            "EARLY_AGGLOMERATION": "MEDIUM",
            "SEVERE_CLUMPING": "CRITICAL",
        }
        
        rec_map = {
            "NORMAL_FLUIDIZATION": "System operating within normal parameters.",
            "EARLY_AGGLOMERATION": (
                "Early signs of bed agglomeration detected. Monitor closely. "
                "Consider reducing plastic fraction or increasing airflow."
            ),
            "SEVERE_CLUMPING": (
                "Severe bed agglomeration or defluidization detected. Reduce plastic feed ratio, "
                "increase airflow, and raise bed temperature."
            ),
        }
        
        # Approximate posterior probabilities for UI consistency
        probs = {
            "NORMAL_FLUIDIZATION": 0.08,
            "EARLY_AGGLOMERATION": 0.08,
            "SEVERE_CLUMPING": 0.08,
        }
        probs[state] = round(conf, 2)
        rem = round((1.0 - conf) / 2.0, 2)
        for k in probs:
            if k != state:
                probs[k] = rem

        factors = []
        if plastic > 35:
            factors.append(f"High plastic ratio: {plastic:.1f}%")
        if temp < 800:
            factors.append(f"Low bed temperature: {temp:.1f}°C")
        if pressure > 20:
            factors.append(f"Elevated pressure drop: {pressure:.1f} kPa")
        if airflow < 100:
            factors.append(f"Low airflow: {airflow:.1f} m³/h")

        return {
            "state": state,
            "confidence": conf,
            "risk_level": risk_map.get(state, "LOW"),
            "probabilities": probs,
            "recommendation": rec_map.get(state, "Rule-based fallback assessment."),
            "contributing_factors": factors,
            "model_loaded": False,
        }
    
    def __call__(self, features: dict) -> dict:
        return self.predict(features)
