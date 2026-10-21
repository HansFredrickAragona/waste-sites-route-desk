import json
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
JSON_PATH = BASE_DIR / 'data' / 'jsons' / 'schedules' / 'driver_schedule.json'
BARANGAY_CSV = BASE_DIR / 'data' / 'csvs' / 'summaries' / 'barangay_sites.csv'

# Build sites map from CSV
bs = pd.read_csv(BARANGAY_CSV)
sites_map = {}
for _, row in bs.iterrows():
    area = str(row['area']).strip().strip('{}').strip()
    sites_map[row['barangay'].lower()] = [s.strip() for s in area.split(',') if s.strip()]

data = json.loads(JSON_PATH.read_text(encoding='utf-8'))

# Fix any U+FFFD replacement chars by matching against CSV barangay names
official_names = {b.lower(): b for b in bs['barangay']}

def fix_name(name: str) -> str:
    # If name has replacement char, try to find a match in official names
    if '�' in name:
        # Build a pattern ignoring the broken char
        parts = name.split('�')
        for off_lower, official in official_names.items():
            ok = True
            for i, part in enumerate(parts):
                part = part.strip().lower()
                if part and part not in off_lower:
                    ok = False
                    break
            if ok:
                return official
    return name

for d in data:
    for s in d['schedule']:
        if isinstance(s['area'], list):
            for item in s['area']:
                fixed = fix_name(item['barangay'])
                if fixed != item['barangay']:
                    print(f"Fixed: {item['barangay']!r} -> {fixed!r}")
                    item['barangay'] = fixed
                # Refresh sites
                item['sites'] = sites_map.get(fixed.lower(), item.get('sites', []))

JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')

# Verify
data2 = json.loads(JSON_PATH.read_text(encoding='utf-8'))
for d in data2:
    if 'BLANTE' in d['driver']:
        for s in d['schedule']:
            if s['day'] == 'Monday':
                print(json.dumps(s['area'], indent=2, ensure_ascii=False))
