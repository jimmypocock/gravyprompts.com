#!/usr/bin/env python3
import json
import csv
import os
from collections import defaultdict

# Path to data directory
data_dir = '/Users/jimmypocock/Projects/Web/gravyprompts.com/data'
output_dir = '/Users/jimmypocock/Projects/Web/gravyprompts.com/data/consolidated'

# Initialize list to store all templates
all_templates = []
duplicates = defaultdict(list)

# Read sample-templates.csv
print("Reading sample-templates.csv...")
with open(os.path.join(data_dir, 'sample-templates.csv'), 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Ensure all fields have default values
        template = {
            'title': row.get('title', ''),
            'content': row.get('content', ''),
            'format': 'html',  # Default format for sample templates
            'tags': row.get('tags', ''),
            'category': row.get('category', ''),
            'authorEmail': row.get('authorEmail', ''),
            'visibility': row.get('visibility', ''),
            'viewCount': int(row.get('viewCount', 0)),
            'useCount': int(row.get('useCount', 0))
        }
        all_templates.append(template)

# Read sample-templates.json
print("Reading sample-templates.json...")
with open(os.path.join(data_dir, 'sample-templates.json'), 'r', encoding='utf-8') as f:
    json_data = json.load(f)
    for item in json_data:
        # Convert tags list to comma-separated string if it's a list
        tags = item.get('tags', [])
        if isinstance(tags, list):
            tags = ','.join(tags)
        
        template = {
            'title': item.get('title', ''),
            'content': item.get('content', ''),
            'format': 'html',  # Default format for sample templates
            'tags': tags,
            'category': item.get('category', ''),
            'authorEmail': item.get('authorEmail', ''),
            'visibility': item.get('visibility', ''),
            'viewCount': int(item.get('viewCount', 0)),
            'useCount': int(item.get('useCount', 0))
        }
        all_templates.append(template)

# Read plaintext-templates.csv
print("Reading plaintext-templates.csv...")
with open(os.path.join(data_dir, 'plaintext-templates.csv'), 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        template = {
            'title': row.get('title', ''),
            'content': row.get('content', ''),
            'format': row.get('format', 'plain'),
            'tags': row.get('tags', ''),
            'category': row.get('category', ''),
            'authorEmail': row.get('authorEmail', ''),
            'visibility': row.get('visibility', ''),
            'viewCount': int(row.get('viewCount', 0)) if row.get('viewCount') else 0,
            'useCount': int(row.get('useCount', 0)) if row.get('useCount') else 0
        }
        all_templates.append(template)

# Read plaintext-templates.json
print("Reading plaintext-templates.json...")
with open(os.path.join(data_dir, 'plaintext-templates.json'), 'r', encoding='utf-8') as f:
    json_data = json.load(f)
    for item in json_data:
        # Convert tags list to comma-separated string if it's a list
        tags = item.get('tags', [])
        if isinstance(tags, list):
            tags = ','.join(tags)
        
        template = {
            'title': item.get('title', ''),
            'content': item.get('content', ''),
            'format': item.get('format', 'plain'),
            'tags': tags,
            'category': item.get('category', ''),
            'authorEmail': item.get('authorEmail', ''),
            'visibility': item.get('visibility', ''),
            'viewCount': int(item.get('viewCount', 0)),
            'useCount': int(item.get('useCount', 0))
        }
        all_templates.append(template)

# Read analyzed-templates.csv
print("Reading analyzed-templates.csv...")
with open(os.path.join(data_dir, 'analyzed-templates.csv'), 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        template = {
            'title': row.get('title', ''),
            'content': row.get('content', ''),
            'format': row.get('format', 'plain'),
            'tags': row.get('tags', ''),
            'category': row.get('category', ''),
            'authorEmail': row.get('authorEmail', ''),
            'visibility': row.get('visibility', ''),
            'viewCount': int(row.get('viewCount', 0)) if row.get('viewCount') else 0,
            'useCount': int(row.get('useCount', 0)) if row.get('useCount') else 0
        }
        all_templates.append(template)

print(f"\nTotal templates collected: {len(all_templates)}")

# Check for duplicates
seen_titles = {}
seen_content = {}
unique_templates = []

for i, template in enumerate(all_templates):
    title = template['title'].strip()
    content = template['content'].strip()
    
    # Check for duplicate titles
    if title in seen_titles:
        duplicates['titles'].append({
            'title': title,
            'indices': [seen_titles[title], i]
        })
    else:
        seen_titles[title] = i
    
    # Check for duplicate content (first 200 chars for comparison)
    content_key = content[:200] if len(content) > 200 else content
    if content_key in seen_content:
        duplicates['content'].append({
            'title1': all_templates[seen_content[content_key]]['title'],
            'title2': template['title'],
            'indices': [seen_content[content_key], i]
        })
    else:
        seen_content[content_key] = i

# Create unique templates list (preferring higher viewCount/useCount for duplicates)
processed = set()
for i, template in enumerate(all_templates):
    title = template['title'].strip()
    if title not in processed:
        # Find all templates with this title
        same_title = [t for t in all_templates if t['title'].strip() == title]
        # Choose the one with highest combined viewCount + useCount
        best = max(same_title, key=lambda t: t['viewCount'] + t['useCount'])
        unique_templates.append(best)
        processed.add(title)

print(f"Unique templates after deduplication: {len(unique_templates)}")

# Report duplicates
if duplicates['titles']:
    print(f"\nFound {len(duplicates['titles'])} duplicate titles:")
    for dup in duplicates['titles'][:5]:  # Show first 5
        print(f"  - '{dup['title']}'")
    if len(duplicates['titles']) > 5:
        print(f"  ... and {len(duplicates['titles']) - 5} more")

if duplicates['content']:
    print(f"\nFound {len(duplicates['content'])} potential content duplicates:")
    for dup in duplicates['content'][:5]:  # Show first 5
        print(f"  - '{dup['title1']}' and '{dup['title2']}'")
    if len(duplicates['content']) > 5:
        print(f"  ... and {len(duplicates['content']) - 5} more")

# Sort templates by category and title
unique_templates.sort(key=lambda t: (t['category'], t['title']))

# Write consolidated CSV
csv_path = os.path.join(output_dir, 'consolidated-templates.csv')
print(f"\nWriting consolidated CSV to {csv_path}...")
with open(csv_path, 'w', newline='', encoding='utf-8') as f:
    fieldnames = ['title', 'content', 'format', 'tags', 'category', 'authorEmail', 'visibility', 'viewCount', 'useCount']
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(unique_templates)

# Write consolidated JSON
json_path = os.path.join(output_dir, 'consolidated-templates.json')
print(f"Writing consolidated JSON to {json_path}...")
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(unique_templates, f, indent=2, ensure_ascii=False)

# Write duplicates report
report_path = os.path.join(output_dir, 'duplicates-report.json')
print(f"Writing duplicates report to {report_path}...")
with open(report_path, 'w', encoding='utf-8') as f:
    json.dump(duplicates, f, indent=2, ensure_ascii=False)

print("\nConsolidation complete!")
print(f"- Total templates processed: {len(all_templates)}")
print(f"- Unique templates: {len(unique_templates)}")
print(f"- Duplicate titles found: {len(duplicates['titles'])}")
print(f"- Potential content duplicates: {len(duplicates['content'])}")