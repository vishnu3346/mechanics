import os
import sys
import torch
from torch import nn
from torchvision.models import vit_b_16, ViT_B_16_Weights
from PIL import Image
from pathlib import Path

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

    # Determine classes from directory
    base_dir = Path(__file__).resolve().parent
    DATA_DIR = base_dir / "archive (2)" / "Pharmaceutical and Biomedical Waste (PBW)"
    if not DATA_DIR.exists():
        print(f"Error: Dataset directory {DATA_DIR} not found. Ensure it exists to load class labels.")
        sys.exit(1)
        
    CLASSES = sorted([d for d in os.listdir(DATA_DIR) if os.path.isdir(os.path.join(DATA_DIR, d))])
    
    # Load model architecture
    weights = ViT_B_16_Weights.DEFAULT
    model = vit_b_16(weights=weights)
    model.heads = nn.Linear(model.heads.head.in_features, len(CLASSES))
    
    model_path = base_dir / "vit_pbw_model.pth"
    if not model_path.exists():
        print(f"Error: Model file '{model_path}' not found. Please wait for training to complete.")
        sys.exit(1)
        
    print(f"Loading model from {model_path}...")
    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
    model = model.to(device)
    model.eval()
    
    # Prepare image transform
    auto_transforms = weights.transforms()
    
    image = Image.open(image_path).convert("RGB")
    tensor_image = auto_transforms(image).unsqueeze(0).to(device)
    
    print(f"Running inference on '{image_path}'...")
    with torch.no_grad():
        outputs = model(tensor_image)
        probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
        top_prob, top_catid = torch.max(probabilities, 0)
        
    predicted_class = CLASSES[top_catid.item()]
    confidence = top_prob.item() * 100
    
    print("\n--- Prediction Results ---")
    print(f"Class: {predicted_class}")
    print(f"Confidence: {confidence:.2f}%")
    print("--------------------------")
    
if __name__ == "__main__":
    main()
