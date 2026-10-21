import re
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
INPUT_PATH = BASE_DIR / 'data' / 'jsons' / 'maps' / 'swmd_map.json'
OUTPUT_PATH = BASE_DIR / 'data' / 'csvs' / 'summaries' / 'barangay_sites.csv'


def normalize_site(name: str) -> str:
    name = re.sub(r'\s+', ' ', str(name).strip())
    lowered = name.lower().replace('sites', 'site').replace('subsite', 'sub site')
    number_match = re.search(r'(\d+)', lowered)
    number = int(number_match.group(1)) if number_match else 0
    if 'sub' in lowered:
        kind = 'Sub Site'
    elif 'main' in lowered:
        kind = 'Main Site'
    else:
        kind = 'Site'
    return f'{kind} {number}', f'{kind.lower()}|{number:04d}'


df = pd.read_json(INPUT_PATH)

df[['site_name', '_sort_key']] = df['site_name'].apply(lambda s: pd.Series(normalize_site(s)))

grouped = (
    df.groupby('barangay', sort=True)
    .agg(area=('site_name', lambda sites: '{ ' + ', '.join(sorted(sites.unique(), key=lambda s: normalize_site(s)[1])) + ' }'))
    .reset_index()
    .rename(columns={'barangay': 'barangay'})
)

grouped.to_csv(OUTPUT_PATH, index=False)

print(f"{len(grouped)} barangays -> {OUTPUT_PATH}")
