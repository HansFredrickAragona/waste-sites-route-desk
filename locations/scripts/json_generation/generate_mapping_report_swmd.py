import json
from pathlib import Path

import pandas as pd

base = Path(__file__).resolve().parents[2] / 'data'

data = json.loads((base / 'jsons' / 'schedules' / 'driver_schedule.json').read_text(encoding='utf-8'))

rows = []
for d in data:
    driver = d['driver']
    for s in d['schedule']:
        day = s['day']
        time = s['time']
        area = s['area']
        if not area:
            rows.append({
                'driver': driver,
                'day': day,
                'time': time,
                'area': 'OFF',
                'status': 'OFF',
                'mapped_barangays': '',
                'sites': '',
                'unmapped_parts': '',
            })
            continue

        mapped = []
        unmapped = []
        for a in area:
            b = a['barangay']
            sites = a['sites']
            if sites:
                mapped.append(f"{b} ({', '.join(sites)})")
            else:
                unmapped.append(b)

        if not unmapped:
            status = 'FULLY MAPPED'
        elif mapped:
            status = 'PARTIALLY MAPPED'
        else:
            status = 'UNMAPPED'

        rows.append({
            'driver': driver,
            'day': day,
            'time': time,
            'area': '; '.join(a['barangay'] for a in area),
            'status': status,
            'mapped_barangays': '; '.join(mapped),
            'unmapped_parts': '; '.join(unmapped),
        })

out = pd.DataFrame(rows)
out_path = base / 'csvs' / 'mapping' / 'area_mapping_status_swmd.csv'
out.to_csv(out_path, index=False)

print("Per-row status:")
print(out['status'].value_counts().to_string())
print(f"\nTotal rows: {len(out)}")
print(f"Saved to: {out_path}")

# Unique unmapped parts
all_unmapped = set()
for r in rows:
    for p in r['unmapped_parts'].split(';'):
        p = p.strip()
        if p:
            all_unmapped.add(p)
print(f"\nUnique unmapped parts ({len(all_unmapped)}):")
for p in sorted(all_unmapped):
    print(f"  - {p}")
