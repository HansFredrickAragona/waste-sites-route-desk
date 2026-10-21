# Locations data scripts

These scripts prepare the driver schedule, collection-site summaries, and the version 3 mapped schedule. Run commands from the `locations` directory.

## CSV folders

- `data/csvs/raw/` — original driver schedule and SWMD map export.
- `data/csvs/cleaned/` — cleaned driver schedule.
- `data/csvs/summaries/` — district and barangay summaries.
- `data/csvs/mapping/` — coordinate lookups, mapping reports, audits, comparisons, and area research.

See [`data/csvs/README.md`](../data/csvs/README.md) for the file inventory and data flow.

## Main workflow

Install Python with `pandas` and `numpy`, then run:

```bash
python -m pip install pandas numpy
python scripts/data_preparation/cleaner.py
python scripts/data_preparation/generate_tables.py
python scripts/data_preparation/extract_barangays.py
python scripts/json_generation/barangay_sites_from_swmd.py
python scripts/json_generation/update_driver_json.py
```

`cleaner.py` reads `data/csvs/raw/Drivers - raw.csv` and writes `data/csvs/cleaned/cleaned_drivers_dataset.csv`.

`extract_barangays.py` reads `data/jsons/maps/swmd_map.json` and writes `data/csvs/summaries/barangay_sites.csv`.

`update_driver_json.py` reads the cleaned driver schedule, raw 670-row SWMD map, coordinate lookup, and legacy mapped schedule. It writes `data/jsons/schedules/driver_schedule_v3.json`, `data/csvs/mapping/mapping_audit_swmd_v3.csv`, and `data/csvs/mapping/schedule_area_research_v3.csv`.

For v4, run `python scripts/json_generation/curate_driver_schedule_v4.py`, then `python scripts/json_generation/build_driver_schedule_v4.py` from the `locations` directory. The build writes the source and demo copies of v4 plus a 670-row assignment audit. Confirmed sites retain their site names and coordinates; unresolved routes retain `firingline` or blank site entries with null coordinates. The audit records unmatched and invalid source rows instead of forcing them into schedule areas.

For v5, run `python scripts/json_generation/build_driver_schedule_v5.py --seed` once from the `locations` directory to create an independent v5 mapping checklist from the reviewed v4 decisions. The seed includes the reviewed Celestial Village source row 27 and keeps the remaining route unresolved. Edit `data/csvs/mapping/schedule_area_research_v5.csv` for later mapping decisions, then run `python scripts/json_generation/build_driver_schedule_v5.py`. It writes v5 source and demo JSON copies plus `data/csvs/mapping/mapping_audit_swmd_v5.csv`. Each v5 day has one cleaned area name and barangay-based details. Unmapped route or area fragments are stored as `unmapped_segments`, not as null-coordinate site records.

`generate_tables.py` splits the cleaned schedule into central and non-central summaries while preserving both collection day and shift time. `barangay_sites_from_swmd.py` builds the SWMD barangay summary. Other scripts can regenerate mapping status reports. `schedule_extractor.py` is an empty placeholder. `build_driver_schedule_json.py` creates an intermediate `driver_schedule_v2.json` and is not required for the active v3 workflow.

For a detailed explanation of the v3 generator, its inputs and outputs, mapping logic, and review files, see [`json_generation/UPDATE_DRIVER_JSON.md`](json_generation/UPDATE_DRIVER_JSON.md).
