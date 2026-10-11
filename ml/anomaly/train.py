"""
Anomaly Detection Model Training
=================================
Trains Random Forest and Gradient Boosting classifiers.
Selects the better model based on validation accuracy.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

from ml.anomaly.generate_data import generate_anomaly_dataset
from ml.anomaly.preprocessing import preprocess_data


def train_models(data: dict) -> dict:
    """Train RF and GBM, return results with best model."""
    
    models = {
        "random_forest": RandomForestClassifier(
            n_estimators=100, max_depth=10, random_state=42, n_jobs=-1
        ),
        "gradient_boosting": GradientBoostingClassifier(
            n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42
        ),
    }
    
    results = {}
    
    for name, model in models.items():
        print(f"\nTraining {name}...")
        model.fit(data["X_train"], data["y_train"])
        
        # Validation
        y_val_pred = model.predict(data["X_val"])
        val_acc = accuracy_score(data["y_val"], y_val_pred)
        
        # Test
        y_test_pred = model.predict(data["X_test"])
        test_acc = accuracy_score(data["y_test"], y_test_pred)
        
        report = classification_report(
            data["y_test"], y_test_pred,
            target_names=data["class_names"],
            output_dict=True
        )
        
        results[name] = {
            "model": model,
            "val_accuracy": val_acc,
            "test_accuracy": test_acc,
            "classification_report": report,
        }
        
        print(f"  Validation accuracy: {val_acc:.4f}")
        print(f"  Test accuracy: {test_acc:.4f}")
    
    # Select best model
    best_name = max(results, key=lambda k: results[k]["val_accuracy"])
    print(f"\nBest model: {best_name} (val acc: {results[best_name]['val_accuracy']:.4f})")
    
    return {
        "best_model_name": best_name,
        "best_model": results[best_name]["model"],
        "all_results": {
            k: {kk: vv for kk, vv in v.items() if kk != "model"}
            for k, v in results.items()
        },
        "scaler": data["scaler"],
        "label_encoder": data["label_encoder"],
        "feature_columns": data["feature_columns"],
    }


def save_model(training_result: dict, output_dir: str):
    """Save trained model, scaler, and metadata."""
    os.makedirs(output_dir, exist_ok=True)
    
    # Save model
    model_path = os.path.join(output_dir, "anomaly_model.joblib")
    joblib.dump(training_result["best_model"], model_path)
    
    # Save scaler
    scaler_path = os.path.join(output_dir, "anomaly_scaler.joblib")
    joblib.dump(training_result["scaler"], scaler_path)
    
    # Save label encoder
    le_path = os.path.join(output_dir, "anomaly_label_encoder.joblib")
    joblib.dump(training_result["label_encoder"], le_path)
    
    # Save metadata
    metadata = {
        "best_model": training_result["best_model_name"],
        "feature_columns": training_result["feature_columns"],
        "results": {},
    }
    for name, res in training_result["all_results"].items():
        metadata["results"][name] = {
            "val_accuracy": res["val_accuracy"],
            "test_accuracy": res["test_accuracy"],
        }
    
    meta_path = os.path.join(output_dir, "anomaly_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    
    print(f"Model saved to {model_path}")
    print(f"Scaler saved to {scaler_path}")
    print(f"Metadata saved to {meta_path}")


def run_training_pipeline(output_dir: str = None):
    """Run complete training pipeline."""
    if output_dir is None:
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        output_dir = os.path.join(base, "models")
    
    # Generate data
    print("Generating anomaly dataset...")
    data_dir = os.path.join(os.path.dirname(output_dir), "data", "generated")
    df = generate_anomaly_dataset(output_dir=data_dir)
    
    # Preprocess
    print("Preprocessing...")
    data = preprocess_data(df)
    
    print(f"Training set: {len(data['X_train'])} samples")
    print(f"Validation set: {len(data['X_val'])} samples")
    print(f"Test set: {len(data['X_test'])} samples")
    
    # Train
    result = train_models(data)
    
    # Save
    save_model(result, output_dir)
    
    return result


if __name__ == "__main__":
    run_training_pipeline()
