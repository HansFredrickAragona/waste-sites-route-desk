import re
from pathlib import Path

import pandas as pd

base = Path(__file__).resolve().parents[2] / 'data'

df = pd.read_csv(base / 'csvs' / 'raw' / 'SWMD MAP - Baguio_SWMD_Google_MyMaps.csv')


def norm_site(s):
    s = re.sub(r'\s+', ' ', str(s).strip())
    m = re.search(r'(\d+)', s)
    num = int(m.group(1)) if m else 0
    if 'sub' in s.lower():
        kind = 'Sub Site'
    elif 'main' in s.lower():
        kind = 'Main Site'
    else:
        kind = 'Site'
    return f'{kind} {num}', f'{kind.lower()}|{num:04d}'


grouped = (
    df.dropna(subset=['Barangay'])
    .groupby('Barangay')['Site Name']
    .apply(lambda sites: sorted({norm_site(s)[0] for s in sites}, key=lambda s: norm_site(s)[1]))
    .reset_index()
)
grouped.columns = ['barangay', 'sites']
grouped['sites'] = grouped['sites'].apply(lambda s: '{ ' + ', '.join(s) + ' }')
grouped = grouped.sort_values('barangay').reset_index(drop=True)

out_path = base / 'csvs' / 'summaries' / 'barangay_sites_swmd.csv'
grouped.to_csv(out_path, index=False)

print(f"{len(grouped)} barangays -> {out_path}")
