"""
Anomaly Detection Model Training & Leakage Check
================================================
Trains Random Forest classifier grouped by operating condition to prevent cross-condition leakage.
Performs explicit Leakage Check comparing:
  1. Model WITH label-defining features (U0/Umf_eff, U0/Ut, dP_ratio)
  2. Model WITHOUT label-defining features (observable plant telemetry only)
Reports accuracy drop, feature importances, per-class precision/recall, and confusion matrix.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from ml.anomaly.generate_data import generate_anomaly_dataset
from ml.anomaly.preprocessing import (
    preprocess_data, FEATURE_COLUMNS, LEAKAGE_FEATURE_COLUMNS, LABEL_DEFINING_COLUMNS
)


def run_leakage_experiment(df: pd.DataFrame) -> dict:
    """
    Train Random Forest with label-defining features included vs removed.
    Both trained with identical grouped train/test split.
    """
    print("\n" + "=" * 70)
    print("RUNNING LEAKAGE CHECK EXPERIMENT")
    print("=" * 70)

    # 1. Dataset WITH label-defining features
    data_leak = preprocess_data(df, feature_cols=LEAKAGE_FEATURE_COLUMNS, group_col="group_id", seed=42)
    rf_leak = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    rf_leak.fit(data_leak["X_train"], data_leak["y_train"])
    y_test_pred_leak = rf_leak.predict(data_leak["X_test"])
    test_acc_leak = accuracy_score(data_leak["y_test"], y_test_pred_leak)
    report_leak = classification_report(
        data_leak["y_test"], y_test_pred_leak, target_names=data_leak["class_names"], output_dict=True
    )
    cm_leak = confusion_matrix(data_leak["y_test"], y_test_pred_leak).tolist()
    importances_leak = {
        col: float(imp) for col, imp in zip(LEAKAGE_FEATURE_COLUMNS, rf_leak.feature_importances_)
    }
    sorted_imp_leak = sorted(importances_leak.items(), key=lambda x: x[1], reverse=True)

    print(f"\n1. Model WITH label-defining features ({len(LEAKAGE_FEATURE_COLUMNS)} features):")
    print(f"   Test Accuracy: {test_acc_leak * 100:.2f}%")
    print("   Top Feature Importances:")
    for feat, imp in sorted_imp_leak[:5]:
        print(f"     - {feat:20s}: {imp * 100:.2f}%")

    # 2. Dataset WITHOUT label-defining features (Plant Telemetry Only)
    data_clean = preprocess_data(df, feature_cols=FEATURE_COLUMNS, group_col="group_id", seed=42)
    rf_clean = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    rf_clean.fit(data_clean["X_train"], data_clean["y_train"])
    y_test_pred_clean = rf_clean.predict(data_clean["X_test"])
    test_acc_clean = accuracy_score(data_clean["y_test"], y_test_pred_clean)
    report_clean = classification_report(
        data_clean["y_test"], y_test_pred_clean, target_names=data_clean["class_names"], output_dict=True
    )
    cm_clean = confusion_matrix(data_clean["y_test"], y_test_pred_clean).tolist()
    importances_clean = {
        col: float(imp) for col, imp in zip(FEATURE_COLUMNS, rf_clean.feature_importances_)
    }
    sorted_imp_clean = sorted(importances_clean.items(), key=lambda x: x[1], reverse=True)

    acc_drop = (test_acc_leak - test_acc_clean) * 100.0

    print(f"\n2. Model WITHOUT label-defining features (Telemetry only, {len(FEATURE_COLUMNS)} features):")
    print(f"   Test Accuracy: {test_acc_clean * 100:.2f}%")
    print(f"   Accuracy Drop: {acc_drop:.2f}% (from {test_acc_leak * 100:.2f}% down to {test_acc_clean * 100:.2f}%)")
    print("   Feature Importances (Telemetry model):")
    for feat, imp in sorted_imp_clean:
        print(f"     - {feat:20s}: {imp * 100:.2f}%")

    print("\n   Confusion Matrix (Telemetry model, rows=True, cols=Pred):")
    print("   Classes:", data_clean["class_names"])
    for row in cm_clean:
        print("    ", row)

    print("\n   Per-Class Metrics (Telemetry model):")
    for cls in data_clean["class_names"]:
        m = report_clean[cls]
        print(f"     {cls:24s}: Precision={m['precision']:.3f}, Recall={m['recall']:.3f}, F1={m['f1-score']:.3f}")

    if test_acc_leak >= 0.98:
        print(
            "\n   LEAKAGE FINDING: Accuracy is near 100% in Model 1 ONLY because the label rule "
            "directly utilizes the exact same dimensionless physics quantities (U0/Umf_eff) as input features."
        )

    return {
        "with_leakage": {
            "test_accuracy": test_acc_leak,
            "classification_report": report_leak,
            "confusion_matrix": cm_leak,
            "feature_importances": importances_leak,
        },
        "without_leakage": {
            "test_accuracy": test_acc_clean,
            "classification_report": report_clean,
            "confusion_matrix": cm_clean,
            "feature_importances": importances_clean,
            "accuracy_drop_pct": acc_drop,
        },
        "clean_model": rf_clean,
        "clean_data": data_clean,
    }


def save_model(clean_model, data_clean: dict, leakage_results: dict, output_dir: str):
    """Save trained production model, scaler, and metadata."""
    os.makedirs(output_dir, exist_ok=True)

    model_path = os.path.join(output_dir, "anomaly_model.joblib")
    scaler_path = os.path.join(output_dir, "anomaly_scaler.joblib")
    le_path = os.path.join(output_dir, "anomaly_label_encoder.joblib")
    meta_path = os.path.join(output_dir, "anomaly_metadata.json")

    joblib.dump(clean_model, model_path)
    joblib.dump(data_clean["scaler"], scaler_path)
    joblib.dump(data_clean["label_encoder"], le_path)

    metadata = {
        "best_model": "random_forest",
        "feature_columns": FEATURE_COLUMNS,
        "class_names": data_clean["class_names"],
        "leakage_check": {
            "accuracy_with_label_defining_features": leakage_results["with_leakage"]["test_accuracy"],
            "accuracy_without_label_defining_features": leakage_results["without_leakage"]["test_accuracy"],
            "accuracy_drop_pct": leakage_results["without_leakage"]["accuracy_drop_pct"],
            "leakage_feature_importances": leakage_results["with_leakage"]["feature_importances"],
            "clean_feature_importances": leakage_results["without_leakage"]["feature_importances"],
            "confusion_matrix_clean": leakage_results["without_leakage"]["confusion_matrix"],
            "classification_report_clean": leakage_results["without_leakage"]["classification_report"],
            "leakage_statement": (
                "Accuracy is near 100% with label-defining features only because the label rule "
                "uses the same inputs (U0/Umf_eff). When evaluating on unseen operating groups with plant "
                "telemetry alone, accuracy reflects true observability of hidden agglomeration dynamics."
            ),
        },
        "results": {
            "random_forest": {
                "test_accuracy": leakage_results["without_leakage"]["test_accuracy"],
            }
        },
    }

    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nModel saved to {model_path}")
    print(f"Scaler saved to {scaler_path}")
    print(f"Metadata saved to {meta_path}")


def run_training_pipeline(output_dir: str = None) -> dict:
    """Run data generation, leakage check, training, and artifact persistence."""
    if output_dir is None:
        output_dir = os.path.join(ROOT_DIR, "models")

    data_dir = os.path.join(ROOT_DIR, "data", "generated")
    csv_path = os.path.join(data_dir, "anomaly_dataset.csv")

    if not os.path.exists(csv_path):
        print("Generating physics-labeled anomaly dataset...")
        df = generate_anomaly_dataset(output_dir=data_dir)
    else:
        print(f"Loading existing dataset from {csv_path}...")
        df = pd.read_csv(csv_path)

    # Run leakage experiment & train models
    leakage_res = run_leakage_experiment(df)

    # Save clean model as production artifact
    save_model(
        clean_model=leakage_res["clean_model"],
        data_clean=leakage_res["clean_data"],
        leakage_results=leakage_res,
        output_dir=output_dir,
    )

    return leakage_res


if __name__ == "__main__":
    run_training_pipeline()
