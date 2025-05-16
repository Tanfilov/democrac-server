#!/usr/bin/env python3
import json, os, re

# Paths to the JSON file and images directory
json_path = 'data/politicians/politicians.json'
images_dir = os.path.join('data', 'politicians', 'images')

# Load existing JSON data
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Build a map of normalized image names to actual filenames
image_files = [f for f in os.listdir(images_dir) if f.lower().endswith('.png')]
norm_map = {re.sub(r"[-' ]", '_', os.path.splitext(f)[0]): f for f in image_files}

# Helper to normalize politician names and aliases, stripping double quotes
def normalize(s):
    # Remove double-quote characters before normalization
    s = s.replace('"', '')
    # Replace spaces, hyphens, and apostrophes with underscores
    return re.sub(r"[-' ]", '_', s)

# Update each entry's image field
count = 0
for entry in data:
    name = entry.get('name', '')
    norm_name = normalize(name)
    img = None
    # Try matching by name
    if norm_name in norm_map:
        img = norm_map[norm_name]
    else:
        # Try matching by any alias
        for alias in entry.get('aliases', []):
            norm_alias = normalize(alias)
            if norm_alias in norm_map:
                img = norm_map[norm_alias]
                break
    # Fallback: try matching by all name parts if still None
    if img is None:
        parts = [p for p in re.split(r"[-' ]", name) if p]
        for key, filename in norm_map.items():
            if all(normalize(p) in key for p in parts):
                img = filename
                break
    if img:
        entry['image'] = img
        count += 1
    else:
        print(f"No image found for {name}")

# Write back updated JSON
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Updated {count} entries") 