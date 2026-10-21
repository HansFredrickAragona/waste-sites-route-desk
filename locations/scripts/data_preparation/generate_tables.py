from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
INPUT_PATH = BASE_DIR / 'data' / 'csvs' / 'cleaned' / 'cleaned_drivers_dataset.csv'
CENTRAL_PATH = BASE_DIR / 'data' / 'csvs' / 'summaries' / 'central_district.csv'
NON_CENTRAL_PATH = BASE_DIR / 'data' / 'csvs' / 'summaries' / 'non_central_district.csv'

df = pd.read_csv(INPUT_PATH)

central_mask = df['collection'].astype('string').str.upper().str.startswith(
    ('CBD', 'RIC', 'MARKET'), na=False,
)

tables = df.rename(columns={
    'Driver': 'driver',
    'collection': 'area',
})[['driver', 'area', 'day', 'time']]

central = tables[central_mask].reset_index(drop=True)
non_central = tables[~central_mask].reset_index(drop=True)

central.to_csv(CENTRAL_PATH, index=False)
non_central.to_csv(NON_CENTRAL_PATH, index=False)

print(f"Central District: {len(central)} rows -> {CENTRAL_PATH}")
print(f"Non-Central District: {len(non_central)} rows -> {NON_CENTRAL_PATH}")
