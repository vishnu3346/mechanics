from ultralytics import YOLO
import torch

def main():
    print(f"CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        
    # Load a pretrained YOLOv8s (small) model for good balance between speed and accuracy
    model = YOLO("yolov8s.pt")
    
    data_path = "c:/Users/vishn/OneDrive/Desktop/mechanics/medical waste.v2i.yolov8/data.yaml"
    
    # Train the model
    print("Starting YOLOv8 training on medical waste dataset...")
    results = model.train(
        data=data_path,
        epochs=10,
        imgsz=640,
        batch=16,
        device=0 if torch.cuda.is_available() else 'cpu',
        project="medical_waste_yolo",
        name="run1",
        exist_ok=True
    )
    
    print("Training complete!")

if __name__ == '__main__':
    main()
