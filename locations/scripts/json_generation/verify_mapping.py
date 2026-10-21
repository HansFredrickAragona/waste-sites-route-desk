from pathlib import Path

import pandas as pd

base = Path(__file__).resolve().parents[2] / 'data'
df = pd.read_csv(base / 'csvs' / 'mapping' / 'area_mapping_status.csv')

checks = ['Camp 7, Pias', 'RIC 1', 'RIC 2', 'Purok 16', 'Overpass SLU', 'CBD Session',
           'Market 1', 'Loakan Proper (Pidawan', 'Burnham', 'Pinsao Proper (Monol', 'Quirino Hill,']
for c in checks:
    row = df[df['area'].str.contains(c, na=False, regex=False)]
    if len(row):
        r = row.iloc[0]
        print(f"{r['status']:20} | {r['area'][:70]}")
        if r['mapped'] and r['mapped'] == r['mapped']:
            print(f"  Mapped: {r['mapped']}")
        if r['unmapped'] and r['unmapped'] == r['unmapped']:
            print(f"  Unmapped: {r['unmapped']}")
        print()
