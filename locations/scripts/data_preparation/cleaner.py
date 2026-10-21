from pathlib import Path

import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
INPUT_PATH = BASE_DIR / 'data' / 'csvs' / 'raw' / 'Drivers - raw.csv'
OUTPUT_PATH = BASE_DIR / 'data' / 'csvs' / 'cleaned' / 'cleaned_drivers_dataset.csv'

# Load the CSV file
df = pd.read_csv(INPUT_PATH)

# 1. Remove rows that are entirely empty (all columns are null)
df_cleaned = df.dropna(how='all').copy()

# 2. Remove duplicates
df_cleaned = df_cleaned.drop_duplicates()

# 3. Clean whitespace and standardize empty/null string values
for col in df_cleaned.columns:
    df_cleaned[col] = df_cleaned[col].astype(str).str.strip().replace('', np.nan)
    df_cleaned[col] = df_cleaned[col].replace({'nan': np.nan, 'None': np.nan, 'NaN': np.nan})

df_cleaned = df_cleaned.dropna(subset=['Driver', 'collection', 'day'])

# 4. Fill missing time: OFF days get 'OFF', others left blank
off_mask = df_cleaned['time'].isna() & (df_cleaned['collection'].str.upper() == 'OFF')
df_cleaned.loc[off_mask, 'time'] = 'OFF'
df_cleaned['time'] = df_cleaned['time'].fillna('')

# 5. Save the cleaned data
df_cleaned = df_cleaned.reset_index(drop=True)
df_cleaned.to_csv(OUTPUT_PATH, index=False)

print(f"Cleaned {len(df)} rows into {len(df_cleaned)} rows")
print(f"Saved to: {OUTPUT_PATH}")
print(df_cleaned.head())
