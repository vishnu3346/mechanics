from ultralytics import YOLO
import sys

def main():
    if len(sys.argv) < 2:
        print("Usage: python predict_yolo.py <path_to_image>")
        sys.exit(1)
        
    # Load the custom trained model
    model = YOLO(r"c:\Users\vishn\OneDrive\Desktop\mechanics\runs\detect\medical_waste_yolo\run1\weights\best.pt")
    
    image_path = sys.argv[1]
    
    # Run inference and save the annotated image
    print(f"Running YOLOv8 inference on '{image_path}'...")
    results = model.predict(image_path, save=True, show=True)
    
    print("\nInference completed successfully!")
    print(f"Annotated bounding box image saved in the: {results[0].save_dir} directory.")

if __name__ == '__main__':
    main()
