import json
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
INPUT_PATH = BASE_DIR / 'data' / 'csvs' / 'cleaned' / 'cleaned_drivers_dataset.csv'
OUTPUT_PATH = BASE_DIR / 'data' / 'jsons' / 'schedules' / 'driver_schedule_v2.json'

df = pd.read_csv(INPUT_PATH)
df['time'] = df['time'].fillna('')

drivers = []
for name, group in df.groupby('Driver', sort=True):
    schedule = []
    for _, row in group.iterrows():
        schedule.append({
            'day': row['day'],
            'area': row['collection'],
            'collection': row['collection'],
            'time': row['time'],
        })
    drivers.append({'driver': name, 'schedule': schedule})

OUTPUT_PATH.write_text(json.dumps(drivers, indent=2, ensure_ascii=False), encoding='utf-8')
print(f"{len(drivers)} drivers -> {OUTPUT_PATH}")
