import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import torch
from torch import nn
from torchvision.models import vit_b_16, ViT_B_16_Weights
from PIL import Image

DEFAULT_CLASSES = [
    '(BT) Body Tissue or Organ',
    '(GE) Glass equipment-packaging 551',
    '(ME) Metal equipment -packaging',
    '(OW) Organic wastes',
    '(PE) Plastic equipment-packaging',
    '(PP) Paper equipment-packaging',
    '(SN) Syringe needles',
    'Gauze',
    'Gloves',
    'Mask',
    'Syringe',
    'Tweezers',
]


def get_classes(data_dir: Optional[Path] = None) -> List[str]:
    """Retrieve PBW dataset class names."""
    if data_dir is None:
        base_dir = Path(__file__).resolve().parent
        data_dir = base_dir / "archive (2)" / "Pharmaceutical and Biomedical Waste (PBW)"
    if data_dir.exists():
        classes = sorted([d for d in os.listdir(data_dir) if os.path.isdir(os.path.join(data_dir, d))])
        if classes:
            return classes
    return DEFAULT_CLASSES


def load_vit_model(
    model_path: Optional[Path | str] = None,
    device: Optional[torch.device] = None,
) -> Tuple[nn.Module, Any, List[str], torch.device]:
    """Load ViT-B/16 model and weights once."""
    base_dir = Path(__file__).resolve().parent
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if model_path is None:
        model_path = base_dir / "vit_pbw_model.pth"
    else:
        model_path = Path(model_path)

    classes = get_classes()
    weights = ViT_B_16_Weights.DEFAULT
    model = vit_b_16(weights=weights)
    model.heads = nn.Linear(model.heads.head.in_features, len(classes))

    if not model_path.exists():
        raise FileNotFoundError(f"Model file '{model_path}' not found.")

    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
    model = model.to(device)
    model.eval()
    auto_transforms = weights.transforms()
    return model, auto_transforms, classes, device


def predict_vit(
    model: nn.Module,
    transforms: Any,
    classes: List[str],
    device: torch.device,
    image: Image.Image,
    top_k: int = 3,
) -> List[Dict[str, Any]]:
    """Predict top_k classes with probabilities for an image."""
    if image.mode != "RGB":
        image = image.convert("RGB")
    tensor_image = transforms(image).unsqueeze(0).to(device)
    with torch.no_grad():
        outputs = model(tensor_image)
        probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
        k = min(top_k, len(classes))
        top_probs, top_indices = torch.topk(probabilities, k)

    results = []
    for prob, idx in zip(top_probs, top_indices):
        cls_name = classes[idx.item()]
        p_val = float(prob.item())
        results.append({
            "class": cls_name,
            "probability": round(p_val, 4),
            "confidence_pct": round(p_val * 100, 2),
        })
    return results


def main():
    if len(sys.argv) < 2:
        print("Usage: python predict.py <path_to_image>")
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(f"Error: Image '{image_path}' not found.")
        sys.exit(1)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    base_dir = Path(__file__).resolve().parent
    model_path = base_dir / "vit_pbw_model.pth"
    print(f"Loading model from {model_path}...")
    model, auto_transforms, classes, device = load_vit_model(model_path, device)

    image = Image.open(image_path).convert("RGB")
    print(f"Running inference on '{image_path}'...")
    predictions = predict_vit(model, auto_transforms, classes, device, image, top_k=3)

    top = predictions[0]
    print("\n--- Prediction Results ---")
    print(f"Class: {top['class']}")
    print(f"Confidence: {top['confidence_pct']:.2f}%")
    print("--------------------------")
    if len(predictions) > 1:
        print("Top Predictions:")
        for i, p in enumerate(predictions, 1):
            print(f"  {i}. {p['class']}: {p['confidence_pct']:.2f}%")


if __name__ == "__main__":
    main()
