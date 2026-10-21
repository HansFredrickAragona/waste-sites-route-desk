import json
from pathlib import Path

data = json.loads((Path(__file__).resolve().parents[2] / 'data' / 'jsons' / 'schedules' / 'driver_schedule.json').read_text(encoding='utf-8'))

# Show drivers with RIC/Market/OFF entries
for d in data:
    has_ric = any('RIC' in str(a.get('barangay','')) or 'Market' in str(a.get('barangay','')) for s in d['schedule'] for a in s['area'])
    has_off = any(not s['area'] for s in d['schedule'])
    if has_ric or has_off:
        print(f"\n=== {d['driver']} ===")
        for s in d['schedule']:
            if not s['area']:
                print(f"  {s['day']} ({s['time']}): OFF")
            else:
                mapped = sum(1 for a in s['area'] if a['sites'])
                unmapped = sum(1 for a in s['area'] if not a['sites'])
                print(f"  {s['day']} ({s['time']}): {mapped} mapped, {unmapped} unmapped")
                for a in s['area']:
                    if not a['sites']:
                        print(f"    UNMAPPED: {a['barangay']}")
