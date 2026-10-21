from pathlib import Path

p = Path(__file__).resolve().parents[2] / 'data' / 'jsons' / 'maps' / 'swmd_map.json'
raw = p.read_bytes()

# Fix double-encoded UTF-8 characters
fixes = [
    (b'\xc3\x83\xc2\xb1', b'\xc3\xb1'),      # ñ (double-encoded)
    (b'\xc3\x83\xc2\x82\xc3\xa2\xc2\x80\xc2\x92', b'\xe2\x80\x91'),  # non-breaking hyphen
    (b'\xc3\xa2\xc2\x80\xc2\x92', b'\xe2\x80\x91'),
    (b'\xc3\x82\xc2\x80\xc3\xa2\xc2\x80\xc2\x92', b'\xe2\x80\x91'),
]

for old, new in fixes:
    raw = raw.replace(old, new)

p.write_bytes(raw)

# Verify
import json
data = json.loads(p.read_text(encoding='utf-8'))
for d in data:
    if 'Palma' in d['barangay']:
        print(repr(d['barangay']))
    if 'Slaughter' in d['barangay']:
        print(repr(d['barangay']))
    if 'Aguinaldo' in d['barangay']:
        print(repr(d['barangay']))
