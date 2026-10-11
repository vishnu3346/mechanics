from ultralytics import YOLO
import sys

def main():
    if len(sys.argv) < 2:
        print("Usage: python predict_yolo.py <path_to_image>")
        sys.exit(1)
        
    from pathlib import Path
    model_path = Path(__file__).resolve().parent / "runs" / "detect" / "medical_waste_yolo" / "run1" / "weights" / "best.pt"
    model = YOLO(str(model_path))
    
    image_path = sys.argv[1]
    
    # Run inference and save the annotated image
    print(f"Running YOLOv8 inference on '{image_path}'...")
    results = model.predict(image_path, save=True, show=True)
    
    print("\nInference completed successfully!")
    print(f"Annotated bounding box image saved in the: {results[0].save_dir} directory.")

if __name__ == '__main__':
    main()
