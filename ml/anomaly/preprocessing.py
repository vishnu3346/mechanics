"""
Anomaly Detection Preprocessing
================================
Feature engineering and data preparation for anomaly classifier.
Supports operating-condition grouped splitting to prevent cross-condition data leakage.
"""

from typing import List, Optional, Dict, Any
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, GroupShuffleSplit


# Standard plant telemetry observable features (Clean model without label leakage)
FEATURE_COLUMNS = [
    "bed_temperature",
    "airflow", 
    "pressure_drop",
    "plastic_ratio",
    "temperature_gradient",
    "airflow_deviation",
    "pressure_deviation",
]

# Direct physics ratio indicators used in label definition (Used to demonstrate leakage)
LABEL_DEFINING_COLUMNS = [
    "u0_over_umf_eff",
    "u0_over_ut",
    "dp_ratio",
]

# Combined feature set for leakage demonstration
LEAKAGE_FEATURE_COLUMNS = FEATURE_COLUMNS + LABEL_DEFINING_COLUMNS


def preprocess_data(
    df: pd.DataFrame,
    test_size: float = 0.20,
    val_size: float = 0.10,
    seed: int = 42,
    feature_cols: Optional[List[str]] = None,
    group_col: Optional[str] = "group_id",
) -> Dict[str, Any]:
    """
    Preprocess anomaly dataset for training.
    
    If group_col is present in df, uses GroupShuffleSplit to ensure operating condition
    clusters are grouped cleanly without data leakage between train, validation, and test.
    """
    if feature_cols is None:
        feature_cols = FEATURE_COLUMNS

    df_copy = df.copy()

    # Encode labels
    le = LabelEncoder()
    df_copy["state_encoded"] = le.fit_transform(df_copy["state"])

    # Extract features and targets
    X_raw = df_copy[feature_cols].values
    y = df_copy["state_encoded"].values

    if group_col and group_col in df_copy.columns:
        groups = df_copy[group_col].values
        
        # 1. Split train+val vs test grouped by operating condition
        gss_test = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
        train_val_idx, test_idx = next(gss_test.split(X_raw, y, groups=groups))

        X_train_val = X_raw[train_val_idx]
        y_train_val = y[train_val_idx]
        groups_train_val = groups[train_val_idx]

        # 2. Split train vs val grouped by operating condition
        relative_val_size = val_size / (1.0 - test_size)
        gss_val = GroupShuffleSplit(n_splits=1, test_size=relative_val_size, random_state=seed)
        train_sub_idx, val_sub_idx = next(gss_val.split(X_train_val, y_train_val, groups=groups_train_val))

        train_idx = train_val_idx[train_sub_idx]
        val_idx = train_val_idx[val_sub_idx]

        X_train_unscaled = X_raw[train_idx]
        y_train = y[train_idx]
        X_val_unscaled = X_raw[val_idx]
        y_val = y[val_idx]
        X_test_unscaled = X_raw[test_idx]
        y_test = y[test_idx]
    else:
        # Standard stratified split fallback if no group column
        X_train_val, X_test_unscaled, y_train_val, y_test = train_test_split(
            X_raw, y, test_size=test_size, random_state=seed, stratify=y
        )
        relative_val_size = val_size / (1.0 - test_size)
        X_train_unscaled, X_val_unscaled, y_train, y_val = train_test_split(
            X_train_val, y_train_val, test_size=relative_val_size, random_state=seed, stratify=y_train_val
        )

    # Scale features (strictly fitting ONLY on training split to avoid leakage)
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train_unscaled)
    X_val = scaler.transform(X_val_unscaled)
    X_test = scaler.transform(X_test_unscaled)

    return {
        "X_train": X_train, "y_train": y_train,
        "X_val": X_val, "y_val": y_val,
        "X_test": X_test, "y_test": y_test,
        "scaler": scaler,
        "label_encoder": le,
        "feature_columns": feature_cols,
        "class_names": list(le.classes_),
    }
