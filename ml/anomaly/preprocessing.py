"""
Anomaly Detection Preprocessing
================================
Feature engineering and data preparation for anomaly classifier.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from typing import Tuple


FEATURE_COLUMNS = [
    "bed_temperature",
    "airflow", 
    "pressure_drop",
    "plastic_ratio",
    "temperature_gradient",
    "airflow_deviation",
    "pressure_deviation",
]


def preprocess_data(
    df: pd.DataFrame,
    test_size: float = 0.2,
    val_size: float = 0.1,
    seed: int = 42,
) -> dict:
    """
    Preprocess anomaly dataset for training.
    
    Returns dict with train/val/test splits, scaler, and encoder.
    """
    # Encode labels
    le = LabelEncoder()
    df["state_encoded"] = le.fit_transform(df["state"])
    
    X = df[FEATURE_COLUMNS].values
    y = df["state_encoded"].values
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Split: train / temp
    X_train, X_temp, y_train, y_temp = train_test_split(
        X_scaled, y, test_size=(test_size + val_size), random_state=seed, stratify=y
    )
    
    # Split temp into val / test
    relative_test = test_size / (test_size + val_size)
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=relative_test, random_state=seed, stratify=y_temp
    )
    
    return {
        "X_train": X_train, "y_train": y_train,
        "X_val": X_val, "y_val": y_val,
        "X_test": X_test, "y_test": y_test,
        "scaler": scaler,
        "label_encoder": le,
        "feature_columns": FEATURE_COLUMNS,
        "class_names": list(le.classes_),
    }
