import os
import json
from pathlib import Path
import torch
from torch import nn, optim
from torch.utils.data import Dataset, DataLoader
from torchvision.models import vit_b_16, ViT_B_16_Weights
from tqdm.auto import tqdm
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
from PIL import Image
import matplotlib.pyplot as plt
import seaborn as sns

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")
DATA_DIR = Path("archive (2)/Pharmaceutical and Biomedical Waste (PBW)")
CLASSES = sorted([d for d in os.listdir(DATA_DIR) if os.path.isdir(os.path.join(DATA_DIR, d))])
print(f"Total Classes: {len(CLASSES)}")
for label in CLASSES:
    print(f"- {label}")

train_paths = []
train_labels = []
test_paths = []
test_labels = []

label_to_idx = {label: i for i, label in enumerate(CLASSES)}

for label in CLASSES:
    label_dir = DATA_DIR / label
    train_dir = label_dir / "Train images"
    test_dir = label_dir / "Test images"
    
    if train_dir.exists():
        for img_path in train_dir.glob("*.*"):
            if img_path.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                train_paths.append(str(img_path))
                train_labels.append(label_to_idx[label])
    
    if test_dir.exists():
        for img_path in test_dir.glob("*.*"):
            if img_path.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                test_paths.append(str(img_path))
                test_labels.append(label_to_idx[label])

print(f"Total Train Images: {len(train_paths)}")
print(f"Total Test Images: {len(test_paths)}")

class PBWDataset(Dataset):
    def __init__(self, image_paths, labels, transform=None):
        self.image_paths = image_paths
        self.labels = labels
        self.transform = transform
        
    def __len__(self):
        return len(self.image_paths)
        
    def __getitem__(self, idx):
        img_path = self.image_paths[idx]
        image = Image.open(img_path).convert("RGB")
        label = self.labels[idx]
        if self.transform:
            image = self.transform(image)
        return image, label

weights = ViT_B_16_Weights.DEFAULT
auto_transforms = weights.transforms()

train_dataset = PBWDataset(train_paths, train_labels, transform=auto_transforms)
test_dataset = PBWDataset(test_paths, test_labels, transform=auto_transforms)

BATCH_SIZE = 16 
train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

model = vit_b_16(weights=weights)

# Freeze base model parameters
for param in model.parameters():
    param.requires_grad = False

# Unfreeze the last transformer block to ensure high accuracy
for param in model.encoder.layers[-1].parameters():
    param.requires_grad = True

# Replace head
model.heads = nn.Linear(model.heads.head.in_features, len(CLASSES))
model = model.to(device)

criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam([
    {'params': model.encoder.layers[-1].parameters(), 'lr': 1e-4},
    {'params': model.heads.parameters(), 'lr': 1e-3}
])
EPOCHS = 7

for epoch in range(EPOCHS):
    model.train()
    train_loss = 0.0
    for images, labels in tqdm(train_loader, desc=f"Epoch {epoch+1}/{EPOCHS} [Train]"):
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        train_loss += loss.item() * images.size(0)
    train_loss /= len(train_dataset)
    print(f"Epoch {epoch+1}/{EPOCHS} | Train Loss: {train_loss:.4f}")

model.eval()
all_preds = []
all_labels = []

with torch.no_grad():
    for images, labels in tqdm(test_loader, desc="Evaluating"):
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        _, preds = torch.max(outputs, 1)
        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())

acc = accuracy_score(all_labels, all_preds)
precision = precision_score(all_labels, all_preds, average='weighted')
recall = recall_score(all_labels, all_preds, average='weighted')
f1 = f1_score(all_labels, all_preds, average='weighted')

report_dict = classification_report(all_labels, all_preds, target_names=CLASSES, output_dict=True)

metrics = {
    'accuracy': acc,
    'precision': precision,
    'recall': recall,
    'f1_score': f1,
    'classification_report': report_dict
}

with open('metrics.json', 'w') as f:
    json.dump(metrics, f, indent=4)

print(f"Accuracy: {acc:.4f}")
print(f"Weighted Precision: {precision:.4f}")
print(f"Weighted Recall: {recall:.4f}")
print(f"Weighted F1-Score: {f1:.4f}")

cm = confusion_matrix(all_labels, all_preds)
plt.figure(figsize=(12, 10))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=CLASSES, yticklabels=CLASSES)
plt.xlabel('Predicted')
plt.ylabel('True')
plt.title('Confusion Matrix')
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.savefig('confusion_matrix.png')
torch.save(model.state_dict(), 'vit_pbw_model.pth')
print("Saved metrics, confusion matrix, and model to vit_pbw_model.pth")

