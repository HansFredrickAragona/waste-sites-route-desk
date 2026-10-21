import json
from pathlib import Path

p = Path(__file__).resolve().parents[2] / 'data' / 'jsons' / 'maps' / 'swmd_map.json'
data = json.loads(p.read_text(encoding='utf-8'))

# Fix any remaining mojibake in barangay names
for item in data:
    b = item['barangay']
    # Fix the Aguinaldo hyphen: â€‘ -> ‑ (non-breaking hyphen U+2011)
    if 'â€' in b:
        item['barangay'] = b.replace('â€‘', '\u2011').replace('â\x80\x92', '\u2011')

p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')

# Verify
data2 = json.loads(p.read_text(encoding='utf-8'))
for d in data2:
    if 'Aguinaldo' in d['barangay']:
        print(repr(d['barangay']))
        print([hex(ord(c)) for c in d['barangay'] if ord(c) > 127])
