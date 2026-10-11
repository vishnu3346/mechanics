"""
Physics-Based Anomaly Dataset Generator
=======================================
Generates synthetic sensor telemetry for fluidized-bed gasification anomaly detection
by sampling physical operating conditions and executing the full hydrodynamic and
thermochemical simulation models.

States are defined purely from physics quantities (U0/Umf_eff, U0/Ut, dP_bed vs expected,
temperature margins).

Documented Measurement Noise Levels:
  - Bed temperature thermocouple: Gaussian noise σ = 3.0 °C
  - Primary airflow orifice meter: Gaussian noise σ = 1.5 Nm³/h
  - Differential pressure transducer: Gaussian noise σ = 0.15 kPa
  - Online plastic ratio estimate: Gaussian noise σ = 1.0 %
"""

import os
import sys
import math
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

# Add repository root to path if running directly
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from simulation.engine import calculate_stoichiometric_airflow, DEFAULT_AIRFLOW_NM3_H
from simulation.fluidization import FluidizationConfig, calculate_fluidization, classify_physics_state

# Documented sensor measurement noise levels
SENSOR_NOISE_CONFIG = {
    "bed_temperature_sigma_c": 3.0,     # Thermocouple precision (±3 °C)
    "airflow_sigma_nm3_h": 1.5,         # Primary airflow transmitter (±1.5 Nm³/h)
    "pressure_drop_sigma_kpa": 0.15,    # Differential pressure transducer (±0.15 kPa)
    "plastic_ratio_sigma_pct": 1.0,     # Optical/feeder NIR compositional estimator (±1.0%)
}


def generate_anomaly_dataset(
    n_groups: int = 400,
    samples_per_group: int = 8,
    seed: int = 42,
    output_dir: str = None,
) -> pd.DataFrame:
    """
    Generate physics-labeled anomaly dataset.

    Parameters:
      n_groups: Number of unique operating condition clusters (for grouped train/test split)
      samples_per_group: Repeated noisy sensor telemetry observations per operating condition
      seed: Fixed random seed for strict reproducibility
      output_dir: Directory where anomaly_dataset.csv should be written

    Sampled operating conditions:
      - feed rate: 300 to 800 kg/h
      - moisture: 5 to 35 %
      - plastic ratio: 0.05 to 0.60
      - equivalence ratio (ER): 0.15 to 0.42
      - temperature: 680 to 980 °C
      - particle size (d_p): 300 to 500 µm
      - agglomeration index (a): 0.0 to 0.95 (multi-modal sampling)

    Returns:
      pd.DataFrame containing telemetry features, operating condition group_id, and physics label.
    """
    rng = np.random.RandomState(seed)
    
    rows = []
    start_time = datetime(2026, 1, 1, 0, 0, 0)
    sample_counter = 0

    for gid in range(n_groups):
        # 1. Sample operating conditions
        feed = rng.uniform(300.0, 800.0)
        moist = rng.uniform(5.0, 35.0)
        plastic = rng.uniform(0.05, 0.60)
        er = rng.uniform(0.15, 0.42)
        temp = rng.uniform(680.0, 980.0)
        dp = rng.uniform(300e-6, 500e-6)

        # Multi-modal sampling of agglomeration index to ensure balanced class representation:
        # ~40% clean bed (0.0 to 0.20), ~30% moderate agglomeration (0.20 to 0.50), ~30% severe (0.50 to 0.95)
        mode_roll = rng.rand()
        if mode_roll < 0.40:
            agg = rng.uniform(0.0, 0.20)
        elif mode_roll < 0.70:
            agg = rng.uniform(0.20, 0.50)
        else:
            agg = rng.uniform(0.50, 0.95)

        # 2. Run hydrodynamic and gasification physics models
        af = calculate_stoichiometric_airflow(feed, moist, target_er=er)
        cfg = FluidizationConfig(d_p=dp)
        fl = calculate_fluidization(
            airflow_m3_h=af,
            reactor_temp_c=temp,
            pressure_kpa=101.325,
            plastic_ratio=plastic,
            config=cfg,
            agglomeration_index=agg,
            d_p=dp,
        )

        # 3. Pure physics label assignment
        state = fl.physics_state
        risk_level = fl.physics_risk_level
        physics_reason = fl.physics_reason

        # 4. Generate repeated noisy measurements under this operating condition
        # Standardized telemetry baseline: 120.0 m³/h airflow and 15.2 kPa pressure drop at nominal design point
        telemetry_af_nominal = 120.0 * (af / DEFAULT_AIRFLOW_NM3_H)
        telemetry_pd_nominal = 15.2 * (fl.dp_total_kpa / 8.58)

        for _ in range(samples_per_group):
            noisy_temp = temp + rng.normal(0, SENSOR_NOISE_CONFIG["bed_temperature_sigma_c"])
            noisy_af = max(10.0, telemetry_af_nominal + rng.normal(0, SENSOR_NOISE_CONFIG["airflow_sigma_nm3_h"]))
            noisy_pd = max(1.0, telemetry_pd_nominal + rng.normal(0, SENSOR_NOISE_CONFIG["pressure_drop_sigma_kpa"]))
            noisy_pl = max(0.0, min(100.0, plastic * 100.0 + rng.normal(0, SENSOR_NOISE_CONFIG["plastic_ratio_sigma_pct"])))

            # Normalized deviation features relative to standardized plant baseline
            temp_gradient = (850.0 - noisy_temp) / 100.0
            airflow_dev = (120.0 - noisy_af) / 120.0
            pressure_dev = (noisy_pd - 15.2) / 15.2

            timestamp = start_time + timedelta(minutes=sample_counter * 5)
            sample_counter += 1

            rows.append({
                "timestamp": timestamp.isoformat(),
                "group_id": gid,
                # Sampled operating conditions
                "waste_feed_kg_h": round(feed, 2),
                "moisture_pct": round(moist, 2),
                "plastic_ratio_fraction": round(plastic, 4),
                "equivalence_ratio": round(er, 4),
                "base_dp_um": round(dp * 1e6, 1),
                "agglomeration_index": round(agg, 4),
                # Noisy plant telemetry features (Observable)
                "bed_temperature": round(noisy_temp, 2),
                "airflow": round(noisy_af, 2),
                "pressure_drop": round(noisy_pd, 2),
                "plastic_ratio": round(noisy_pl, 2),
                "temperature_gradient": round(temp_gradient, 4),
                "airflow_deviation": round(airflow_dev, 4),
                "pressure_deviation": round(pressure_dev, 4),
                # Direct physics ratios (Label-defining quantities)
                "u0_over_umf_eff": round(fl.u0_over_umf_eff, 4),
                "u0_over_ut": round(fl.u0_over_ut, 4),
                "dp_ratio": round(fl.dp_ratio, 4),
                # Ground truth physics target
                "state": state,
                "risk_level": risk_level,
                "physics_reason": physics_reason,
            })

    df = pd.DataFrame(rows)

    # Check class distributions and enforce >= 5% rule
    total = len(df)
    class_counts = df["state"].value_counts()
    class_proportions = df["state"].value_counts(normalize=True) * 100.0

    print(f"Generated {total} total physics-evaluated samples across {n_groups} operating groups.")
    print("Class Counts & Proportions:")
    for cls_name, count in class_counts.items():
        pct = class_proportions[cls_name]
        print(f"  {cls_name:24s}: {count:5d} ({pct:6.2f}%)")
        if pct < 5.0:
            raise RuntimeError(
                f"Sampling defect: Class {cls_name} has {pct:.2f}% of samples (< 5.0%). "
                "Adjust operating condition sampling distributions, NOT the physics thresholds!"
            )

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        path = os.path.join(output_dir, "anomaly_dataset.csv")
        df.to_csv(path, index=False)
        print(f"Dataset successfully written to {path}")

    return df


if __name__ == "__main__":
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    output = os.path.join(base, "data", "generated")
    df = generate_anomaly_dataset(output_dir=output)
