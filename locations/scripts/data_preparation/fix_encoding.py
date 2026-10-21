from pathlib import Path

# Fix mojibake in CSV: bytes were UTF-8 encoded twice
base_dir = Path(__file__).resolve().parents[2]
csv_path = base_dir / 'data' / 'csvs' / 'summaries' / 'barangay_sites.csv'
raw = csv_path.read_bytes()
# Double-encoded: UTF-8 bytes of 'ñ' (c3 b1) got interpreted as latin-1 and re-encoded
fixed = raw.replace(b'\xc3\x83\xc2\xb1', b'\xc3\xb1')  # ñ
fixed = fixed.replace(b'\xc3\x83\xc2\xbd', b'\xc3\xbd')  # ý? just in case
csv_path.write_bytes(fixed)
print('CSV fixed')

# Verify
import pandas as pd
df = pd.read_csv(csv_path, encoding='utf-8')
row = df[df['barangay'].str.contains('Slaughter', case=False)].iloc[0]
print(repr(row['barangay']))
