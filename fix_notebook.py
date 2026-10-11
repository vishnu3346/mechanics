import json

with open('train_vit_model_gpu.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        for i, line in enumerate(cell['source']):
            if 'num_workers=2' in line:
                cell['source'][i] = line.replace('num_workers=2', 'num_workers=0')
            if 'train_dir.glob("*.jpg"):' in line:
                cell['source'][i] = line.replace('train_dir.glob("*.jpg")', '[p for p in train_dir.glob("*") if p.suffix.lower() in [".jpg", ".jpeg", ".png"]]')
            if 'test_dir.glob("*.jpg"):' in line:
                cell['source'][i] = line.replace('test_dir.glob("*.jpg")', '[p for p in test_dir.glob("*") if p.suffix.lower() in [".jpg", ".jpeg", ".png"]]')

with open('train_vit_model_gpu.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=4)
