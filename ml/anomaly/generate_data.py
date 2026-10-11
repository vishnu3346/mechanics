"""
Anomaly Dataset Generator
=========================
Generates synthetic time-series data for fluidized-bed anomaly detection.

States:
  NORMAL_FLUIDIZATION: Stable operation at ~850°C, 120 m³/h, 15.2 kPa
  EARLY_AGGLOMERATION: Degraded at ~820°C, 115 m³/h, 18.1 kPa
  SEVERE_CLUMPING: Critical at ~750°C, 95 m³/h, 28.0 kPa
"""

import numpy as np
import pandas as pd
import os
from datetime import datetime, timedelta


# Reference conditions for each state
STATE_PARAMS = {
    "NORMAL_FLUIDIZATION": {
        "bed_temperature": (850, 15),
        "airflow": (120, 5),
        "pressure_drop": (15.2, 1.5),
        "plastic_ratio": (20, 5),
    },
    "EARLY_AGGLOMERATION": {
        "bed_temperature": (820, 12),
        "airflow": (115, 8),
        "pressure_drop": (18.1, 2.0),
        "plastic_ratio": (40, 6),
    },
    "SEVERE_CLUMPING": {
        "bed_temperature": (750, 20),
        "airflow": (95, 10),
        "pressure_drop": (28.0, 3.5),
        "plastic_ratio": (50, 5),
    },
}


def generate_anomaly_dataset(
    n_samples_per_class: int = 2000,
    seed: int = 42,
    output_dir: str = None,
) -> pd.DataFrame:
    """
    Generate synthetic anomaly detection dataset.
    
    Each sample includes:
      - timestamp
      - bed_temperature (°C)
      - airflow (m³/h)
      - pressure_drop (kPa)
      - plastic_ratio (%)
      - temperature_gradient (derived)
      - airflow_deviation (derived)
      - pressure_deviation (derived)
      - state (target label)
    """
    np.random.seed(seed)
    
    all_data = []
    start_time = datetime(2024, 1, 1)
    
    for state, params in STATE_PARAMS.items():
        for i in range(n_samples_per_class):
            temp_mean, temp_std = params["bed_temperature"]
            air_mean, air_std = params["airflow"]
            press_mean, press_std = params["pressure_drop"]
            plast_mean, plast_std = params["plastic_ratio"]
            
            temp = np.clip(np.random.normal(temp_mean, temp_std), 600, 1000)
            airflow = np.clip(np.random.normal(air_mean, air_std), 50, 200)
            pressure = np.clip(np.random.normal(press_mean, press_std), 5, 50)
            plastic = np.clip(np.random.normal(plast_mean, plast_std), 0, 80)
            
            # Derived features
            temp_gradient = (850 - temp) / 100
            airflow_dev = (120 - airflow) / 120
            pressure_dev = (pressure - 15.2) / 15.2
            
            timestamp = start_time + timedelta(minutes=i * 5)
            
            all_data.append({
                "timestamp": timestamp.isoformat(),
                "bed_temperature": round(temp, 2),
                "airflow": round(airflow, 2),
                "pressure_drop": round(pressure, 2),
                "plastic_ratio": round(plastic, 2),
                "temperature_gradient": round(temp_gradient, 4),
                "airflow_deviation": round(airflow_dev, 4),
                "pressure_deviation": round(pressure_dev, 4),
                "state": state,
            })
    
    df = pd.DataFrame(all_data)
    df = df.sample(frac=1, random_state=seed).reset_index(drop=True)
    
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        path = os.path.join(output_dir, "anomaly_dataset.csv")
        df.to_csv(path, index=False)
        print(f"Dataset saved to {path}")
        print(f"Total samples: {len(df)}")
        print(f"Class distribution:\n{df['state'].value_counts()}")
    
    return df


if __name__ == "__main__":
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output = os.path.join(base, "data", "generated")
    df = generate_anomaly_dataset(output_dir=output)
    print(f"\nGenerated {len(df)} samples")
